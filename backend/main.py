import os
import time
import uuid
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from parser import PDFParser
from rag import VectorIndex
from llm_service import LLMService

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Research Paper Analyser Pro API",
    description="Enterprise-grade academic document analysis & conversational RAG engine",
    version="2.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory document store
PAPERS_STORE: Dict[str, Dict[str, Any]] = {}

# --- Request / Response Models ---

class ChatRequest(BaseModel):
    paper_id: str
    message: str
    history: Optional[List[Dict[str, str]]] = []
    provider: Optional[str] = "gemini"
    model: Optional[str] = "gemini-1.5-flash"
    api_key: Optional[str] = None

class ExportRequest(BaseModel):
    paper_id: str
    chat_history: Optional[List[Dict[str, str]]] = []

# --- Helper Functions ---

def get_effective_keys(header_gemini: Optional[str], header_groq: Optional[str], body_key: Optional[str] = None):
    gemini_key = body_key or header_gemini or os.environ.get("GOOGLE_API_KEY", "")
    groq_key = body_key or header_groq or os.environ.get("GROQ_API_KEY", "")
    return gemini_key.strip(), groq_key.strip()

# --- API Endpoints ---

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
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Ultra Fast)", "provider": "gemini"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Deep Reasoning)", "provider": "gemini"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Next-Gen)", "provider": "gemini"},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Groq Fast)", "provider": "groq"},
            {"id": "llama3-8b-8192", "name": "Llama 3 8B (Groq Instant)", "provider": "groq"}
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

    # 1. Parse PDF pages
    pages_data = PDFParser.extract_text_by_pages(file_bytes)
    if not pages_data or all(len(p["text"]) == 0 for p in pages_data):
        raise HTTPException(status_code=400, detail="Unable to extract text from this PDF. It may be scanned or empty.")

    # 2. Heuristic metadata detection
    meta = PDFParser.heuristic_paper_metadata(pages_data, file.filename)
    
    # 3. Create semantic chunks with page tracking
    chunks = PDFParser.create_chunks(pages_data, chunk_size=900, chunk_overlap=150)

    # 4. Resolve API Keys
    gemini_key, groq_key = get_effective_keys(x_gemini_key, x_groq_key, client_api_key)

    # 5. Build Vector Index
    vector_index = VectorIndex(chunks, google_api_key=gemini_key)

    # 6. Deep Paper Breakdown
    llm = LLMService(google_api_key=gemini_key, groq_api_key=groq_key)
    sample_text = "\n\n".join([f"--- Page {p['page']} ---\n{p['text']}" for p in pages_data[:6]])
    breakdown = llm.analyze_paper(meta, sample_text)

    # Store in memory
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

@app.get("/api/papers")
async def list_papers():
    return [
        {
            "paper_id": p["paper_id"],
            "filename": p["filename"],
            "title": p["breakdown"].get("title", p["filename"]),
            "total_pages": p["total_pages"],
            "uploaded_at": p["uploaded_at"]
        }
        for p in PAPERS_STORE.values()
    ]

@app.get("/api/paper/{paper_id}")
async def get_paper(paper_id: str):
    if paper_id not in PAPERS_STORE:
        raise HTTPException(status_code=404, detail="Paper not found.")
    p = PAPERS_STORE[paper_id]
    return {
        "paper_id": p["paper_id"],
        "filename": p["filename"],
        "total_pages": p["total_pages"],
        "total_chunks": p["total_chunks"],
        "breakdown": p["breakdown"]
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

    # 1. Retrieve top relevant chunks
    top_chunks = vector_index.query(req.message, top_k=4)

    # 2. Resolve keys
    gemini_key, groq_key = get_effective_keys(x_gemini_key, x_groq_key, req.api_key)

    # 3. LLM answer synthesis
    llm = LLMService(
        google_api_key=gemini_key,
        groq_api_key=groq_key,
        preferred_provider=req.provider or "gemini",
        preferred_model=req.model or "gemini-1.5-flash"
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
    
    # Generate clean Markdown report
    md_lines = [
        f"# Research Paper Analysis: {title}",
        f"**File:** `{paper['filename']}` | **Pages:** {paper['total_pages']} | **Exported:** {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## 📌 Executive Summary",
        bd.get("executive_summary", "N/A"),
        "",
        "## 💡 Key Contributions & Findings",
    ]
    for contrib in bd.get("key_contributions", []):
        md_lines.append(f"- {contrib}")

    md_lines.extend([
        "",
        "## ⚙️ Methodology & Technical Architecture",
        bd.get("methodology", "N/A"),
        "",
        "## 📊 Experimental Results & Benchmarks",
        bd.get("results_and_benchmarks", "N/A"),
        "",
        "## ⚠️ Limitations & Future Work",
        bd.get("limitations", "N/A"),
        "",
        "## 📚 BibTeX Citation",
        "```bibtex",
        bd.get("bibtex", "@article{paper,\n  title={Paper}\n}"),
        "```"
    ])

    if req.chat_history:
        md_lines.extend([
            "",
            "## 💬 Interactive Q&A Transcript",
            ""
        ])
        for msg in req.chat_history:
            role = msg.get("role", "user").capitalize()
            md_lines.append(f"**{role}:** {msg.get('content', '')}\n")

    report_content = "\n".join(md_lines)
    return PlainTextResponse(
        content=report_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=analysis_{req.paper_id}.md"}
    )

@app.delete("/api/paper/{paper_id}")
async def delete_paper(paper_id: str):
    if paper_id in PAPERS_STORE:
        del PAPERS_STORE[paper_id]
        return {"status": "success", "message": f"Paper {paper_id} removed."}
    return {"status": "not_found"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
