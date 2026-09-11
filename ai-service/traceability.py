"""
Traceability Matrix Builder
Maps FDD requirements → TDD components (APIs, tables, workflows)
"""

import re
from typing import Dict, List


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]", "", text.lower()).strip()


def keyword_overlap(text_a: str, text_b: str) -> int:
    """Count shared meaningful words between two strings."""
    stopwords = {"the", "a", "an", "of", "to", "in", "and", "or", "for", "be", "is", "are", "can", "will", "shall", "should", "must"}
    words_a = set(normalize(text_a).split()) - stopwords
    words_b = set(normalize(text_b).split()) - stopwords
    return len(words_a & words_b)


def find_related_apis(requirement: str, api_endpoints: List[Dict]) -> List[Dict]:
    """Find APIs that are semantically related to a requirement."""
    related = []
    for ep in api_endpoints:
        desc = ep.get("description", "") + " " + ep.get("path", "")
        fdd_ref = ep.get("fdd_requirement", "")
        score = keyword_overlap(requirement, desc + " " + fdd_ref)
        if score >= 1:
            related.append({
                "method": ep.get("method", ""),
                "path": ep.get("path", ""),
                "description": ep.get("description", ""),
                "relevance_score": score
            })
    return sorted(related, key=lambda x: x["relevance_score"], reverse=True)[:3]


def find_related_tables(requirement: str, tables: List[Dict]) -> List[str]:
    """Find DB tables related to a requirement."""
    related = []
    for table in tables:
        name = table.get("name", "")
        purpose = table.get("purpose", "")
        if keyword_overlap(requirement, name + " " + purpose) >= 1:
            related.append(name)
    return related


def find_related_components(requirement: str, components: List[Dict]) -> List[str]:
    """Find frontend/backend components related to a requirement."""
    related = []
    for comp in components:
        name = comp.get("name", "")
        resp = comp.get("responsibility", "")
        if keyword_overlap(requirement, name + " " + resp) >= 1:
            related.append(name)
    return related


def build_traceability_matrix(components: Dict, tdd: Dict) -> List[Dict]:
    """
    Build a traceability matrix linking FDD requirements to TDD components.
    Each entry: { requirement, apis, tables, components, workflows }
    """
    requirements = components.get("functional_requirements", [])

    # Extract TDD elements
    api_endpoints = tdd.get("api_design", {}).get("endpoints", [])
    tables = tdd.get("data_model", {}).get("tables", [])
    frontend_comps = tdd.get("component_architecture", {}).get("frontend_components", [])
    backend_services = tdd.get("component_architecture", {}).get("backend_services", [])
    all_comps = frontend_comps + backend_services
    workflows = components.get("workflows", [])

    matrix = []

    for req in requirements:
        related_apis = find_related_apis(req, api_endpoints)
        related_tables = find_related_tables(req, tables)
        related_comps = find_related_components(req, all_comps)

        # Find related workflows
        related_workflows = []
        for wf in workflows:
            if keyword_overlap(req, wf) >= 2:
                related_workflows.append(wf[:120])

        entry = {
            "fdd_requirement": req,
            "tdd_apis": [f"{a['method']} {a['path']}" for a in related_apis],
            "tdd_tables": related_tables,
            "tdd_components": related_comps,
            "tdd_workflows": related_workflows[:2],
            "coverage": "full" if (related_apis or related_tables or related_comps) else "partial"
        }
        matrix.append(entry)

    # Add unmapped requirements from features
    features = components.get("features", [])
    for feature in features[:5]:
        # Check if already covered
        already_covered = any(keyword_overlap(feature, e["fdd_requirement"]) >= 2 for e in matrix)
        if not already_covered:
            related_apis = find_related_apis(feature, api_endpoints)
            entry = {
                "fdd_requirement": f"[Feature] {feature}",
                "tdd_apis": [f"{a['method']} {a['path']}" for a in related_apis],
                "tdd_tables": find_related_tables(feature, tables),
                "tdd_components": find_related_components(feature, all_comps),
                "tdd_workflows": [],
                "coverage": "full" if related_apis else "partial"
            }
            matrix.append(entry)

    return matrix
