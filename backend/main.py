import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

load_dotenv()

from database.core import engine, db_path
from database import models
from routers import documents, chat, analytics, auth
from migrate_chat_ids import ensure_chat_message_ids_are_text

# Create tables
models.Base.metadata.create_all(bind=engine)
ensure_chat_message_ids_are_text(db_path)

app = FastAPI(title="Omni-Doc API", description="Enterprise-grade RAG knowledge engine")

# CORS: JWT is disabled for local testing — use permissive wildcard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(analytics.router)

# Print routes on startup for debugging
@app.on_event("startup")
async def list_routes():
    print("\n--- Omni-Doc Registered Routes ---")
    for route in app.routes:
        methods = getattr(route, 'methods', None)
        print(f"{list(methods) if methods else '---'} {route.path}")
    print("----------------------------------\n")


@app.get("/")
def read_root():
    return {"message": "Welcome to Omni-Doc API"}


@app.get("/health")
def health_check():
    """
    Lightweight health endpoint polled by Electron before opening the window.
    Returns 200 only when the app is fully initialized (DB, routers ready).
    """
    return JSONResponse({"status": "ok", "service": "omni-doc-backend"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    reload_enabled = os.getenv("UVICORN_RELOAD", "true").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload_enabled)
