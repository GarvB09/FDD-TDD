"""
TEST 1: Completeness Checker
Verifies generated TDD contains all required components.
Checks against mandatory elements checklist.
"""

import json
import sys
from typing import Dict, List
from datetime import datetime


# ── Mandatory checklist ───────────────────────────────────────────────
CHECKLIST = {
    "Introduction": [
        ("introduction.purpose",        "Purpose statement present",         lambda t: len(t.get("introduction", {}).get("purpose", "")) > 20),
        ("introduction.scope",          "Scope defined",                     lambda t: len(t.get("introduction", {}).get("scope", "")) > 10),
        ("introduction.tech_stack",     "Tech stack specified",               lambda t: bool(t.get("introduction", {}).get("tech_stack"))),
        ("introduction.assumptions",    "Assumptions listed",                 lambda t: len(t.get("introduction", {}).get("assumptions", [])) > 0),
        ("introduction.constraints",    "Constraints listed",                 lambda t: len(t.get("introduction", {}).get("constraints", [])) > 0),
    ],
    "System Architecture": [
        ("system_architecture.overview",            "Architecture overview present",      lambda t: len(t.get("system_architecture", {}).get("overview", "")) > 20),
        ("system_architecture.architectural_pattern","Architectural pattern defined",      lambda t: bool(t.get("system_architecture", {}).get("architectural_pattern"))),
        ("system_architecture.components",          "Components list present (>=3)",      lambda t: len(t.get("system_architecture", {}).get("components", [])) >= 3),
        ("system_architecture.mermaid_diagram",     "Architecture diagram (Mermaid)",     lambda t: len(t.get("system_architecture", {}).get("mermaid_diagram", "")) > 10),
        ("system_architecture.communication",       "Communication pattern defined",      lambda t: bool(t.get("system_architecture", {}).get("communication"))),
    ],
    "Data Model": [
        ("data_model.overview",       "Data model overview present",     lambda t: bool(t.get("data_model", {}).get("overview"))),
        ("data_model.database_type",  "Database type specified",         lambda t: bool(t.get("data_model", {}).get("database_type"))),
        ("data_model.tables",         "Tables defined (>=2)",            lambda t: len(t.get("data_model", {}).get("tables", [])) >= 2),
        ("data_model.er_diagram",     "ER diagram present",             lambda t: bool(t.get("er_diagram"))),
        ("data_model.columns",        "Table columns defined",          lambda t: any(len(tb.get("columns", [])) > 0 for tb in t.get("data_model", {}).get("tables", []))),
        ("data_model.relationships",  "Table relationships defined",    lambda t: any(len(tb.get("relationships", [])) > 0 for tb in t.get("data_model", {}).get("tables", []))),
    ],
    "API Design": [
        ("api_design.base_url",       "Base URL defined",               lambda t: bool(t.get("api_design", {}).get("base_url"))),
        ("api_design.authentication", "Authentication method defined",  lambda t: bool(t.get("api_design", {}).get("authentication"))),
        ("api_design.endpoints",      "Endpoints defined (>=3)",        lambda t: len(t.get("api_design", {}).get("endpoints", [])) >= 3),
        ("api_design.methods",        "HTTP methods specified",         lambda t: all(e.get("method") for e in t.get("api_design", {}).get("endpoints", [{}]))),
        ("api_design.fdd_mapping",    "Endpoints mapped to FDD reqs",  lambda t: any(e.get("fdd_requirement") for e in t.get("api_design", {}).get("endpoints", [{}]))),
    ],
    "Component Architecture": [
        ("component_architecture.frontend", "Frontend components defined",    lambda t: len(t.get("component_architecture", {}).get("frontend_components", [])) > 0),
        ("component_architecture.backend",  "Backend services defined",       lambda t: len(t.get("component_architecture", {}).get("backend_services", [])) > 0),
        ("component_architecture.overview", "Component overview present",     lambda t: bool(t.get("component_architecture", {}).get("overview"))),
    ],
    "Non-Functional Requirements": [
        ("nfr.performance",     "Performance NFR defined",     lambda t: len(t.get("non_functional_requirements", {}).get("performance", "")) > 10),
        ("nfr.scalability",     "Scalability NFR defined",     lambda t: len(t.get("non_functional_requirements", {}).get("scalability", "")) > 10),
        ("nfr.security",        "Security NFR defined",        lambda t: len(t.get("non_functional_requirements", {}).get("security", "")) > 10),
        ("nfr.availability",    "Availability NFR defined",    lambda t: len(t.get("non_functional_requirements", {}).get("availability", "")) > 10),
        ("nfr.maintainability", "Maintainability NFR defined", lambda t: len(t.get("non_functional_requirements", {}).get("maintainability", "")) > 10),
    ],
    "Deployment Architecture": [
        ("deployment.overview",        "Deployment overview present",    lambda t: bool(t.get("deployment_architecture", {}).get("overview"))),
        ("deployment.infrastructure",  "Infrastructure defined",         lambda t: bool(t.get("deployment_architecture", {}).get("infrastructure"))),
        ("deployment.environments",    "Environments listed (>=2)",      lambda t: len(t.get("deployment_architecture", {}).get("environments", [])) >= 2),
        ("deployment.ci_cd",           "CI/CD pipeline defined",         lambda t: bool(t.get("deployment_architecture", {}).get("ci_cd"))),
        ("deployment.mermaid_diagram", "Deployment diagram (Mermaid)",   lambda t: len(t.get("deployment_architecture", {}).get("mermaid_diagram", "")) > 10),
    ],
    "Sequence Diagrams": [
        ("sequence_diagrams", "Sequence diagrams present (>=1)", lambda t: len(t.get("sequence_diagrams", [])) >= 1),
    ],
    "Traceability": [
        ("traceability_matrix",          "Traceability matrix present",       lambda t: len(t.get("traceability_matrix", [])) > 0),
        ("traceability_matrix.coverage", "Coverage entries have status",      lambda t: all(e.get("coverage") for e in t.get("traceability_matrix", [{}]))),
    ],
}


