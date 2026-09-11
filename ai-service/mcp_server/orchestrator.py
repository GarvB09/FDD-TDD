"""
MCP Orchestrator
Claude AI orchestrates 5 specialized tool servers
to build a complete TDD section by section
"""

import json
import logging
import os
from typing import Dict
from groq import Groq

from tools.er_generator import generate_er_tool
from tools.sequence_generator import generate_sequence_tool
from tools.api_contract import generate_api_tool
from tools.schema_builder import generate_schema_tool
from tools.nfr_component import generate_nfr_tool

logger = logging.getLogger(__name__)


def _call_llm_once(client: Groq, prompt: str, tool_name: str, max_tokens: int) -> Dict:
    """Single Groq request + JSON parse. Raises json.JSONDecodeError on bad output."""
    # This account's Groq tier caps a single request at 8000 tokens/minute,
    # checked against max_tokens + prompt size together -- so this has to
    # stay under that with room for the prompt. The default (5500) fits
    # tools whose prompt includes a chunk of the FDD text; tools with a
    # lighter prompt (e.g. api_contract_generator, which lists many
    # endpoints and has no FDD excerpt in its prompt) pass a higher value.
    #
    # reasoning_effort="low" matters more than the max_tokens tuning above:
    # gpt-oss models emit a hidden chain-of-thought before the actual answer,
    # and it counts against max_tokens without showing up in the response.
    # Measured on a representative prompt: default reasoning burned 691 of
    # 3000 completion tokens on that hidden reasoning and still ran out of
    # budget before finishing the JSON (invalid/truncated output). With
    # reasoning_effort="low", the same prompt used 1246 tokens total (31 on
    # reasoning), finished valid JSON, and was ~40% faster end to end.
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        max_tokens=max_tokens,
        reasoning_effort="low",
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": "You are a specialized TDD generation tool. Return ONLY valid JSON. No markdown, no explanation."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown fences
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

    return json.loads(raw)  # may raise json.JSONDecodeError


def call_llm(prompt: str, tool_name: str, max_tokens: int = 5500) -> Dict:
    """
    Call Groq LLM for a specific tool, with one retry on malformed JSON.

    A garbled/truncated response is often one-off noise -- rerunning the
    exact same prompt frequently comes back clean the second time. This
    directly targets the failure mode that was showing up as sections
    silently going empty (e.g. the ER diagram falling back to a "NO_DATA"
    placeholder when er_generator's JSON didn't parse). Only retries on a
    parse failure, not on every call, so it doesn't add cost to the common
    case where the first response is already valid.
    """
    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

    for attempt in (1, 2):
        logger.info(f"[MCP] Calling tool: {tool_name}" + (" (retry)" if attempt == 2 else ""))
        try:
            return _call_llm_once(client, prompt, tool_name, max_tokens)
        except json.JSONDecodeError as e:
            logger.error(f"[MCP] {tool_name} JSON parse error (attempt {attempt}): {e}")
            last_error = e

    return {"error": str(last_error)}


