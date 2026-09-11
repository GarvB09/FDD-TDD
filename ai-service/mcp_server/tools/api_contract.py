"""
MCP Tool 3: API Contract Generator
Generates REST API endpoints from FDD requirements
"""

from typing import Dict, List


def generate_api_tool(requirements: List[str], actors: List[str], entities: List[str]) -> Dict:
    """
    MCP Tool: api_contract_generator
    Input: functional requirements + actors + data entities
    Output: complete REST API design
    """

    prompt = f"""
You are a backend API architect. Based on these functional requirements,
generate ONLY the API design section of a TDD.

Functional Requirements:
{chr(10).join(f'- {r}' for r in requirements[:20])}

Actors: {', '.join(actors)}
Data Entities: {', '.join(entities[:15])}

Return ONLY this JSON structure, nothing else:
{{
  "base_url": "/api/v1",
  "authentication": "JWT Bearer token",
  "overview": "brief API overview",
  "endpoints": [
    {{
      "method": "POST",
      "path": "/resource",
      "description": "what this endpoint does",
      "request_body": "{{ field1, field2 }}",
      "response": "{{ success, data }}",
      "fdd_requirement": "exact requirement this implements"
    }}
  ]
}}

Rules:
- Every endpoint must map to a specific FDD requirement
- Use RESTful conventions
- Include CRUD operations for each data entity
- Include auth endpoints
"""
    return {
        "tool_name": "api_contract_generator",
        "prompt": prompt,
        "context": {
            "requirements": requirements,
            "focus": "REST API design with FDD traceability"
        }
    }