def run_completeness_check(tdd: Dict) -> Dict:
    """
    Run full completeness check against mandatory checklist.
    Returns detailed report with pass/fail per item and overall score.
    """
    results = {}
    total_checks = 0
    total_passed = 0

    for category, checks in CHECKLIST.items():
        category_results = []
        cat_passed = 0

        for check_id, description, check_fn in checks:
            try:
                passed = check_fn(tdd)
            except Exception:
                passed = False

            category_results.append({
                "id": check_id,
                "description": description,
                "passed": passed,
                "status": "✅ PASS" if passed else "❌ FAIL"
            })

            if passed:
                cat_passed += 1
            total_checks += 1
            if passed:
                total_passed += 1

        results[category] = {
            "checks": category_results,
            "passed": cat_passed,
            "total": len(checks),
            "score": round((cat_passed / len(checks)) * 100)
        }

    overall_score = round((total_passed / total_checks) * 100)
    status = "PASS ✅" if overall_score >= 80 else "FAIL ❌"

    return {
        "test": "Completeness Testing",
        "timestamp": datetime.now().isoformat(),
        "overall_score": overall_score,
        "overall_status": status,
        "target": "≥ 80%",
        "total_checks": total_checks,
        "total_passed": total_passed,
        "categories": results,
        "missing_components": [
            item["description"]
            for cat in results.values()
            for item in cat["checks"]
            if not item["passed"]
        ]
    }


def print_completeness_report(report: Dict):
    print("\n" + "="*60)
    print("  TEST 1: COMPLETENESS TESTING")
    print("="*60)
    print(f"  Overall Score : {report['overall_score']}% (Target: {report['target']})")
    print(f"  Status        : {report['overall_status']}")
    print(f"  Checks        : {report['total_passed']}/{report['total_checks']} passed")
    print(f"  Timestamp     : {report['timestamp']}")
    print("="*60)

    for category, data in report["categories"].items():
        bar = "█" * (data["score"] // 10) + "░" * (10 - data["score"] // 10)
        print(f"\n  {category} [{bar}] {data['score']}%")
        for item in data["checks"]:
            print(f"    {item['status']}  {item['description']}")

    if report["missing_components"]:
        print(f"\n  ⚠️  Missing ({len(report['missing_components'])}):")
        for m in report["missing_components"]:
            print(f"    - {m}")
    print("="*60)


if __name__ == "__main__":
    # Load TDD from file if provided
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            data = json.load(f)
            tdd = data.get("tdd", data)
    else:
        # Load example
        import os
        example_path = os.path.join(os.path.dirname(__file__), "../example_tdd_output.json")
        with open(example_path) as f:
            data = json.load(f)
            tdd = data.get("tdd", data)

    report = run_completeness_check(tdd)
    print_completeness_report(report)

    # Save report
    out_path = os.path.join(os.path.dirname(__file__), "completeness_report.json")
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved to: {out_path}")