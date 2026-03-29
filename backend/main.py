import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

load_dotenv()

from database.core import engine
from database import models
from routers import documents, chat, analytics, auth

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Omni-Doc API", description="Enterprise-grade RAG knowledge engine")

# CORS: must allow credentials=True when Authorization header is sent.
# Electron (file://) and Vite dev server (localhost:5173) both need to be listed.
# Using allow_origins=["*"] is incompatible with allow_credentials=True,
# so we explicitly list all expected origins.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    # Electron file:// origin is sent as "null" by the browser
    "null",
    "file://",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(analytics.router)


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
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
