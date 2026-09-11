"""
MCP Tool 2: Sequence Diagram Generator
Generates sequence diagrams from FDD workflows
"""

from typing import Dict, List


def generate_sequence_tool(workflows: List[str], actors: List[str]) -> Dict:
    """
    MCP Tool: sequence_generator
    Input: workflows + actors from FDD
    Output: sequence diagrams in Mermaid format
    """

    prompt = f"""
You are a systems analyst. Based on these workflows and actors,
generate ONLY sequence diagrams for a TDD.

Actors: {', '.join(actors)}

Workflows:
{chr(10).join(f'- {w}' for w in workflows[:10])}

Return ONLY this JSON structure, nothing else:
{{
  "sequence_diagrams": [
    {{
      "title": "Flow Name",
      "description": "what this flow shows",
      "diagram": "sequenceDiagram\\n  participant User\\n  participant System\\n  User->>System: Action\\n  System-->>User: Response"
    }}
  ]
}}

Generate one sequence diagram per major workflow.
Use only valid Mermaid sequenceDiagram syntax.
"""
    return {
        "tool_name": "sequence_generator",
        "prompt": prompt,
        "context": {
            "actors": actors,
            "workflows": workflows,
            "focus": "interaction flows between system components"
        }
    }