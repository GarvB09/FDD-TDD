# FDD → TDD Converter

> AI-powered system to automatically convert Functional Design Documents into Technical Design Documents using Claude AI + spaCy NLP.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                    React SPA (port 3000)                        │
│  Upload FDD → View Extracted Components → Generate & View TDD  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────────────────┐
│                  Express Backend (port 3001)                     │
│  POST /api/upload-fdd  │  POST /api/generate-tdd                │
│  GET  /api/tdd/:id     │  GET  /api/tdd/:id/markdown            │
└──────────────┬─────────┴──────────────────────────────────────┘
               │ HTTP (internal)
┌──────────────▼─────────────────────────────────────────────────┐
│              Python FastAPI AI Microservice (port 8000)         │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │ Document     │   │ NLP          │   │  TDD Generator   │   │
│  │ Parser       │──▶│ Processor    │──▶│  (Claude API)    │   │
│  │ PDF / DOCX   │   │ spaCy NER    │   │  claude-haiku-4-5│   │
│  └──────────────┘   └──────────────┘   └──────────────────┘   │
│                              │                      │           │
│                    ┌─────────▼──────────────────────▼──────┐   │
│                    │        Traceability Builder            │   │
│                    │  FDD Requirements → TDD Components     │   │
│                    └───────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Pipeline Flow

```
FDD File (PDF/DOCX)
        │
        ▼
[1] Document Parser        — PyPDF2 / python-docx → raw text
        │
        ▼
[2] NLP Extraction         — spaCy NER + regex patterns
        │                    → requirements, actors, entities,
        │                      workflows, business rules
        ▼
[3] Claude AI Generation   — claude-haiku-4-5-20251001 (200K context)
        │                    → system architecture, data model,
        │                      API design, components, NFRs,
        │                      deployment architecture
        ▼
[4] Traceability Builder   — keyword overlap matching
        │                    → FDD requirement → API + table + component
        ▼
[5] TDD Output             — JSON + Markdown + (optional PDF)
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js** 18+ 
- **Python** 3.10+
- **Anthropic API Key** from https://console.anthropic.com

### 1. Clone and Configure

```bash
git clone <repo-url>
cd fdd-to-tdd

# Copy and fill in your API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Start the AI Service (Python FastAPI)

```bash
cd ai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy language model
python -m spacy download en_core_web_sm

# Start the service
ANTHROPIC_API_KEY=sk-ant-your-key uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: http://localhost:8000/health → `{"status": "ok"}`  
Swagger docs: http://localhost:8000/docs

### 3. Start the Backend (Node.js Express)

```bash
cd backend

# Install dependencies
npm install

# Start (set your API key first)
ANTHROPIC_API_KEY=sk-ant-your-key AI_SERVICE_URL=http://localhost:8000 npm run dev
```

Verify: http://localhost:3001/health → `{"status": "ok"}`

### 4. Start the Frontend (React)

```bash
cd frontend

npm install
REACT_APP_API_URL=http://localhost:3001/api npm start
```

Open: http://localhost:3000

---

## 🐳 Docker Compose (All-in-One)

```bash
# Set your API key
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Build and start everything
docker-compose up --build

# Access
# Frontend:   http://localhost:3000
# Backend:    http://localhost:3001
# AI Service: http://localhost:8000/docs
```

---

## 📁 Project Structure

```
fdd-to-tdd/
├── ai-service/               # Python FastAPI AI microservice
│   ├── main.py               # FastAPI app + endpoints
│   ├── document_parser.py    # PDF/DOCX text extraction
│   ├── nlp_processor.py      # spaCy NER + regex NLP pipeline
│   ├── tdd_generator.py      # Claude API integration + prompts
│   ├── traceability.py       # FDD → TDD mapping
│   ├── requirements.txt
│   └── Dockerfile
│
├── backend/                  # Node.js Express backend
│   ├── server.js             # App entry, middleware setup
│   ├── routes/
│   │   ├── upload.js         # POST /api/upload-fdd
│   │   └── tdd.js            # POST /api/generate-tdd, GET /api/tdd/:id
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                 # React + MUI frontend
│   ├── src/
│   │   ├── App.js            # Root component + stepper state
│   │   └── components/
│   │       ├── PipelineStepper.js    # Step indicator
│   │       ├── UploadStep.js         # File upload with drag & drop
│   │       ├── ExtractedComponents.js # NLP results + Generate button
│   │       └── TDDViewer.js          # Full TDD viewer (8 tabs)
│   ├── public/index.html
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
│
├── uploads/                  # Uploaded FDD files (auto-created)
├── generated_tdd/            # Generated TDD JSON + Markdown files
├── example_fdd.md            # Sample FDD for testing
├── example_tdd_output.json   # Sample expected TDD output
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🔌 API Reference

### AI Microservice (FastAPI — port 8000)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /parse-document | Extract text from PDF/DOCX |
| POST | /extract-components | Run NLP on text |
| POST | /generate-tdd | Full AI TDD generation |
| POST | /full-pipeline | End-to-end single call |

### Backend (Express — port 3001)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/upload-fdd | Upload FDD file (multipart/form-data, field: `fdd`) |
| POST | /api/generate-tdd | Generate TDD from uploaded document |
| GET | /api/tdd/:id | Retrieve previously generated TDD (JSON) |
| GET | /api/tdd/:id/markdown | Retrieve TDD as Markdown |

---

## 🤖 Claude Prompt Design

The system uses a **two-part prompt** strategy:

**System Prompt** — Instructs Claude to act as a senior software architect and mandates strict JSON-only output with a defined schema covering 7 TDD sections.

**User Prompt** — Sends:
- First 3000 characters of raw FDD text
- All extracted NLP components (requirements, actors, entities, workflows, business rules, features, sections)

Claude is instructed to:
1. Derive every TDD component directly from the FDD content
2. Map each API endpoint back to a specific FDD requirement (`fdd_requirement` field)
3. Include valid Mermaid.js diagrams for architecture and deployment
4. Return **only** the JSON object — no markdown fencing, no preamble

---

## 📤 TDD Output Format

Generated TDD contains:

```json
{
  "introduction":              { purpose, scope, assumptions, constraints, tech_stack },
  "system_architecture":       { overview, pattern, components[], mermaid_diagram },
  "data_model":                { database_type, tables[{ columns[], relationships[] }] },
  "api_design":                { base_url, authentication, endpoints[] },
  "component_architecture":    { frontend_components[], backend_services[] },
  "non_functional_requirements": { performance, scalability, security, availability, ... },
  "deployment_architecture":   { infrastructure, ci_cd, monitoring, mermaid_diagram },
  "traceability_matrix":       [{ fdd_requirement, tdd_apis[], tdd_tables[], tdd_components[], coverage }]
}
```

Downloads available as **JSON** and **Markdown** from the TDD Viewer.

---

## 🧪 Testing with the Example FDD

Use `example_fdd.md` (an LMS system FDD) as a test input.  
Convert it to DOCX or copy its content into a `.docx` file, then upload.

Expected output structure is shown in `example_tdd_output.json`.

---

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| `ANTHROPIC_API_KEY not set` | Set `ANTHROPIC_API_KEY` environment variable |
| `spaCy model not found` | Run `python -m spacy download en_core_web_sm` |
| `File not found` when AI service parses | Ensure `uploads/` is a shared volume between backend and AI service |
| JSON parse error from Claude | Claude occasionally wraps response — the code strips fences automatically. Check logs for `raw_response`. |
| Frontend CORS error | Ensure `FRONTEND_URL` in backend matches your React dev server URL |

---

## 📝 License

MIT
#   f d d - t o - t d d n e w  
 