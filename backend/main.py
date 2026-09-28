import os
import time
import uuid
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from parser import PDFParser
from rag import VectorIndex
from llm_service import LLMService

load_dotenv()

app = FastAPI(
    title="Research Paper Analyser Pro API",
    description="Enterprise-grade academic document analysis & conversational RAG engine",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PAPERS_STORE: Dict[str, Dict[str, Any]] = {}

class ChatRequest(BaseModel):
    paper_id: str
    message: str
    history: Optional[List[Dict[str, str]]] = []
    provider: Optional[str] = "gemini"
    model: Optional[str] = "gemini-2.5-flash"
    api_key: Optional[str] = None

class ExportRequest(BaseModel):
    paper_id: str
    chat_history: Optional[List[Dict[str, str]]] = []

def resolve_credentials(header_gemini: Optional[str], header_groq: Optional[str], body_key: Optional[str] = None):
    # Determine which key was sent
    candidate = (body_key or "").strip()
    gemini_key = (header_gemini or os.environ.get("GOOGLE_API_KEY", "")).strip()
    groq_key = (header_groq or os.environ.get("GROQ_API_KEY", "")).strip()

    if candidate:
        if candidate.startswith("gsk_"):
            groq_key = candidate
        else:
            gemini_key = candidate

    return gemini_key, groq_key

@app.get("/api/health")
async def health_check():
    has_gemini = bool(os.environ.get("GOOGLE_API_KEY"))
    has_groq = bool(os.environ.get("GROQ_API_KEY"))
    return {
        "status": "healthy",
        "version": "2.0.0",
        "active_papers_count": len(PAPERS_STORE),
        "keys_configured": {
            "google_gemini": has_gemini,
            "groq": has_groq
        },
        "available_models": [
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash (Ultra Fast & Recommended)", "provider": "gemini"},
            {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro (Deep Reasoning)", "provider": "gemini"},
            {"id": "gemini-flash-latest", "name": "Gemini Flash Latest", "provider": "gemini"},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Groq Fast)", "provider": "groq"}
        ]
    }

@app.post("/api/upload")
async def upload_paper(
    file: UploadFile = File(...),
    x_gemini_key: Optional[str] = Header(None),
    x_groq_key: Optional[str] = Header(None),
    client_api_key: Optional[str] = Form(None)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    paper_id = str(uuid.uuid4())[:8]

    pages_data = PDFParser.extract_text_by_pages(file_bytes)
    if not pages_data or all(len(p["text"]) == 0 for p in pages_data):
        raise HTTPException(status_code=400, detail="Unable to extract text from this PDF.")

    meta = PDFParser.heuristic_paper_metadata(pages_data, file.filename)
    chunks = PDFParser.create_chunks(pages_data, chunk_size=900, chunk_overlap=150)

    gemini_key, groq_key = resolve_credentials(x_gemini_key, x_groq_key, client_api_key)
    vector_index = VectorIndex(chunks, google_api_key=gemini_key)

    llm = LLMService(google_api_key=gemini_key, groq_api_key=groq_key)
    sample_text = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in pages_data[:6]])
    breakdown = llm.analyze_paper(meta, sample_text)

    PAPERS_STORE[paper_id] = {
        "paper_id": paper_id,
        "filename": file.filename,
        "file_size": len(file_bytes),
        "total_pages": len(pages_data),
        "total_chunks": len(chunks),
        "metadata": meta,
        "breakdown": breakdown,
        "chunks": chunks,
        "vector_index": vector_index,
        "uploaded_at": time.time()
    }

    return {
        "paper_id": paper_id,
        "filename": file.filename,
        "total_pages": len(pages_data),
        "total_chunks": len(chunks),
        "breakdown": breakdown
    }

@app.post("/api/chat")
async def chat_with_paper(
    req: ChatRequest,
    x_gemini_key: Optional[str] = Header(None),
    x_groq_key: Optional[str] = Header(None)
):
    if req.paper_id not in PAPERS_STORE:
        raise HTTPException(status_code=404, detail="Paper not found or session expired.")

    paper = PAPERS_STORE[req.paper_id]
    vector_index: VectorIndex = paper["vector_index"]
    start_time = time.time()

    top_chunks = vector_index.query(req.message, top_k=4)
    gemini_key, groq_key = resolve_credentials(x_gemini_key, x_groq_key, req.api_key)

    llm = LLMService(
        google_api_key=gemini_key,
        groq_api_key=groq_key,
        preferred_provider=req.provider or "gemini",
        preferred_model=req.model or "gemini-2.5-flash"
    )

    result = llm.answer_query(
        query=req.message,
        retrieved_chunks=top_chunks,
        conversation_history=req.history,
        model=req.model
    )

    elapsed = round(time.time() - start_time, 2)
    result["response_time"] = elapsed
    result["model_used"] = req.model
    return result

@app.post("/api/export")
async def export_analysis(req: ExportRequest):
    if req.paper_id not in PAPERS_STORE:
        raise HTTPException(status_code=404, detail="Paper not found.")

    paper = PAPERS_STORE[req.paper_id]
    bd = paper["breakdown"]
    title = bd.get("title", paper["filename"])
    
    md_lines = [
        f"# Research Paper Analysis: {title}",
        f"**File:** `{paper['filename']}` | **Pages:** {paper['total_pages']}",
        "",
        "## Executive Summary",
        bd.get("executive_summary", "N/A"),
        "",
        "## Key Contributions & Findings",
    ]
    for contrib in bd.get("key_contributions", []):
        md_lines.append(f"- {contrib}")

    md_lines.extend([
        "",
        "## Methodology & Technical Architecture",
        bd.get("methodology", "N/A"),
        "",
        "## Experimental Results & Benchmarks",
        bd.get("results_and_benchmarks", "N/A"),
        "",
        "## Limitations & Future Work",
        bd.get("limitations", "N/A"),
        "",
        "## BibTeX Citation",
        "```bibtex",
        bd.get("bibtex", ""),
        "```"
    ])

    report_content = "\n".join(md_lines)
    return PlainTextResponse(
        content=report_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=analysis_{req.paper_id}.md"}
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