def run_mcp_pipeline(raw_text: str, components: Dict) -> Dict:
    """
    MCP Pipeline — Claude orchestrates 5 specialized tools.

    Pipeline: er_generator, sequence_generator, api_contract, schema_builder,
    nfr_component. None of these tools depend on another tool's output, so
    there's no *correctness* reason to run them one at a time.

    They run sequentially anyway. This account's Groq tier caps usage at
    8000 tokens/minute, shared across every model, and several of these
    tools genuinely need 4000+ output tokens for a real (non-truncated)
    section on a full FDD. Five such calls fired at once reliably blow past
    that shared budget in aggregate, however small each individual
    max_tokens is trimmed -- concurrency and this rate limit are
    fundamentally incompatible on this tier. Sequential calls let the
    rolling 60s window partially refill between calls instead, which is
    slower but actually finishes instead of cascading into repeated 429s
    and truncated JSON. If the account's TPM budget is ever raised, this is
    the place to reintroduce a ThreadPoolExecutor.
    """
    logger.info("[MCP] Starting orchestrated pipeline (sequential)...")
    results = {}
    errors = []

    tool1 = generate_er_tool(components.get("data_entities", []), raw_text)
    tool2 = generate_sequence_tool(components.get("workflows", []), components.get("actors", []))
    tool3 = generate_api_tool(
        components.get("functional_requirements", []),
        components.get("actors", []),
        components.get("data_entities", [])
    )
    tool4 = generate_schema_tool(
        components.get("functional_requirements", []),
        components.get("tech_entities", {}),
        raw_text
    )
    tool5 = generate_nfr_tool(
        components.get("business_rules", []),
        components.get("tech_entities", {}),
        raw_text
    )

    er_result = call_llm(tool1["prompt"], "er_generator")
    seq_result = call_llm(tool2["prompt"], "sequence_generator")
    # Higher budget: no FDD excerpt in this prompt (just requirement/actor/
    # entity lists), so there's headroom, and it needs it -- one endpoint
    # per requirement plus CRUD per entity adds up fast on a rich FDD.
    api_result = call_llm(tool3["prompt"], "api_contract_generator", max_tokens=7000)
    schema_result = call_llm(tool4["prompt"], "schema_builder")
    nfr_result = call_llm(tool5["prompt"], "nfr_component_mapper")

    logger.info("[MCP] All 5 tools returned.")

    # ── Tool 1: ER Generator ─────────────────────────────────────────
    if "error" not in er_result:
        results["data_model"] = er_result
    else:
        errors.append("er_generator")
        results["data_model"] = {"tables": [], "er_diagram": ""}

    # ── Tool 2: Sequence Generator ───────────────────────────────────
    if "error" not in seq_result:
        results["sequence_diagrams"] = seq_result.get("sequence_diagrams", [])
    else:
        errors.append("sequence_generator")
        results["sequence_diagrams"] = []

    # ── Tool 3: API Contract ─────────────────────────────────────────
    if "error" not in api_result:
        results["api_design"] = api_result
    else:
        errors.append("api_contract_generator")
        results["api_design"] = {"endpoints": []}

    # ── Tool 4: Schema Builder ───────────────────────────────────────
    if "error" not in schema_result:
        results["system_architecture"] = {
            "overview": schema_result.get("overview", ""),
            "architectural_pattern": schema_result.get("architectural_pattern", ""),
            "components": schema_result.get("components", []),
            "communication": schema_result.get("communication", ""),
            "mermaid_diagram": schema_result.get("mermaid_diagram", "")
        }
        results["component_architecture"] = {
            "overview": schema_result.get("overview", ""),
            "frontend_components": schema_result.get("frontend_components", []),
            "backend_services": schema_result.get("backend_services", [])
        }
    else:
        errors.append("schema_builder")
        results["system_architecture"] = {"components": [], "mermaid_diagram": ""}
        results["component_architecture"] = {"frontend_components": [], "backend_services": []}

    # ── Tool 5: NFR + Deployment ─────────────────────────────────────
    if "error" not in nfr_result:
        results["non_functional_requirements"] = nfr_result.get("non_functional_requirements", {})
        results["deployment_architecture"] = nfr_result.get("deployment_architecture", {})
    else:
        errors.append("nfr_component_mapper")
        results["non_functional_requirements"] = {}
        results["deployment_architecture"] = {"environments": [], "mermaid_diagram": ""}

    # ── Build Introduction from all results ──────────────────────────
    tech_stack = components.get("tech_entities", {})
    results["introduction"] = {
        "purpose": f"Technical design for system described in FDD with {len(components.get('functional_requirements', []))} functional requirements.",
        "scope": f"Covers {len(results.get('data_model', {}).get('tables', []))} data entities, {len(results.get('api_design', {}).get('endpoints', []))} API endpoints, and full deployment architecture.",
        "assumptions": ["FDD requirements are complete", "Technology stack is finalized"],
        "constraints": components.get("business_rules", [])[:3],
        "tech_stack": {
            "frontend": ", ".join(tech_stack.get("frameworks", ["React.js"])[:2]),
            "backend": ", ".join(tech_stack.get("languages", ["Node.js"])[:2]),
            "database": ", ".join(tech_stack.get("databases", ["PostgreSQL"])[:2]),
            "infrastructure": ", ".join(tech_stack.get("cloud", ["AWS"])[:2]),
        }
    }

    logger.info(f"[MCP] Pipeline complete. Tools succeeded: {5 - len(errors)}/5")

    return {
        **results,
        "_mcp_metadata": {
            "tools_called": 5,
            "tools_succeeded": 5 - len(errors),
            "tools_failed": errors,
            "pipeline": [
                "er_generator",
                "sequence_generator",
                "api_contract_generator",
                "schema_builder",
                "nfr_component_mapper"
            ]
        }
    }