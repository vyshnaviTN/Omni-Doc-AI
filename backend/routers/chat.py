import uuid
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session
from database.core import SessionLocal, get_db
from database import models
from services.rag_engine import rag_engine
from .auth import get_current_user
import json
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])
NO_RELEVANT_CONTENT_MESSAGE = "No relevant content found in this session"


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id_to_str(cls, v):
        """Handle legacy INTEGER ids from SQLite."""
        return str(v) if not isinstance(v, str) else v


class QueryRequest(BaseModel):
    query: str
    session_id: str  # session_id is MANDATORY for chat isolation


class CreateSessionRequest(BaseModel):
    title: str | None = None


def _normalize_session_id(session_id: str | None) -> str | None:
    if session_id is None:
        return None
    normalized = session_id.strip()
    return normalized or None


def _build_session_title(query: str) -> str:
    title = query.strip()[:50]
    return title or "New Chat"


def _get_owned_session(db: Session, session_id: str, user_id: str) -> models.ChatSession | None:
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        return None
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")
    return session


def _create_session(db: Session, user_id: str, title: str) -> models.ChatSession:
    session = models.ChatSession(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=title,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _resolve_chat_session(
    db: Session,
    current_user: models.User,
    requested_session_id: str | None,
    query: str,
) -> models.ChatSession:
    normalized_session_id = _normalize_session_id(requested_session_id)
    if normalized_session_id:
        session = _get_owned_session(db, normalized_session_id, current_user.id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    # Auto-create a new session if none was provided
    return _create_session(db, current_user.id, _build_session_title(query))


def _session_has_documents(db: Session, session_id: str) -> bool:
    """Check if a session has any completed documents.
    Only checks session_id — no user_id needed since session ownership
    is already verified before calling this."""
    return (
        db.query(models.Document)
        .filter(
            models.Document.session_id == session_id,
            models.Document.status == "completed",
        )
        .count()
        > 0
    )


# ---------------------------------------------------------------------------
# Session CRUD Endpoints
# ---------------------------------------------------------------------------

@router.get("/sessions", response_model=list[ChatSessionResponse])
def get_sessions(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc(), models.ChatSession.created_at.desc())
        .all()
    )


@router.post("/sessions", response_model=ChatSessionResponse)
def create_session(
    request: CreateSessionRequest | None = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = _build_session_title(request.title) if request and request.title else "New Chat"
    return _create_session(db, current_user.id, title)


class RenameSessionRequest(BaseModel):
    title: str

@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
def rename_session(
    session_id: str,
    request: RenameSessionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    title = request.title.strip() if request.title.strip() else "Untitled Session"
    session.title = title
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=list[ChatMessageResponse])
def get_session_messages(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user.id)
    if not session:
        return []

    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )


@router.get("/sessions/{session_id}", response_model=list[ChatMessageResponse])
def get_session_messages_legacy(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_session_messages(session_id=session_id, current_user=current_user, db=db)


# ---------------------------------------------------------------------------
# Chat Query Endpoint (Session-Isolated RAG)
# ---------------------------------------------------------------------------

@router.post("/")
def ask_question(
    request: QueryRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = request.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    started_at = time.perf_counter()
    session = _resolve_chat_session(db, current_user, request.session_id, request.query)
    session_id = session.id

    # Get recent chat history (last 4 messages)
    history_obj = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    chat_history = "\n".join([f"{msg.role}: {msg.content}" for msg in history_obj[-4:]])

    try:
        has_documents = _session_has_documents(db, session_id)
        if not has_documents:
            def empty_session_stream():
                response_text = "No documents uploaded in this session"
                yield {"event": "session", "data": json.dumps({"session_id": session_id})}
                yield {"event": "citations", "data": json.dumps([])}
                yield {"event": "message", "data": json.dumps({"token": response_text, "session_id": session_id})}
                try:
                    persist_fn = _build_persist_chat_messages(session_id, current_user.id)
                    persist_fn(query, response_text, (time.perf_counter() - started_at) * 1000)
                except Exception as e:
                    print(f"Failed to save stream data: {e}")

            return EventSourceResponse(
                empty_session_stream(),
                headers={"X-Session-Id": session_id},
            )

        optimized_query = rag_engine.rewrite_query(query, chat_history)
        chunks = rag_engine.retrieve(
            optimized_query,
            user_id=current_user.id,
            session_id=session_id,
            k=5,
        )

        structured_sources = rag_engine.build_sources(chunks)
        serialized_chunks = [
            {
                "source": c.metadata.get("source"),
                "document": c.metadata.get("source"),
                "page": c.metadata.get("page"),
                "excerpt": c.page_content[:300] if c.page_content else "",
                "chunk_index": c.metadata.get("chunk_index"),
                "document_id": c.metadata.get("document_id"),
                "session_id": c.metadata.get("session_id"),
                "relevance_score": c.metadata.get("relevance_score"),
                "content": c.page_content,
            }
            for c in chunks
        ]

        persist_fn = _build_persist_chat_messages(session_id, current_user.id)

        def stream_generator():
            yield {"event": "session", "data": json.dumps({"session_id": session_id})}
            yield {"event": "citations", "data": json.dumps(serialized_chunks)}
            yield {"event": "sources", "data": json.dumps(structured_sources)}

            if not chunks:
                response_text = NO_RELEVANT_CONTENT_MESSAGE
                yield {"event": "message", "data": json.dumps({"token": response_text, "session_id": session_id})}
                try:
                    persist_fn(query, response_text, (time.perf_counter() - started_at) * 1000)
                except Exception as e:
                    print(f"Failed to save stream data: {e}")
                return

            full_answer = ""
            for token in rag_engine.generate_answer_stream(query, chunks):
                full_answer += token
                yield {"event": "message", "data": json.dumps({"token": token, "session_id": session_id})}

            try:
                persisted_answer = full_answer.strip() or "Not enough information"
                persist_fn(query, persisted_answer, (time.perf_counter() - started_at) * 1000)
            except Exception as e:
                print(f"Failed to save stream data: {e}")

        return EventSourceResponse(
            stream_generator(),
            headers={"X-Session-Id": session_id},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Persistence Helper
# ---------------------------------------------------------------------------

def _build_persist_chat_messages(session_id: str, user_id: str):
    def persist_chat_messages(user_query: str, assistant_response: str, response_time_ms: float | None = None):
        save_db = SessionLocal()
        try:
            save_session = _get_owned_session(save_db, session_id, user_id)
            if not save_session:
                raise ValueError("Chat session no longer exists")

            save_db.add_all(
                [
                    models.ChatMessage(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        role="user",
                        content=user_query,
                    ),
                    models.ChatMessage(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        role="assistant",
                        content=assistant_response,
                    ),
                ]
            )

            save_db.add(
                models.AnalyticsEvent(
                    event_type="query",
                    query_text=user_query,
                    response_time_ms=response_time_ms,
                )
            )
            save_session.updated_at = datetime.utcnow()
            save_db.commit()
        finally:
            save_db.close()
    return persist_chat_messages
