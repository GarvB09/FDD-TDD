"""
TDD Generator
Uses Groq (free) with gpt-oss-120b to generate structured Technical Design Document.
"""

import json
import logging
import os
from typing import Dict

from retrieval import get_relevant_context

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are a senior software architect specializing in converting Functional Design Documents (FDD) into Technical Design Documents (TDD).

Your task is to analyze the provided functional requirements and extracted components, then generate a complete, structured TDD.

CRITICAL: You must respond with ONLY a valid JSON object. No markdown, no explanation, no code blocks. Start directly with { and end with }.

The JSON must follow this exact structure:
{
  "introduction": {
    "purpose": "string",
    "scope": "string",
    "assumptions": ["string"],
    "constraints": ["string"],
    "tech_stack": {
      "frontend": "string",
      "backend": "string",
      "database": "string",
      "infrastructure": "string"
    }
  },
  "system_architecture": {
    "overview": "string",
    "architectural_pattern": "string",
    "components": [
      {
        "name": "string",
        "type": "string",
        "responsibility": "string",
        "technology": "string"
      }
    ],
    "communication": "string",
    "mermaid_diagram": "string"
  },
  "data_model": {
    "overview": "string",
    "database_type": "string",
    "tables": [
      {
        "name": "string",
        "purpose": "string",
        "columns": [
          {
            "name": "string",
            "type": "string",
            "constraints": "string",
            "description": "string"
          }
        ],
        "relationships": ["string"]
      }
    ]
  },
  "api_design": {
    "overview": "string",
    "base_url": "string",
    "authentication": "string",
    "endpoints": [
      {
        "method": "string",
        "path": "string",
        "description": "string",
        "request_body": "string",
        "response": "string",
        "fdd_requirement": "string"
      }
    ]
  },
  "component_architecture": {
    "overview": "string",
    "frontend_components": [
      {
        "name": "string",
        "type": "string",
        "responsibility": "string",
        "props": "string"
      }
    ],
    "backend_services": [
      {
        "name": "string",
        "responsibility": "string",
        "methods": ["string"]
      }
    ]
  },
  "non_functional_requirements": {
    "performance": "string",
    "scalability": "string",
    "security": "string",
    "availability": "string",
    "maintainability": "string",
    "compliance": "string"
  },
  "deployment_architecture": {
    "overview": "string",
    "environments": ["string"],
    "infrastructure": "string",
    "ci_cd": "string",
    "monitoring": "string",
    "mermaid_diagram": "string"
  }
}"""


def build_user_prompt(raw_text: str, components: Dict) -> str:
    req_list = "\n".join(
        f"  - {r}" for r in components.get("functional_requirements", [])[:20]
    ) or "  - No explicit requirements found"

    actor_list = ", ".join(components.get("actors", [])) or "Not identified"
    entity_list = ", ".join(components.get("data_entities", [])[:15]) or "Not identified"

    workflow_list = "\n".join(
        f"  - {w}" for w in components.get("workflows", [])[:10]
    ) or "  - No workflows found"

    rule_list = "\n".join(
        f"  - {r}" for r in components.get("business_rules", [])[:10]
    ) or "  - No business rules found"

    feature_list = "\n".join(
        f"  - {f}" for f in components.get("features", [])[:10]
    ) or "  - No features found"

    section_summary = ""
    for s in components.get("document_sections", [])[:8]:
        section_summary += f"\n  [{s['heading']}]: {s['content'][:200]}"

    relevant_text = get_relevant_context(
        raw_text,
        query="system overview requirements architecture data model API design non-functional requirements deployment",
        top_k=8,
    )

    prompt = f"""
FUNCTIONAL DESIGN DOCUMENT - ANALYSIS REQUEST

=== RAW FDD TEXT (most relevant sections) ===
{relevant_text}

=== EXTRACTED FUNCTIONAL REQUIREMENTS ===
{req_list}

=== ACTORS / ROLES ===
{actor_list}

=== DATA ENTITIES ===
{entity_list}

=== WORKFLOWS ===
{workflow_list}

=== BUSINESS RULES ===
{rule_list}

=== SYSTEM FEATURES ===
{feature_list}

=== DOCUMENT SECTIONS SUMMARY ===
{section_summary}

=== TASK ===
Based on the above FDD analysis, generate a complete Technical Design Document in the JSON format specified in your system prompt.

