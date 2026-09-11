"""
api_docs_generator.py
Generates an OpenAPI 3.0 specification (JSON) from a TDD's api_design section.
This enables automatic Swagger UI / Redoc documentation.
"""

import json
from typing import Dict, Any


HTTP_METHOD_TO_STATUS = {
    "GET": {"200": "Successful response"},
    "POST": {"201": "Resource created", "200": "Successful response"},
    "PUT": {"200": "Resource updated"},
    "PATCH": {"200": "Resource patched"},
    "DELETE": {"204": "Resource deleted"},
}

TYPE_HINTS = {
    "id": "string", "uuid": "string", "email": "string",
    "name": "string", "title": "string", "description": "string",
    "status": "string", "type": "string", "url": "string",
    "count": "integer", "total": "integer", "page": "integer",
    "price": "number", "amount": "number", "grade": "number",
    "created_at": "string", "updated_at": "string",
    "is_active": "boolean", "verified": "boolean",
}


def _infer_path_params(path: str) -> list:
    """Extract path parameters like :id or {id} from a path string."""
    import re
    params = []
    # Match :param or {param}
    matches = re.findall(r"[:{](\w+)}?", path)
    for m in matches:
        params.append({
            "name": m,
            "in": "path",
            "required": True,
            "schema": {"type": TYPE_HINTS.get(m, "string")},
            "description": f"The {m} parameter"
        })
    return params


def _normalize_path(path: str) -> str:
    """Convert Express :param style to OpenAPI {param} style."""
    import re
    return re.sub(r":(\w+)", r"{\1}", path)


def _build_request_body(body_desc: str, method: str) -> dict:
    """Build a simple OpenAPI requestBody from a human-readable description."""
    if not body_desc or method in ("GET", "DELETE"):
        return {}
    # Try to detect multipart
    if "multipart" in body_desc.lower() or "file" in body_desc.lower():
        return {
            "requestBody": {
                "required": True,
                "content": {
                    "multipart/form-data": {
                        "schema": {
                            "type": "object",
                            "properties": {
                                "file": {"type": "string", "format": "binary"}
                            }
                        }
                    }
                }
            }
        }

    # Parse { key, key2 } notation
    import re
    keys = re.findall(r"(\w+)\??", body_desc)
    properties = {}
    for key in keys:
        if key.lower() in ("none", "n", "a", "or", "for", "with", "and"):
            continue
        properties[key] = {"type": TYPE_HINTS.get(key.lower(), "string"), "description": key}

    if not properties:
        properties["data"] = {"type": "object"}

    return {
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "properties": properties
                    }
                }
            }
        }
    }


def generate_openapi_spec(tdd: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate an OpenAPI 3.0 spec from a TDD's api_design section.
    Returns the full spec as a Python dict (JSON-serializable).
    """
    api = tdd.get("api_design", {})
    intro = tdd.get("introduction", {})
    tech = intro.get("tech_stack", {})

    base_url = api.get("base_url", "/api/v1")
    auth_desc = api.get("authentication", "JWT Bearer token")

    # Build server URL
    if base_url.startswith("http"):
        servers = [{"url": base_url, "description": "Production"}]
    else:
        servers = [
            {"url": f"http://localhost:3001{base_url}", "description": "Local development"},
            {"url": f"https://api.example.com{base_url}", "description": "Production"},
        ]

    spec = {
        "openapi": "3.0.3",
        "info": {
            "title": "Generated TDD API",
            "version": "1.0.0",
            "description": intro.get("purpose", "Auto-generated from TDD"),
            "contact": {"name": "FDD-TDD Converter", "url": "https://github.com/your-org/fdd-tdd"},
        },
        "servers": servers,
        "components": {
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": auth_desc
                }
            },
            "schemas": _build_schemas_from_data_model(tdd.get("data_model", {}))
        },
        "security": [{"BearerAuth": []}],
        "paths": {}
    }

    # Build paths
    for ep in api.get("endpoints", []):
        raw_path = ep.get("path", "/unknown")
        method = ep.get("method", "GET").lower()
        norm_path = _normalize_path(raw_path)
        description = ep.get("description", "")
        fdd_req = ep.get("fdd_requirement", "")
        response_desc = ep.get("response", "Success")

        if norm_path not in spec["paths"]:
            spec["paths"][norm_path] = {}

        path_params = _infer_path_params(raw_path)
        req_body = _build_request_body(ep.get("request_body", ""), method.upper())

        statuses = HTTP_METHOD_TO_STATUS.get(method.upper(), {"200": "Success"})
        responses = {}
        for status_code, status_desc in statuses.items():
            responses[status_code] = {
                "description": status_desc,
                "content": {
                    "application/json": {
                        "schema": {"type": "object"},
                        "example": {"message": response_desc}
                    }
                }
            }
        responses["400"] = {"description": "Bad request"}
        responses["401"] = {"description": "Unauthorized"}
        responses["500"] = {"description": "Internal server error"}

        operation = {
            "summary": description,
            "description": f"{description}\n\n> **FDD Requirement:** {fdd_req}" if fdd_req else description,
            "parameters": path_params,
            "responses": responses,
            "tags": [_guess_tag(norm_path)]
        }

        if req_body:
            operation["requestBody"] = req_body["requestBody"]

        # Public endpoints don't need auth
        if any(p in norm_path for p in ["/login", "/register", "/webhook", "/health"]):
            operation["security"] = []

        spec["paths"][norm_path][method] = operation

    return spec


def _guess_tag(path: str) -> str:
    """Guess a grouping tag from the path."""
    parts = path.strip("/").split("/")
    if len(parts) >= 2:
        return parts[1].replace("-", " ").title()
    return parts[0].replace("-", " ").title() if parts else "General"


def _build_schemas_from_data_model(data_model: Dict) -> Dict:
    """Build OpenAPI schemas from TDD data model tables."""
    schemas = {}
    for table in data_model.get("tables", []):
        name = table.get("name", "").replace("_", " ").title().replace(" ", "")
        if not name:
            continue
        properties = {}
        required = []
        for col in table.get("columns", []):
            col_name = col.get("name", "")
            col_type = col.get("type", "string").lower()
            constraints = col.get("constraints", "").lower()

            # Map SQL types to JSON Schema types
            json_type = "string"
            json_format = None
            if any(t in col_type for t in ["int", "serial", "bigint"]):
                json_type = "integer"
            elif any(t in col_type for t in ["float", "decimal", "numeric", "real"]):
                json_type = "number"
            elif "bool" in col_type:
                json_type = "boolean"
            elif "uuid" in col_type:
                json_type = "string"
                json_format = "uuid"
            elif "timestamp" in col_type or "date" in col_type:
                json_type = "string"
                json_format = "date-time"

            prop = {"type": json_type, "description": col.get("description", col_name)}
            if json_format:
                prop["format"] = json_format

            properties[col_name] = prop

            if "not null" in constraints and "default" not in constraints:
                required.append(col_name)

        schema = {"type": "object", "properties": properties}
        if required:
            schema["required"] = required

        relationships = table.get("relationships", [])
        if relationships:
            schema["description"] = " | ".join(relationships)

        schemas[name] = schema

    return schemas


def tdd_to_openapi_json(tdd: Dict[str, Any]) -> str:
    """Return OpenAPI spec as a formatted JSON string."""
    spec = generate_openapi_spec(tdd)
    return json.dumps(spec, indent=2)
