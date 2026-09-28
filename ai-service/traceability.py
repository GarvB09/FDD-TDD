"""
Traceability Matrix Builder
Maps FDD requirements -> TDD components (APIs, tables, workflows) using
semantic similarity (the same embedding model used for document retrieval),
so a requirement matches generated content that uses different wording for
the same idea -- not just literal shared words.

Falls back to plain keyword overlap if the embedding model can't be loaded
for any reason, so traceability still works (just less precisely) rather
than breaking TDD generation entirely.
"""

import re
import logging
from typing import Dict, List, Optional

import numpy as np

from retrieval import get_model

logger = logging.getLogger(__name__)

# Cosine similarity thresholds, calibrated by measurement against a real
# generated TDD, not guessed:
#
# Encoded 14 (requirement, endpoint) pairs the AI itself claimed were linked
# via each endpoint's fdd_requirement field, and 15 random/unrelated pairs
# from the same document, with all-MiniLM-L6-v2. Random pairs scored up to
# 0.559 (mean 0.349) -- short technical requirement/endpoint sentences share
# enough domain vocabulary ("the system shall...", REST verbs, etc.) that
# similarity runs hot even between unrelated ones. An initial guess of 0.35
# sat almost exactly at that unrelated mean, so it matched nearly everything
# to everything -- worse than the keyword-overlap baseline it was meant to
# improve on. 0.58 (safely above the observed unrelated ceiling) swung too
# far the other way and started dropping real matches, e.g. a "leave types"
# requirement no longer matching the `leave_types` table -- short table/
# component names score lower against a full requirement sentence than
# similar-length text does, independent of actual relevance.
#
# 0.40 is the empirical landing point: on the same test document, it kept
# coverage close to the keyword-overlap baseline (26/32 vs 31/32 "full"
# rows) while several of the keyword baseline's own matches turned out to be
# false positives from shared generic words (e.g. a "support 2,000
# concurrent users" performance requirement matching leave-request CRUD
# endpoints on nothing but the word "system"). This single-document
# calibration is a reasonable starting point, not a final answer -- worth
# revisiting against a larger/more varied sample of generated TDDs.
SIMILARITY_THRESHOLD = 0.40
WORKFLOW_SIMILARITY_THRESHOLD = 0.45


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]", "", text.lower()).strip()


def keyword_overlap(text_a: str, text_b: str) -> int:
    """
    Count shared meaningful words between two strings.

    Kept as the fallback path for when the embedding model isn't available --
    semantic matching (below) is used whenever it is.
    """
    stopwords = {"the", "a", "an", "of", "to", "in", "and", "or", "for", "be", "is", "are", "can", "will", "shall", "should", "must"}
    words_a = set(normalize(text_a).split()) - stopwords
    words_b = set(normalize(text_b).split()) - stopwords
    return len(words_a & words_b)


def _encode(texts: List[str]) -> Optional[np.ndarray]:
    """Batch-embed a list of strings once. Returns None if embedding fails for any reason."""
    if not texts:
        return np.zeros((0, 1))
    try:
        return get_model().encode(texts, convert_to_numpy=True)
    except Exception as e:
        logger.error(f"Embedding failed, traceability will fall back to keyword matching: {e}")
        return None


def _cosine_sim_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """a: (n, d), b: (m, d) -> (n, m) cosine similarity matrix."""
    if a.shape[0] == 0 or b.shape[0] == 0:
        return np.zeros((a.shape[0], b.shape[0]))
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-8)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-8)
    return a_norm @ b_norm.T


def find_related_apis(requirement: str, api_endpoints: List[Dict]) -> List[Dict]:
    """Find APIs related to a requirement -- keyword-overlap fallback path."""
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
    """Find DB tables related to a requirement -- keyword-overlap fallback path."""
    related = []
    for table in tables:
        name = table.get("name", "")
        purpose = table.get("purpose", "")
        if keyword_overlap(requirement, name + " " + purpose) >= 1:
            related.append(name)
    return related


def find_related_components(requirement: str, components: List[Dict]) -> List[str]:
    """Find frontend/backend components related to a requirement -- keyword-overlap fallback path."""
    related = []
    for comp in components:
        name = comp.get("name", "")
        resp = comp.get("responsibility", "")
        if keyword_overlap(requirement, name + " " + resp) >= 1:
            related.append(name)
    return related


def _top_apis(sim_row: np.ndarray, api_endpoints: List[Dict], top_k: int = 3) -> List[Dict]:
    scored = [(float(sim_row[j]), j) for j in range(len(api_endpoints)) if sim_row[j] >= SIMILARITY_THRESHOLD]
    scored.sort(reverse=True)
    return [
        {
            "method": api_endpoints[j].get("method", ""),
            "path": api_endpoints[j].get("path", ""),
            "description": api_endpoints[j].get("description", ""),
            "relevance_score": round(score, 3),
        }
        for score, j in scored[:top_k]
    ]


def _top_names(sim_row: np.ndarray, items: List[Dict]) -> List[str]:
    return [items[j].get("name", "") for j in range(len(items)) if sim_row[j] >= SIMILARITY_THRESHOLD]


