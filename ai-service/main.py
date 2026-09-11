"""
FDD to TDD AI Microservice
FastAPI + spaCy + Claude 3.5 Haiku
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import logging

from document_parser import extract_text_from_pdf, extract_text_from_docx, extract_text_from_md
from nlp_processor import extract_functional_components
from tdd_generator import generate_tdd_with_claude
from traceability import build_traceability_matrix
from api_docs_generator import generate_openapi_spec, tdd_to_openapi_json
from diagram_generator import generate_all_diagrams
from rate_limiter import check_rate_limit

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FDD to TDD AI Microservice",
    description="Converts Functional Design Documents to Technical Design Documents using Claude AI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParseRequest(BaseModel):
    file_path: str
    file_type: str  # "pdf", "docx", or "md"


class GenerateTDDRequest(BaseModel):
    extracted_text: str
    document_id: str


class FullPipelineRequest(BaseModel):
    file_path: str
    file_type: str
    document_id: str


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "FDD-to-TDD AI Microservice"}


@app.post("/parse-document")
async def parse_document(req: ParseRequest):
    """Extract raw text from a PDF, DOCX, or Markdown file."""
    try:
        if req.file_type == "pdf":
            text = extract_text_from_pdf(req.file_path)
        elif req.file_type == "docx":
            text = extract_text_from_docx(req.file_path)
        elif req.file_type == "md":
            text = extract_text_from_md(req.file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use 'pdf', 'docx', or 'md'.")

        if not text.strip():
            raise HTTPException(status_code=422, detail="No text could be extracted from the document.")

        return {"success": True, "text": text, "char_count": len(text)}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")
    except Exception as e:
        logger.error(f"Parse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extract-components")
async def extract_components(body: dict):
    """Run NLP pipeline to extract functional components from text."""
    try:
        text = body.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="No text provided.")

        components = extract_functional_components(text)
        return {"success": True, "components": components}

    except Exception as e:
        logger.error(f"NLP extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-tdd")
async def generate_tdd(req: GenerateTDDRequest):
    """Send extracted info to Claude and get structured TDD."""
    check_rate_limit()
    try:
        components = extract_functional_components(req.extracted_text)
        tdd = generate_tdd_with_claude(req.extracted_text, components)
        traceability = build_traceability_matrix(components, tdd)
        tdd["traceability_matrix"] = traceability
        tdd["document_id"] = req.document_id
        return {"success": True, "tdd": tdd}

    except Exception as e:
        logger.error(f"TDD generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/full-pipeline")
async def full_pipeline(req: FullPipelineRequest):
    """
    End-to-end pipeline:
    FDD file → Parse → NLP → Claude → Structured TDD + Traceability
    """
    check_rate_limit()
    try:
        logger.info(f"[Pipeline] Step 1: Parsing document {req.file_path}")
        if req.file_type == "pdf":
            raw_text = extract_text_from_pdf(req.file_path)
        elif req.file_type == "docx":
            raw_text = extract_text_from_docx(req.file_path)
        elif req.file_type == "md":
            raw_text = extract_text_from_md(req.file_path)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use 'pdf', 'docx', or 'md'.")

        if not raw_text.strip():
            raise HTTPException(status_code=422, detail="Empty document.")

        logger.info("[Pipeline] Step 2: Extracting functional components via NLP")
        components = extract_functional_components(raw_text)

        logger.info("[Pipeline] Step 3: Generating TDD via Claude")
        tdd = generate_tdd_with_claude(raw_text, components)

        logger.info("[Pipeline] Step 4: Building traceability matrix")
        traceability = build_traceability_matrix(components, tdd)

        result = {
            "document_id": req.document_id,
            "raw_text_preview": raw_text[:500] + "..." if len(raw_text) > 500 else raw_text,
            "extracted_components": components,
            "tdd": {**tdd, "traceability_matrix": traceability},
            "pipeline_stages": [
                "document_parsed",
                "components_extracted",
                "tdd_generated",
                "traceability_built"
            ]
        }

        return {"success": True, "result": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-diagrams")
async def generate_diagrams(body: dict):
    """
    Generate ER diagram and Sequence diagrams from TDD + extracted components.
    Input: { "tdd": {...}, "components": {...} }
    """
    try:
        tdd = body.get("tdd", {})
        components = body.get("components", {})
        if not tdd:
            raise HTTPException(status_code=400, detail="No 'tdd' provided.")
        diagrams = generate_all_diagrams(tdd, components)
        return {"success": True, "diagrams": diagrams}
    except Exception as e:
        logger.error(f"Diagram generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-completeness-report")
async def generate_completeness_report(body: dict):
    """Run completeness check on a TDD."""
    try:
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../testing"))
        from completeness_checker import run_completeness_check
        tdd = body.get("tdd", {})
        report = run_completeness_check(tdd)
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-traceability-report")
async def generate_traceability_report(body: dict):
    """Run traceability validation on a TDD."""
    try:
        import sys, os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../testing"))
        from traceability_report import run_traceability_report
        tdd = body.get("tdd", {})
        components = body.get("components", {})
        report = run_traceability_report(tdd, components)
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-openapi")
async def generate_openapi(body: dict):
    """
    Generate an OpenAPI 3.0 specification from a TDD JSON object.
    Input: { "tdd": { ...tdd object... } }
    Output: { "openapi_spec": { ...spec... } }
    """
    try:
        tdd = body.get("tdd")
        if not tdd:
            raise HTTPException(status_code=400, detail="No 'tdd' field provided.")
        spec = generate_openapi_spec(tdd)
        return {"success": True, "openapi_spec": spec}
    except Exception as e:
        logger.error(f"OpenAPI generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
