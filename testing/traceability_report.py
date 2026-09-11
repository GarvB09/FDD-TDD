"""
TEST 3: Traceability Validation
Verifies each FDD requirement maps to TDD components.
Target: >= 90% traceability coverage.
"""

import json
import sys
import os
from typing import Dict, List
from datetime import datetime


def run_traceability_report(tdd: Dict, components: Dict = None) -> Dict:
    matrix = tdd.get("traceability_matrix", [])
    requirements = []

    # Get requirements from matrix or components
    if matrix:
        requirements = [e.get("fdd_requirement", "") for e in matrix]
    elif components:
        requirements = components.get("functional_requirements", [])

    if not requirements:
        return {
            "test": "Traceability Validation",
            "error": "No requirements found in TDD",
            "overall_coverage": 0,
            "overall_status": "FAIL ❌"
        }

    total = len(matrix)
    fully_covered = sum(1 for e in matrix if e.get("coverage") == "full")
    partially_covered = sum(1 for e in matrix if e.get("coverage") == "partial")
    not_covered = total - fully_covered - partially_covered

    # Coverage score: full=100%, partial=50%, none=0%
    coverage_score = round(
        ((fully_covered * 1.0 + partially_covered * 0.5) / total * 100)
        if total > 0 else 0
    )

    status = "PASS ✅" if coverage_score >= 90 else "FAIL ❌"

    # Per-requirement breakdown
    breakdown = []
    for entry in matrix:
        req = entry.get("fdd_requirement", "")
        apis = entry.get("tdd_apis", [])
        tables = entry.get("tdd_tables", [])
        comps = entry.get("tdd_components", [])
        coverage = entry.get("coverage", "none")

        mapped_to = []
        if apis:   mapped_to.append(f"APIs: {', '.join(apis[:2])}")
        if tables: mapped_to.append(f"Tables: {', '.join(tables[:2])}")
        if comps:  mapped_to.append(f"Components: {', '.join(comps[:2])}")

        breakdown.append({
            "requirement": req[:100],
            "coverage": coverage,
            "mapped_to": mapped_to,
            "status": "✅ Full" if coverage == "full" else "⚠️  Partial" if coverage == "partial" else "❌ None"
        })

    return {
        "test": "Traceability Validation",
        "timestamp": datetime.now().isoformat(),
        "overall_coverage": coverage_score,
        "overall_status": status,
        "target": "≥ 90%",
        "total_requirements": total,
        "fully_covered": fully_covered,
        "partially_covered": partially_covered,
        "not_covered": not_covered,
        "breakdown": breakdown
    }


def print_traceability_report(report: Dict):
    print("\n" + "="*60)
    print("  TEST 3: TRACEABILITY VALIDATION")
    print("="*60)
    print(f"  Coverage Score : {report['overall_coverage']}% (Target: {report['target']})")
    print(f"  Status         : {report['overall_status']}")
    print(f"  Total Reqs     : {report['total_requirements']}")
    print(f"  Fully Covered  : {report['fully_covered']}")
    print(f"  Partially      : {report['partially_covered']}")
    print(f"  Not Covered    : {report['not_covered']}")
    print("="*60)

    for i, entry in enumerate(report.get("breakdown", []), 1):
        print(f"\n  {i}. {entry['status']}  {entry['requirement'][:70]}")
        for m in entry["mapped_to"]:
            print(f"       → {m}")
    print("="*60)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            data = json.load(f)
            tdd = data.get("tdd", data)
    else:
        example_path = os.path.join(os.path.dirname(__file__), "../example_tdd_output.json")
        with open(example_path) as f:
            data = json.load(f)
            tdd = data.get("tdd", data)

    report = run_traceability_report(tdd)
    print_traceability_report(report)

    out_path = os.path.join(os.path.dirname(__file__), "traceability_report.json")
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved to: {out_path}")