def _build_semantic_index(components: Dict, tdd: Dict, requirements: List[str], features: List[str]):
    """
    Batch-embeds every requirement/feature and every candidate API/table/
    component/workflow exactly once, then returns cosine-similarity matrices
    to look up rows from. Avoids re-encoding the same candidate list once per
    requirement, which would be the naive (and much slower) approach.

    Returns None if embedding the query side (requirements + features) fails
    -- at that point there's nothing semantic left to do, so the caller
    should fall back to keyword_overlap entirely for this document.
    """
    api_endpoints = tdd.get("api_design", {}).get("endpoints", [])
    tables = tdd.get("data_model", {}).get("tables", [])
    frontend_comps = tdd.get("component_architecture", {}).get("frontend_components", [])
    backend_services = tdd.get("component_architecture", {}).get("backend_services", [])
    all_comps = frontend_comps + backend_services
    workflows = components.get("workflows", [])

    api_texts = [f"{ep.get('description', '')} {ep.get('path', '')} {ep.get('fdd_requirement', '')}" for ep in api_endpoints]
    table_texts = [f"{t.get('name', '')} {t.get('purpose', '')}" for t in tables]
    comp_texts = [f"{c.get('name', '')} {c.get('responsibility', '')}" for c in all_comps]

    query_emb = _encode(list(requirements) + list(features))
    if query_emb is None:
        return None

    api_emb = _encode(api_texts)
    table_emb = _encode(table_texts)
    comp_emb = _encode(comp_texts)
    workflow_emb = _encode(workflows)

    return {
        "n_requirements": len(requirements),
        "query_self_sim": _cosine_sim_matrix(query_emb, query_emb),
        "api_sim": _cosine_sim_matrix(query_emb, api_emb) if api_emb is not None else None,
        "table_sim": _cosine_sim_matrix(query_emb, table_emb) if table_emb is not None else None,
        "comp_sim": _cosine_sim_matrix(query_emb, comp_emb) if comp_emb is not None else None,
        "workflow_sim": _cosine_sim_matrix(query_emb, workflow_emb) if workflow_emb is not None else None,
    }


def build_traceability_matrix(components: Dict, tdd: Dict) -> List[Dict]:
    """
    Build a traceability matrix linking FDD requirements to TDD components.
    Each entry: { fdd_requirement, tdd_apis, tdd_tables, tdd_components, tdd_workflows, coverage }

    Matches by semantic (embedding) similarity when the embedding model is
    available, so a requirement like "users must authenticate" can match an
    endpoint described as "verify login credentials" even though they share
    no words. Falls back to the original keyword-overlap matching if
    embedding fails for any reason (e.g. the model can't load).
    """
    requirements = components.get("functional_requirements", [])
    features = components.get("features", [])[:5]

    api_endpoints = tdd.get("api_design", {}).get("endpoints", [])
    tables = tdd.get("data_model", {}).get("tables", [])
    frontend_comps = tdd.get("component_architecture", {}).get("frontend_components", [])
    backend_services = tdd.get("component_architecture", {}).get("backend_services", [])
    all_comps = frontend_comps + backend_services
    workflows = components.get("workflows", [])

    sem = _build_semantic_index(components, tdd, requirements, features) if (requirements or features) else None

    matrix = []

    for i, req in enumerate(requirements):
        if sem:
            related_apis = _top_apis(sem["api_sim"][i], api_endpoints) if sem["api_sim"] is not None else []
            related_tables = _top_names(sem["table_sim"][i], tables) if sem["table_sim"] is not None else []
            related_comps = _top_names(sem["comp_sim"][i], all_comps) if sem["comp_sim"] is not None else []
            related_workflows = []
            if sem["workflow_sim"] is not None:
                for j, wf in enumerate(workflows):
                    if sem["workflow_sim"][i][j] >= WORKFLOW_SIMILARITY_THRESHOLD:
                        related_workflows.append(wf[:120])
        else:
            related_apis = find_related_apis(req, api_endpoints)
            related_tables = find_related_tables(req, tables)
            related_comps = find_related_components(req, all_comps)
            related_workflows = [wf[:120] for wf in workflows if keyword_overlap(req, wf) >= 2]

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
    n_req = len(requirements)
    for k, feature in enumerate(features):
        feature_idx = n_req + k

        if sem:
            # Only checked against real requirements (not other features) --
            # the original dedup was about not duplicating an actual FDD
            # requirement, which is the case that matters here.
            already_covered = any(sem["query_self_sim"][feature_idx][i] >= WORKFLOW_SIMILARITY_THRESHOLD for i in range(n_req))
        else:
            already_covered = any(keyword_overlap(feature, e["fdd_requirement"]) >= 2 for e in matrix)

        if already_covered:
            continue

        if sem:
            related_apis = _top_apis(sem["api_sim"][feature_idx], api_endpoints) if sem["api_sim"] is not None else []
            related_tables = _top_names(sem["table_sim"][feature_idx], tables) if sem["table_sim"] is not None else []
            related_comps = _top_names(sem["comp_sim"][feature_idx], all_comps) if sem["comp_sim"] is not None else []
        else:
            related_apis = find_related_apis(feature, api_endpoints)
            related_tables = find_related_tables(feature, tables)
            related_comps = find_related_components(feature, all_comps)

        entry = {
            "fdd_requirement": f"[Feature] {feature}",
            "tdd_apis": [f"{a['method']} {a['path']}" for a in related_apis],
            "tdd_tables": related_tables,
            "tdd_components": related_comps,
            "tdd_workflows": [],
            "coverage": "full" if related_apis else "partial"
        }
        matrix.append(entry)

    return matrix
