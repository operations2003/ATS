# ATS TaskNera Document Intelligence & Deterministic Scoring Service

High-performance Python microservice built with **FastAPI**, **PyMuPDF**, **spaCy**, **RapidFuzz**, and **SentenceTransformers** for document parsing, resume extraction, and deterministic ATS candidate scoring.

---

## 🚀 Core Capabilities

### 1. 📄 Multi-Format Document Parsing
- **PDF Extraction**:
  - High-speed vector text parsing via **PyMuPDF (`fitz`)**.
  - Structured tabular layout extraction via **`pdfplumber`**.
  - Automatic fallback to **Tesseract OCR (`pytesseract` + `pdf2image`)** for scanned or flattened documents.
- **Microsoft Word Parsing**:
  - Native XML parsing via **`python-docx`** preserving document structure and tables.
- **Plain Text Processing**:
  - Clean encoding normalization for UTF-8/ASCII text resumes.
- **Candidate Entity Extraction**:
  - Contact identification: Full name, email address, phone numbers.
  - Skill inventory mapped against `taxonomy.json`.
  - Chronological work experience & cumulative years calculation.
  - Education history (degrees, institutions, graduation years).
  - Past employers and company histories.

---

### 2. 🎯 Deterministic ATS Scoring Engine
- **Repeatable & Verifiable**:
  - Guaranteed byte-identical score reproducibility across independent runs.
  - Generates SHA-256 audit hashes for every evaluation run to eliminate scoring drift.
- **Weighted Criteria Evaluation**:
  - Mandatory "knockout" criteria handling (`FULLY_MET`, `PARTIALLY_MET`, `NOT_MET`).
  - Core technical and functional skill scoring.
  - Preferred criteria bonuses.
  - Minimum experience threshold enforcement.
- **Evidence Citation**:
  - Pulls exact verbatim snippets from candidate resumes as proof for each criterion.
- **Human-in-the-Loop Override Ledger**:
  - Auditable override tracking allowing recruiters to adjust criterion match statuses with notes.

---

### 3. 🧠 Local AI Semantic Matching
- **Local Embeddings**:
  - Integrated sentence-transformers embedding pipeline for semantic similarity.
  - Pre-warmed during application startup (`@app.on_event("startup")`) for low latency.
- **Hallucination-Free JD Requirement Extraction**:
  - Automatically breaks unstructured Job Description text into structured criteria.
  - Strict guardrails: Inferred requirements default to `is_mandatory=False`.

---

## 🏛️ Directory Structure

```plaintext
document_processor/
├── requirements.txt            # Python dependencies
├── app/
│   ├── main.py                 # FastAPI application entrypoint & startup hooks
│   ├── config/
│   │   ├── heading_synonyms.json # Section heading synonyms for resume parsing
│   │   └── taxonomy.json       # Canonical skill taxonomy and aliases
│   ├── models/
│   │   └── schemas.py          # Pydantic request & response data models
│   ├── routes/
│   │   ├── parse.py            # /parse-document & /parse-documents endpoints
│   │   └── evaluate.py         # /evaluate, /evaluate-ai, /verify-score, /recruiter-override
│   ├── services/
│   │   ├── ai_assistance.py    # JD requirement extraction & inference
│   │   ├── ai_matcher.py       # SentenceTransformers semantic matching
│   │   ├── document_analyzer.py# Layout and section analyzer
│   │   ├── docx_parser.py      # Word document extraction
│   │   ├── matcher.py          # RapidFuzz fuzzy keyword matching
│   │   ├── normalizer.py       # Text and entity normalizers
│   │   ├── ocr.py              # Tesseract OCR pipeline
│   │   ├── pdf_parser.py       # PyMuPDF & pdfplumber pipeline
│   │   ├── scoring_engine.py   # Deterministic evaluation logic & audit hashing
│   │   ├── spacy_pipeline.py   # Linguistic tokenization and NLP pipeline
│   │   ├── table_extractor.py  # Tabular data extractor
│   │   ├── template_explainer.py # Explanation generation
│   │   ├── text_cleaner.py     # Whitespace and formatting cleaners
│   │   └── txt_parser.py       # Plain text parser
│   └── utils/
│       └── file_utils.py       # File extension & MIME type detection
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root service status and documentation link |
| `GET` | `/health` | Health check verifying engine version and rules |
| `POST` | `/parse-document` | Upload a single CV/JD (multipart) for parsing & entity extraction |
| `POST` | `/parse-documents` | Batch upload multiple CVs with isolated failure recovery |
| `POST` | `/evaluate` | Rule-based deterministic candidate-to-job scoring |
| `POST` | `/evaluate-ai` | Semantic AI embedding scoring with resume evidence citations |
| `POST` | `/parse-jd-ai` | Extract structured criteria and skill requirements from JD text |
| `POST` | `/verify-score` | Re-run scoring twice to verify byte-identical SHA-256 hash match |
| `POST` | `/recruiter-override` | Record recruiter adjustments with auditable justification notes |

---

## 🛠️ Getting Started

### Prerequisites
- **Python 3.10+**
- (Optional, for scanned PDF OCR) **Tesseract OCR** installed on the host system:
  - Windows: [UB-Mannheim Tesseract installer](https://github.com/UB-Mannheim/tesseract/wiki)
  - Ubuntu/Debian: `sudo apt-get install -y tesseract-ocr`
  - macOS: `brew install tesseract`

### 1. Virtual Environment Setup

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\activate
```

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Microservice
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The service will be accessible at:
- **API Base**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
