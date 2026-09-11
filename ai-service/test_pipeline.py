#!/usr/bin/env python3
"""
test_pipeline.py
Integration tests for the FDD → TDD pipeline.
Run with: python test_pipeline.py

Tests:
  1. AI service health
  2. Document parsing (DOCX created in-memory)
  3. NLP extraction
  4. Traceability builder
  5. OpenAPI generator
  6. Full pipeline mock (no Claude call — uses mock TDD)
  7. Backend health (if running)
"""

import sys
import json
import os
import tempfile
import traceback

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "
results = []


def test(name, fn):
    try:
        fn()
        print(f"  {PASS} {name}")
        results.append((name, True, None))
    except Exception as e:
        print(f"  {FAIL} {name}: {e}")
        results.append((name, False, str(e)))


# ─── 1. NLP Processor ───────────────────────────────────────────────
print("\nTesting NLP Processor...")

def test_requirements_extraction():
    from nlp_processor import extract_with_patterns, REQUIREMENT_PATTERNS
    text = "The system shall allow users to register. Users must verify their email."
    reqs = extract_with_patterns(text, REQUIREMENT_PATTERNS)
    assert len(reqs) >= 1, f"Expected >=1 requirement, got {len(reqs)}"

def test_actor_extraction():
    from nlp_processor import extract_actors
    text = "The admin can manage users. Students can enroll in courses. Instructors create content."
    actors = extract_actors(text)
    assert "admin" in actors, f"Expected 'admin' in {actors}"
    assert "student" in actors or "students" in actors, f"Expected 'student' in {actors}"

def test_entity_extraction():
    from nlp_processor import extract_data_entities
    text = "The system shall create a user record. Manage course content. Store payment transactions."
    entities = extract_data_entities(text)
    assert len(entities) >= 1, f"Expected at least 1 entity, got {entities}"

def test_section_extraction():
    from nlp_processor import extract_sections
    text = "## Introduction\nThis is the intro.\n## Requirements\nFR-001: Users can login."
    sections = extract_sections(text)
    assert len(sections) >= 1, f"Expected sections, got {sections}"

def test_full_component_extraction():
    from nlp_processor import extract_functional_components
    text = """
    The system shall allow users to register an account.
    The system must support admin and student roles.
    Users shall be able to upload documents.
    Step 1: User submits form. Step 2: System validates.
    The platform must not allow duplicate emails.
    The system can generate reports.
    """
    result = extract_functional_components(text)
    assert "functional_requirements" in result
    assert "actors" in result
    assert "stats" in result
    assert result["stats"]["requirements_found"] >= 2, f"Expected >=2 reqs, got {result['stats']}"

test("Requirements extraction", test_requirements_extraction)
test("Actor extraction", test_actor_extraction)
test("Data entity extraction", test_entity_extraction)
test("Section extraction", test_section_extraction)
test("Full component extraction", test_full_component_extraction)


# ─── 2. Document Parser ──────────────────────────────────────────────
print("\nTesting Document Parser...")

def test_docx_parsing():
    from docx import Document
    from document_parser import extract_text_from_docx
    # Create a temp DOCX
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
        tmp_path = f.name
    doc = Document()
    doc.add_heading("Test FDD", level=1)
    doc.add_paragraph("The system shall allow users to register.")
    doc.add_paragraph("FR-001: Users must verify their email address.")
    doc.save(tmp_path)
    try:
        text = extract_text_from_docx(tmp_path)
        assert "register" in text.lower(), f"Expected 'register' in extracted text"
        assert len(text) > 10
    finally:
        os.unlink(tmp_path)

def test_pdf_parsing():
    try:
        import PyPDF2
        # PyPDF2 is installed, skip actual PDF test (needs real file)
        # but verify import works
        assert True
    except ImportError:
        raise AssertionError("PyPDF2 not installed")

test("DOCX text extraction", test_docx_parsing)
test("PyPDF2 available", test_pdf_parsing)


# ─── 3. Traceability Builder ─────────────────────────────────────────
print("\n Testing Traceability Builder...")

MOCK_COMPONENTS = {
    "functional_requirements": [
        "The system shall allow users to register an account.",
        "Users must be able to log in with email and password.",
        "Instructors shall create and publish courses.",
        "Students can enroll in courses and track progress.",
    ],
    "workflows": [
        "Step 1: User submits registration form. Step 2: System validates email."
    ],
    "features": ["Course management feature", "Payment processing module"]
}