For mermaid_diagram fields follow these rules STRICTLY:
1. Generate ONLY ONE diagram per field
2. Start with exactly: flowchart TD
3. Do NOT use |label|> syntax — use |label| only
4. Do NOT use --> > syntax
5. Each node on its own line
6. Example of CORRECT syntax:
   flowchart TD
     A[User] -->|Login| B[System]
     B -->|Validate| C[Database]
     C -->|Response| B
     B -->|Token| A
Be specific, technical, and derive everything from the actual FDD content above.
Ensure each API endpoint maps back to a functional requirement.
"""
    return prompt


def generate_tdd_with_claude(raw_text: str, components: Dict) -> Dict:
    """
    MCP Pipeline — orchestrates 5 specialized tools.
    Falls back to single Groq call if MCP fails.
    """
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "mcp_server"))

    try:
        from orchestrator import run_mcp_pipeline
        logger.info("Using MCP orchestrated pipeline...")
        return run_mcp_pipeline(raw_text, components)
    except Exception as e:
        logger.error(f"MCP pipeline failed: {e}. Falling back to single prompt.")
        return _generate_tdd_single_prompt(raw_text, components)


def _call_single_prompt_once(client, user_prompt: str) -> Dict:
    """Single Groq request + JSON parse for the whole-document fallback. May raise."""
    # 5000, not 8192: this account's Groq tier caps a single request at 8000
    # tokens/minute total, checked against max_tokens + prompt size together.
    # This prompt alone runs ~2500-3000 tokens (raw text + every extracted
    # component list), so even 6000 was rejected outright (8585 > 8000).
    # This is only the fallback for when the sectioned MCP pipeline fails
    # entirely, so a tighter budget risking a truncated one-shot JSON is an
    # acceptable trade for the call being admitted at all.
    #
    # reasoning_effort="low": gpt-oss models spend part of max_tokens on a
    # hidden reasoning trace before the real answer. Measured on a
    # comparable prompt, that overhead alone was enough to cause a truncated
    # response at this budget -- "low" leaves far more of the 5000 tokens
    # for the actual JSON, which matters even more here since this call has
    # to produce the whole 7-section document in one shot.
    message = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        max_tokens=5000,
        reasoning_effort="low",
        temperature=0.3,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]
    )

    raw_response = message.choices[0].message.content.strip()

    if raw_response.startswith("```"):
        lines = raw_response.split("\n")
        raw_response = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

    return json.loads(raw_response)  # may raise json.JSONDecodeError


def _generate_tdd_single_prompt(raw_text: str, components: Dict) -> Dict:
    """
    Fallback: single Groq prompt asking for the whole document at once, used
    only when the sectioned MCP pipeline fails entirely.

    Retries once on any failure (malformed JSON or an API-level error like a
    rate limit) before giving up -- this is the last line of defense, so it
    previously had none: a single bad response here meant the user saw a
    document with "Parse error" literally shown as the Purpose text and no
    server-side log explaining why, which is much harder to diagnose than a
    single tool failing inside the MCP pipeline (which does log and retry).
    """
    try:
        from groq import Groq
    except ImportError:
        raise RuntimeError("groq not installed.")

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set.")

    client = Groq(api_key=api_key)
    user_prompt = build_user_prompt(raw_text, components)

    last_error = None
    for attempt in (1, 2):
        logger.info("[Fallback] Single-prompt generation" + (" (retry)" if attempt == 2 else ""))
        try:
            return _call_single_prompt_once(client, user_prompt)
        except json.JSONDecodeError as e:
            logger.error(f"[Fallback] JSON parse error (attempt {attempt}): {e}")
            last_error = e
        except Exception as e:
            logger.error(f"[Fallback] Request failed (attempt {attempt}): {e}")
            last_error = e

    return {
        "parse_error": str(last_error),
        "introduction": {"purpose": "Parse error", "scope": "", "assumptions": [], "constraints": [], "tech_stack": {}},
        "system_architecture": {"overview": "", "components": [], "mermaid_diagram": ""},
        "data_model": {"tables": []},
        "api_design": {"endpoints": []},
        "component_architecture": {"frontend_components": [], "backend_services": []},
        "non_functional_requirements": {},
        "deployment_architecture": {"environments": [], "mermaid_diagram": ""}
    }