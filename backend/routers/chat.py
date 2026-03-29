import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.core import get_db
from database import models
from services.rag_engine import rag_engine
from routers.auth import get_current_user
import json
from sse_starlette.sse import EventSourceResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/sessions")
def get_sessions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        first_msg = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.session_id == s.id, models.ChatMessage.role == "user")
            .order_by(models.ChatMessage.created_at.asc())
            .first()
        )
        title = first_msg.content[:40] + "..." if first_msg else "New Chat"
        result.append({"id": s.id, "title": title, "updated_at": s.updated_at})
    return result


@router.get("/sessions/{session_id}")
def get_session_messages(
    session_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify ownership
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        return []
    if session.user_id and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    return messages


class QueryRequest(BaseModel):
    query: str
    session_id: str | None = None


@router.post("/")
def ask_question(
    request: QueryRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_id = request.session_id or str(uuid.uuid4())
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()

    if not session:
        session = models.ChatSession(id=session_id, user_id=current_user.id)
        db.add(session)
        db.commit()
        db.refresh(session)
    elif session.user_id and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to this session")

    # Get recent chat history (last 4 messages)
    history_obj = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )
    chat_history = "\n".join([f"{msg.role}: {msg.content}" for msg in history_obj[-4:]])

    try:
        optimized_query = rag_engine.rewrite_query(request.query, chat_history)
        chunks = rag_engine.retrieve(optimized_query, user_id=current_user.id, k=3)
        serialized_chunks = [
            {"source": c.metadata.get("source"), "page": c.metadata.get("page"), "content": c.page_content}
            for c in chunks
        ]

        def stream_generator():
            yield {"event": "citations", "data": json.dumps(serialized_chunks)}

            full_answer = ""
            for token in rag_engine.generate_answer_stream(request.query, chunks):
                full_answer += token
                yield {"event": "message", "data": json.dumps({"token": token, "session_id": session_id})}

            try:
                user_msg = models.ChatMessage(session_id=session_id, role="user", content=request.query)
                ai_msg = models.ChatMessage(session_id=session_id, role="ai", content=full_answer)
                analytics_event = models.AnalyticsEvent(event_type="query", query_text=request.query)
                db.add_all([user_msg, ai_msg, analytics_event])
                db.commit()
            except Exception as e:
                print(f"Failed to save stream data: {e}")

        return EventSourceResponse(stream_generator())

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