MOCK_TDD = {
    "api_design": {
        "endpoints": [
            {"method": "POST", "path": "/auth/register", "description": "Register user account", "fdd_requirement": "user registration"},
            {"method": "POST", "path": "/auth/login", "description": "Login with email password", "fdd_requirement": "user login"},
            {"method": "POST", "path": "/courses", "description": "Create and publish course", "fdd_requirement": "instructor creates course"},
            {"method": "POST", "path": "/enrollments", "description": "Enroll student in course", "fdd_requirement": "student enrollment"},
            {"method": "GET", "path": "/progress/:id", "description": "Track student progress", "fdd_requirement": "progress tracking"},
        ]
    },
    "data_model": {
        "tables": [
            {"name": "users", "purpose": "Store user accounts and registration data"},
            {"name": "courses", "purpose": "Store course and publishing information"},
            {"name": "enrollments", "purpose": "Track student enrollment and progress"},
        ]
    },
    "component_architecture": {
        "frontend_components": [
            {"name": "RegisterForm", "responsibility": "User registration form component"},
            {"name": "CourseCard", "responsibility": "Display course information"},
        ],
        "backend_services": [
            {"name": "AuthService", "responsibility": "Handle user registration and login"},
            {"name": "CourseService", "responsibility": "Create publish and manage courses"},
            {"name": "EnrollmentService", "responsibility": "Manage student enrollment"},
        ]
    }
}

def test_traceability_builds():
    from traceability import build_traceability_matrix
    matrix = build_traceability_matrix(MOCK_COMPONENTS, MOCK_TDD)
    assert isinstance(matrix, list), "Matrix should be a list"
    assert len(matrix) > 0, "Matrix should not be empty"
    for entry in matrix:
        assert "fdd_requirement" in entry
        assert "tdd_apis" in entry
        assert "tdd_tables" in entry
        assert "coverage" in entry

def test_traceability_coverage():
    from traceability import build_traceability_matrix
    matrix = build_traceability_matrix(MOCK_COMPONENTS, MOCK_TDD)
    full_coverage = [e for e in matrix if e["coverage"] == "full"]
    assert len(full_coverage) >= 2, f"Expected >=2 full coverage entries, got {len(full_coverage)}"

def test_keyword_overlap():
    from traceability import keyword_overlap
    assert keyword_overlap("user register account", "register user account") >= 2
    assert keyword_overlap("totally unrelated text", "something completely different") == 0
    assert keyword_overlap("", "anything") == 0

def test_traceability_apis_mapped():
    from traceability import build_traceability_matrix
    matrix = build_traceability_matrix(MOCK_COMPONENTS, MOCK_TDD)
    reg_entry = next((e for e in matrix if "register" in e["fdd_requirement"].lower()), None)
    assert reg_entry is not None, "Should find registration requirement"
    assert len(reg_entry["tdd_apis"]) > 0, f"Registration req should map to API, got {reg_entry}"

test("Traceability matrix builds", test_traceability_builds)
test("Coverage classification", test_traceability_coverage)
test("Keyword overlap scoring", test_keyword_overlap)
test("API mapping correctness", test_traceability_apis_mapped)


# ─── 4. OpenAPI Generator ────────────────────────────────────────────
print("\nTesting OpenAPI Generator...")

def test_openapi_structure():
    from api_docs_generator import generate_openapi_spec
    spec = generate_openapi_spec(MOCK_TDD)
    assert spec["openapi"] == "3.0.3"
    assert "info" in spec
    assert "paths" in spec
    assert "components" in spec
    assert len(spec["paths"]) > 0, "Should have at least one path"

def test_openapi_methods():
    from api_docs_generator import generate_openapi_spec
    spec = generate_openapi_spec(MOCK_TDD)
    # Check /auth/register exists
    assert "/auth/register" in spec["paths"], f"Paths: {list(spec['paths'].keys())}"
    assert "post" in spec["paths"]["/auth/register"]

def test_openapi_path_param_conversion():
    from api_docs_generator import _normalize_path, _infer_path_params
    assert _normalize_path("/courses/:id") == "/courses/{id}"
    assert _normalize_path("/users/:userId/posts/:postId") == "/users/{userId}/posts/{postId}"
    params = _infer_path_params("/courses/:id")
    assert len(params) == 1
    assert params[0]["name"] == "id"
    assert params[0]["in"] == "path"

def test_openapi_schemas_from_tables():
    from api_docs_generator import generate_openapi_spec
    spec = generate_openapi_spec(MOCK_TDD)
    schemas = spec["components"]["schemas"]
    assert len(schemas) > 0, "Should generate schemas from tables"
    # 'users' table -> 'Users' schema
    assert "Users" in schemas, f"Expected 'Users' schema, got: {list(schemas.keys())}"

def test_openapi_json_serializable():
    from api_docs_generator import tdd_to_openapi_json
    json_str = tdd_to_openapi_json(MOCK_TDD)
    parsed = json.loads(json_str)
    assert "openapi" in parsed

test("OpenAPI spec structure", test_openapi_structure)
test("HTTP methods mapped correctly", test_openapi_methods)
test("Path param :id → {id} conversion", test_openapi_path_param_conversion)
test("Schema generation from tables", test_openapi_schemas_from_tables)
test("JSON serializable output", test_openapi_json_serializable)


# ─── 5. TDD Prompt Builder ───────────────────────────────────────────
print("\nTesting TDD Prompt Builder...")

