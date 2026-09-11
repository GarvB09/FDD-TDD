"""
TEST 4: Performance Metrics
Tracks TDD generation time vs manual effort.
Target: >= 70% reduction in effort.
"""

import json
import os
import time
from typing import Dict
from datetime import datetime


MANUAL_TDD_HOURS_MIN = 8
MANUAL_TDD_HOURS_MAX = 16
MANUAL_TDD_MINUTES_AVG = (MANUAL_TDD_HOURS_MIN + MANUAL_TDD_HOURS_MAX) / 2 * 60


def start_timer() -> float:
    return time.time()


def calculate_performance_metrics(
    start_time: float,
    end_time: float,
    tdd: Dict = None
) -> Dict:

    generation_seconds = round(end_time - start_time, 2)
    generation_minutes = round(generation_seconds / 60, 2)

    effort_reduction = round(
        ((MANUAL_TDD_MINUTES_AVG - generation_minutes) / MANUAL_TDD_MINUTES_AVG) * 100, 1
    )
    effort_reduction = min(effort_reduction, 99.9)

    status = "PASS ✅" if effort_reduction >= 70 else "FAIL ❌"

    # Quality metrics from TDD
    quality = {}
    if tdd:
        quality = {
            "sections_generated": sum([
                bool(tdd.get("introduction")),
                bool(tdd.get("system_architecture")),
                bool(tdd.get("data_model")),
                bool(tdd.get("api_design")),
                bool(tdd.get("component_architecture")),
                bool(tdd.get("non_functional_requirements")),
                bool(tdd.get("deployment_architecture")),
            ]),
            "api_endpoints": len(tdd.get("api_design", {}).get("endpoints", [])),
            "db_tables": len(tdd.get("data_model", {}).get("tables", [])),
            "components": len(tdd.get("system_architecture", {}).get("components", [])),
            "traceability_entries": len(tdd.get("traceability_matrix", [])),
        }

    return {
        "test": "Performance Metrics",
        "timestamp": datetime.now().isoformat(),
        "generation_time_seconds": generation_seconds,
        "generation_time_minutes": generation_minutes,
        "manual_time_minutes_avg": MANUAL_TDD_MINUTES_AVG,
        "manual_time_range": f"{MANUAL_TDD_HOURS_MIN}-{MANUAL_TDD_HOURS_MAX} hours",
        "effort_reduction_percent": effort_reduction,
        "overall_status": status,
        "target": "≥ 70% effort reduction",
        "quality_metrics": quality,
        "comparison": {
            "manual": f"{MANUAL_TDD_HOURS_MIN}-{MANUAL_TDD_HOURS_MAX} hours",
            "automated": f"{generation_minutes} minutes",
            "speedup": f"{round(MANUAL_TDD_MINUTES_AVG / max(generation_minutes, 0.1))}x faster"
        }
    }


def print_performance_report(report: Dict):
    print("\n" + "="*60)
    print("  TEST 4: PERFORMANCE METRICS")
    print("="*60)
    print(f"  Effort Reduction : {report['effort_reduction_percent']}% (Target: {report['target']})")
    print(f"  Status           : {report['overall_status']}")
    print(f"  Generation Time  : {report['generation_time_seconds']}s ({report['generation_time_minutes']} min)")
    print(f"  Manual Time      : {report['manual_time_range']}")
    print(f"  Speedup          : {report['comparison']['speedup']}")

    if report.get("quality_metrics"):
        q = report["quality_metrics"]
        print(f"\n  Output Quality:")
        print(f"    Sections Generated : {q.get('sections_generated', 0)}/7")
        print(f"    API Endpoints      : {q.get('api_endpoints', 0)}")
        print(f"    Database Tables    : {q.get('db_tables', 0)}")
        print(f"    Components         : {q.get('components', 0)}")
        print(f"    Traceability Entries: {q.get('traceability_entries', 0)}")
    print("="*60)


if __name__ == "__main__":
    # Demo with example TDD
    example_path = os.path.join(os.path.dirname(__file__), "../example_tdd_output.json")
    with open(example_path) as f:
        data = json.load(f)
        tdd = data.get("tdd", data)

    # Simulate a generation time of 45 seconds
    start = time.time() - 45
    report = calculate_performance_metrics(start, time.time(), tdd)
    print_performance_report(report)

    out_path = os.path.join(os.path.dirname(__file__), "performance_report.json")
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n  Report saved to: {out_path}")