"""
Document Parser
Extracts raw text from PDF, DOCX, and Markdown files.
"""

import logging

logger = logging.getLogger(__name__)


def extract_text_from_md(file_path: str) -> str:
    """
    Read a Markdown FDD as plain text. Markdown is already plain text, so no
    parsing is needed -- the NLP pipeline and the LLM both work fine with
    the raw '#'/'-'/etc. markup still in place.
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        # Fall back for files saved with a different encoding (e.g. Windows-1252).
        with open(file_path, "r", encoding="latin-1") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Markdown extraction error: {e}")
        raise


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using PyPDF2."""
    try:
        import PyPDF2
        text_parts = []
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {i+1} ---\n{page_text}")
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document
        doc = Document(file_path)
        sections = []

        # Extract paragraphs
        for para in doc.paragraphs:
            if para.text.strip():
                style = para.style.name if para.style else ""
                if "Heading" in style:
                    sections.append(f"\n## {para.text.strip()}\n")
                else:
                    sections.append(para.text.strip())

        # Extract tables
        for i, table in enumerate(doc.tables):
            sections.append(f"\n[Table {i+1}]")
            for row in table.rows:
                row_data = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_data:
                    sections.append(row_data)

        return "\n".join(sections)
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        raise
