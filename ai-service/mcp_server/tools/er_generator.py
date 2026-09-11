"""
MCP Tool 1: ER Diagram Generator
Generates Entity Relationship diagram from FDD data entities
"""

import sys
import os
from typing import Dict, List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from retrieval import get_relevant_context


def generate_er_tool(data_entities: List[str], raw_text: str) -> Dict:
    """
    MCP Tool: er_generator
    Input: data entities list + raw FDD text
    Output: ER diagram Mermaid code + table definitions
    """

    relevant_text = get_relevant_context(
        raw_text,
        query="data entities database tables fields columns relationships storage",
        top_k=5,
    )

    # Build focused prompt for ER generation only
    prompt = f"""
You are a database architect. Based on these data entities and FDD text,
generate ONLY the data model section of a TDD.

Data Entities Found: {', '.join(data_entities)}

FDD Text (relevant parts):
{relevant_text}

Return ONLY this JSON structure, nothing else:
{{
  "tables": [
    {{
      "name": "table_name",
      "purpose": "what this table stores",
      "columns": [
        {{
          "name": "column_name",
          "type": "SQL_TYPE",
          "constraints": "PRIMARY KEY / NOT NULL / FK etc",
          "description": "what this column stores"
        }}
      ],
      "relationships": ["1:N with other_table"]
    }}
  ],
  "er_diagram": "erDiagram\\n  TABLE1 {{\\n    string id\\n  }}"
}}
"""
    return {
        "tool_name": "er_generator",
        "prompt": prompt,
        "context": {
            "entities": data_entities,
            "focus": "database schema and ER diagram"
        }
    }