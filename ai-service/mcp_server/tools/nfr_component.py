"""
MCP Tool 5: NFR and Component Mapper
Generates non-functional requirements and deployment architecture
"""

import sys
import os
from typing import Dict, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from retrieval import get_relevant_context


def generate_nfr_tool(
    business_rules: List[str],
    tech_entities: Dict,
    raw_text: str
) -> Dict:
    """
    MCP Tool: nfr_component_mapper
    Input: business rules + tech keywords + FDD text
    Output: NFRs + deployment architecture
    """

    cloud_tech = tech_entities.get("cloud", [])
    devops_tech = tech_entities.get("devops", [])

    relevant_text = get_relevant_context(
        raw_text,
        query="performance scalability security availability deployment infrastructure uptime compliance",
        top_k=4,
    )

    prompt = f"""
You are a DevOps and systems engineer. Based on these business rules
and technology context, generate ONLY the NFR and deployment sections.

Business Rules:
{chr(10).join(f'- {r}' for r in business_rules[:10])}

Detected Cloud/DevOps: {', '.join(cloud_tech + devops_tech) or 'Not specified'}

FDD Context:
{relevant_text}

Return ONLY this JSON structure, nothing else:
{{
  "non_functional_requirements": {{
    "performance": "specific performance targets",
    "scalability": "how system scales",
    "security": "security measures",
    "availability": "uptime targets",
    "maintainability": "code quality standards",
    "compliance": "regulatory requirements"
  }},
  "deployment_architecture": {{
    "overview": "deployment description",
    "infrastructure": "where it runs",
    "environments": ["development", "staging", "production"],
    "ci_cd": "pipeline description",
    "monitoring": "monitoring approach",
    "mermaid_diagram": "graph TD\\n  A[Component] --> B[Server]"
  }}
}}
"""
    return {
        "tool_name": "nfr_component_mapper",
        "prompt": prompt,
        "context": {
            "cloud": cloud_tech,
            "devops": devops_tech,
            "focus": "non-functional requirements and deployment"
        }
    }