"""
MCP Tool 4: Schema Builder
Builds system architecture and component schema
"""

import sys
import os
from typing import Dict, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from retrieval import get_relevant_context


def generate_schema_tool(
    requirements: List[str],
    tech_entities: Dict,
    raw_text: str
) -> Dict:
    """
    MCP Tool: schema_builder
    Input: requirements + detected technologies
    Output: system architecture + component schema
    """

    # Flatten detected tech
    detected_tech = []
    for category, items in tech_entities.items():
        detected_tech.extend(items)

    relevant_text = get_relevant_context(
        raw_text,
        query="system architecture components services frontend backend how the system is structured",
        top_k=4,
    )

    prompt = f"""
You are a software architect. Based on these requirements and detected
technologies, generate ONLY the system architecture section of a TDD.

Detected Technologies: {', '.join(detected_tech) or 'Not specified'}

Key Requirements:
{chr(10).join(f'- {r}' for r in requirements[:15])}

FDD Context:
{relevant_text}

Return ONLY this JSON structure, nothing else:
{{
  "architectural_pattern": "pattern name e.g. Microservices / MVC / Layered",
  "overview": "architecture description",
  "communication": "how components communicate",
  "components": [
    {{
      "name": "component name",
      "type": "Frontend / Backend / Database / Cache / Queue",
      "technology": "specific technology used",
      "responsibility": "what this component does"
    }}
  ],
  "mermaid_diagram": "flowchart TD\\n  A[Component] --> B[Component]",
  "frontend_components": [
    {{
      "name": "ComponentName",
      "type": "Page / Component / Context",
      "responsibility": "what it renders",
      "props": "key props it receives"
    }}
  ],
  "backend_services": [
    {{
      "name": "ServiceName",
      "responsibility": "what this service handles",
      "methods": ["method1", "method2"]
    }}
  ]
}}
"""
    return {
        "tool_name": "schema_builder",
        "prompt": prompt,
        "context": {
            "tech_stack": detected_tech,
            "focus": "system architecture and component design"
        }
    }