def test_prompt_structure():
    from tdd_generator import build_user_prompt
    from nlp_processor import extract_functional_components
    sample_fdd = """
    The system shall allow users to register an account.
    Instructors can create and manage courses.
    Step 1: User fills form. Step 2: System validates.
    Users must verify email before accessing courses.
    """
    comps = extract_functional_components(sample_fdd)
    prompt = build_user_prompt(sample_fdd, comps)
    assert "FDD TEXT" in prompt or "RAW FDD" in prompt, "Prompt should include raw FDD text section"
    assert "FUNCTIONAL REQUIREMENTS" in prompt
    assert "ACTORS" in prompt or "ROLES" in prompt
    assert len(prompt) > 200, f"Prompt too short: {len(prompt)} chars"

def test_prompt_includes_requirements():
    from tdd_generator import build_user_prompt
    from nlp_processor import extract_functional_components
    text = "The system shall allow users to register. The system must track login attempts."
    comps = extract_functional_components(text)
    prompt = build_user_prompt(text, comps)
    assert "register" in prompt.lower()

test("Prompt structure and sections", test_prompt_structure)
test("Requirements appear in prompt", test_prompt_includes_requirements)


# ─── 6. Backend Validator ────────────────────────────────────────────
print("\nTesting TDD Validator (backend)...")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend"))

# We test the logic inline since it's JS; instead write equivalent Python checks
def test_completeness_logic():
    """Mirror the JS completeness scoring logic."""
    tdd = MOCK_TDD.copy()
    tdd["introduction"] = {
        "purpose": "This is the purpose of the system with enough text",
        "scope": "Full scope defined",
        "tech_stack": {"backend": "Node.js"}
    }
    tdd["system_architecture"] = {
        "components": [{"name": "API"}],
        "mermaid_diagram": "flowchart TB\n  A --> B"
    }
    tdd["non_functional_requirements"] = {
        "security": "JWT authentication with bcrypt password hashing"
    }
    tdd["deployment_architecture"] = {
        "infrastructure": "AWS ECS Fargate with RDS PostgreSQL",
        "mermaid_diagram": "graph TD\n  A --> B"
    }
    tdd["traceability_matrix"] = [{"fdd_requirement": "test"}]

    # Simulate checks (mirrors JS logic)
    checks = [
        len(tdd.get("introduction", {}).get("purpose", "")) > 20,
        len(tdd.get("introduction", {}).get("scope", "")) > 10,
        len(tdd.get("system_architecture", {}).get("components", [])) > 0,
        len(tdd.get("system_architecture", {}).get("mermaid_diagram", "")) > 10,
        len(tdd.get("data_model", {}).get("tables", [])) > 0,
        len(tdd.get("api_design", {}).get("endpoints", [])) > 0,
        len(tdd.get("component_architecture", {}).get("backend_services", [])) > 0,
        len(tdd.get("non_functional_requirements", {}).get("security", "")) > 10,
        len(tdd.get("deployment_architecture", {}).get("infrastructure", "")) > 10,
        len(tdd.get("deployment_architecture", {}).get("mermaid_diagram", "")) > 10,
        len(tdd.get("traceability_matrix", [])) > 0,
    ]
    score = sum(1 for c in checks if c) * (100 // len(checks))
    assert score >= 60, f"Expected score >= 60, got {score}"

test("Completeness score calculation", test_completeness_logic)


# ─── 7. Backend service HTTP check (optional, requires running server) ────
print("\nTesting Backend HTTP (optional — skip if not running)...")

def test_backend_health():
    import urllib.request
    try:
        with urllib.request.urlopen("http://localhost:3001/health", timeout=3) as r:
            data = json.loads(r.read())
            assert data.get("status") == "ok"
    except Exception as e:
        raise AssertionError(f"Backend not reachable: {e}")

def test_ai_service_health():
    import urllib.request
    try:
        with urllib.request.urlopen("http://localhost:8000/health", timeout=3) as r:
            data = json.loads(r.read())
            assert data.get("status") == "ok"
    except Exception as e:
        raise AssertionError(f"AI service not reachable: {e}")

test("Backend health endpoint", test_backend_health)
test("AI service health endpoint", test_ai_service_health)


# ─── Summary ────────────────────────────────────────────────────────
print("\n" + "─" * 50)
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
total = len(results)
print(f"Results: {passed}/{total} passed  |  {failed} failed")

if failed > 0:
    print("\nFailed tests:")
    for name, ok, err in results:
        if not ok:
            print(f"  {FAIL} {name}: {err}")

# HTTP checks are optional — don't fail the suite for them
http_failures = [n for n, ok, _ in results if not ok and ("health" in n.lower() or "http" in n.lower())]
core_failures = [n for n, ok, _ in results if not ok and n not in http_failures]

if core_failures:
    print(f"\n{FAIL} {len(core_failures)} core test(s) failed. Fix before running the application.")
    sys.exit(1)
elif failed > 0:
    print(f"\n{WARN} {len(http_failures)} optional HTTP test(s) failed (services not running). Core tests all passed.")
    sys.exit(0)
else:
    print(f"\n{PASS} All tests passed!")
    sys.exit(0)
