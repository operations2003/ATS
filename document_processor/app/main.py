from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.parse import router as parse_router
from app.routes.evaluate import router as evaluate_router

app = FastAPI(
    title="TaskNera Deterministic ATS & Document Processing Service",
    description="Deterministic ATS Scoring Engine v2.1 with PyMuPDF, spaCy, RapidFuzz, and local embeddings",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_router)
app.include_router(evaluate_router)

@app.on_event("startup")
async def startup_prewarm():
    """Pre-warms AI embedding model on startup so initial evaluations don't experience model-loading delays."""
    try:
        from app.services.ai_matcher import get_embed_model
        print("[Startup] Pre-warming embedding models...")
        get_embed_model()
        print("[Startup] AI embedding model loaded and ready.")
    except Exception as e:
        print(f"[Startup] AI pre-warming notice: {e}")

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "tasknera_ats_engine",
        "health": "/health",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "tasknera_ats_engine",
        "rules_version": "2.1.0",
        "engine": "Deterministic ATS (spaCy + RapidFuzz + PyMuPDF + SentenceTransformers)",
        "llm_calls_permitted": False
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1"
    uvicorn.run("app.main:app", host=host, port=port, reload=not bool(os.environ.get("PORT")))

