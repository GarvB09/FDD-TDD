"""
Diagram Generator
Auto-generates ER diagrams and Sequence diagrams
from TDD data model and workflows.
"""

from typing import Dict, List


def generate_er_diagram(data_model: Dict) -> str:
    """
    Generate Mermaid ER diagram from TDD data model tables.
    """
    tables = data_model.get("tables", [])
    if not tables:
        # The data model tab generated no tables -- most likely the
        # er_generator MCP tool's response failed to parse as JSON (transient
        # LLM/rate-limit noise) and there was nothing to build a real diagram
        # from. Say so directly rather than showing a lone unlabeled box,
        # which reads as a silent failure rather than an explained one.
        return (
            "erDiagram\n"
            '  "No data model was generated" {\n'
            '    string reason "AI response for this section did not parse -- try regenerating the TDD"\n'
            "  }"
        )

    lines = ["erDiagram"]

    for table in tables:
        name = table.get("name", "unknown").upper()
        columns = table.get("columns", [])

        if not columns:
            lines.append(f"  {name} {{")
            lines.append(f"    string id")
            lines.append(f"  }}")
        else:
            lines.append(f"  {name} {{")
            for col in columns[:8]:  # max 8 cols for readability
                col_name = col.get("name", "field").replace(" ", "_")
                col_type = _map_to_er_type(col.get("type", "string"))
                lines.append(f"    {col_type} {col_name}")
            lines.append(f"  }}")

    # Add relationships
    for table in tables:
        name = table.get("name", "").upper()
        for rel in table.get("relationships", []):
            parsed = _parse_relationship(rel, name, tables)
            if parsed:
                lines.append(f"  {parsed}")

    return "\n".join(lines)


def generate_sequence_diagrams(workflows: List[str], actors: List[str]) -> List[Dict]:
    """
    Generate Mermaid sequence diagrams from workflow steps.
    Returns list of { title, diagram } dicts.
    """
    if not workflows:
        return [{
            "title": "Basic System Flow",
            "diagram": _default_sequence()
        }]

    diagrams = []
    actor_list = actors[:3] if actors else ["User", "System"]

    # Group workflows into logical flows
    step_groups = _group_workflow_steps(workflows)

    for i, (title, steps) in enumerate(step_groups.items()):
        if i >= 3:  # max 3 sequence diagrams
            break
        diagram = _build_sequence_diagram(title, steps, actor_list)
        diagrams.append({"title": title, "diagram": diagram})

    return diagrams


def generate_all_diagrams(tdd: Dict, components: Dict) -> Dict:
    """
    Generate all diagrams for a TDD.
    Returns { er_diagram, sequence_diagrams }
    """
    data_model = tdd.get("data_model", {})
    workflows = components.get("workflows", [])
    actors = components.get("actors", [])

    er_diagram = generate_er_diagram(data_model)
    sequence_diagrams = generate_sequence_diagrams(workflows, actors)

    return {
        "er_diagram": er_diagram,
        "sequence_diagrams": sequence_diagrams
    }


# ── Helpers ──────────────────────────────────────────────────────────

def _map_to_er_type(sql_type: str) -> str:
    sql_type = sql_type.lower()
    if any(t in sql_type for t in ["int", "serial", "bigint"]):
        return "int"
    if any(t in sql_type for t in ["float", "decimal", "numeric"]):
        return "float"
    if "bool" in sql_type:
        return "boolean"
    if "uuid" in sql_type:
        return "string"
    if any(t in sql_type for t in ["timestamp", "date", "time"]):
        return "datetime"
    return "string"


def _parse_relationship(rel: str, table_name: str, all_tables: List[Dict]) -> str:
    """Try to parse a relationship string into Mermaid ER syntax."""
    import re
    all_names = [t.get("name", "").upper() for t in all_tables]

    # Look for patterns like "1:N with users" or "N:1 with courses"
    match = re.search(r"(\d+|N|M):(\d+|N|M)\s+with\s+(\w+)", rel, re.IGNORECASE)
    if match:
        card1, card2, other = match.group(1), match.group(2), match.group(3).upper()
        if other in all_names and other != table_name:
            left = "||" if card1 in ("1", "0") else "}|"
            right = "||" if card2 in ("1", "0") else "|{"
            return f"  {table_name} {left}--{right} {other} : relates"

    # Look for FK references like "FK → users.id"
    fk_match = re.search(r"FK\s*[→>]\s*(\w+)\.", rel, re.IGNORECASE)
    if fk_match:
        other = fk_match.group(1).upper()
        if other in all_names and other != table_name:
            return f"  {table_name} }}|--|| {other} : references"

    # UNIQUE constraint mentions
    unique_match = re.search(r"UNIQUE\((\w+)_id,\s*(\w+)_id\)", rel, re.IGNORECASE)
    if unique_match:
        t1 = unique_match.group(1).upper()
        t2 = unique_match.group(2).upper()
        if t1 in all_names and t1 != table_name:
            return f"  {table_name} }}|--|| {t1} : belongs_to"

    return ""


def _group_workflow_steps(workflows: List[str]) -> Dict[str, List[str]]:
    """Group workflow steps into named flows."""
    import re
    groups = {}
    current_group = "Main Flow"
    current_steps = []

    for w in workflows:
        # Detect if this is a new flow title
        if re.match(r"^step\s+1\b", w, re.IGNORECASE) and current_steps:
            groups[current_group] = current_steps
            current_group = f"Flow {len(groups) + 1}"
            current_steps = [w]
        else:
            current_steps.append(w)

    if current_steps:
        groups[current_group] = current_steps

    return groups if groups else {"System Flow": workflows[:6]}


def _build_sequence_diagram(title: str, steps: List[str], actors: List[str]) -> str:
    """Build a Mermaid sequence diagram from workflow steps."""
    import re

    # Normalize actor names for Mermaid
    participant_map = {}
    for a in actors[:4]:
        clean = a.replace(" ", "_").title()
        participant_map[a.lower()] = clean

    # Always include System
    if "system" not in participant_map:
        participant_map["system"] = "System"

    lines = ["sequenceDiagram"]
    for name in dict.fromkeys(participant_map.values()):
        lines.append(f"  participant {name}")

    first_actor = list(participant_map.values())[0]

    for step in steps[:8]:
        # Try to detect direction from text
        step_lower = step.lower()

        if any(w in step_lower for w in ["user", "student", "admin", "instructor", "client"]):
            sender = first_actor
            receiver = "System"
        elif any(w in step_lower for w in ["system", "server", "api", "platform"]):
            sender = "System"
            receiver = first_actor
        else:
            sender = first_actor
            receiver = "System"

        # Clean up step text
        clean_step = re.sub(r"step\s+\d+\s*:?\s*", "", step, flags=re.IGNORECASE).strip()
        clean_step = clean_step[:60].replace('"', "'")

        arrow = "->>" if sender != receiver else "->>+"
        lines.append(f"  {sender}->>{receiver}: {clean_step}")

        # Add system response for user actions
        if sender == first_actor:
            lines.append(f"  {receiver}-->>{sender}: Response")

    return "\n".join(lines)


def _default_sequence() -> str:
    return """sequenceDiagram
  participant User
  participant System
  participant Database
  User->>System: Submit Request
  System->>Database: Query Data
  Database-->>System: Return Results
  System-->>User: Send Response"""