import os
import uuid
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.core import get_db
from database import models
from services.document_processor import process_file
from services.rag_engine import rag_engine
from .auth import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _normalize_session_id(session_id: str | None) -> str | None:
    if session_id is None:
        return None
    normalized = session_id.strip()
    return normalized or None


def _get_owned_session(db: Session, session_id: str, user_id: str) -> models.ChatSession | None:
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
    if not session:
        return None
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied to this session")
    return session


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    normalized_session_id = _normalize_session_id(session_id)
    if not normalized_session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    if not file.filename or not file.filename.strip():
        raise HTTPException(status_code=400, detail="filename is required")

    session = _get_owned_session(db, normalized_session_id, current_user.id)
    if not session:
        raise HTTPException(
            status_code=404, 
            detail="Active session not found or access denied. Please select a different chat or start a new one."
        )

    normalized_filename = os.path.basename(file.filename.strip())
    extension = os.path.splitext(normalized_filename)[1].lower()
    db_doc = models.Document(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        session_id=session.id,
        filename=normalized_filename,
        extension=extension,
        status="processing",
    )
    
    # Save original file persistently for the Preview Overlay
    user_storage_dir = os.path.join(rag_engine.uploads_dir, str(current_user.id))
    os.makedirs(user_storage_dir, exist_ok=True)
    storage_filename = f"{db_doc.id}{extension}"
    storage_path = os.path.join(user_storage_dir, storage_filename)
    
    db_doc.storage_path = storage_path
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    temp_path = ""
    try:
        # Write to both persistent storage and a working temp file
        with open(storage_path, 'wb') as persistent_file:
            content = await file.read()
            persistent_file.write(content)
            
        temp_path = storage_path # Use the persistent path as the working path for processing
        
        from fastapi.concurrency import run_in_threadpool
        chunks = await run_in_threadpool(process_file, temp_path, db_doc.filename, db_doc.extension)

        if not chunks:
            # Cleanup persistent file if it was empty/failed
            if os.path.exists(storage_path):
                os.remove(storage_path)
            db_doc.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted. Make sure it's a valid PDF, TXT, MD, or image.",
            )

        # Stamp session isolation metadata on every chunk
        for chunk in chunks:
            chunk.metadata["document_id"] = db_doc.id
            chunk.metadata["session_id"] = session.id
            chunk.metadata["source"] = db_doc.filename
            chunk.metadata["user_id"] = current_user.id

        rag_engine.add_documents(chunks)

        db_doc.status = "completed"
        session.updated_at = db_doc.uploaded_at
        db.commit()

    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        db_doc.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

    return {
        "id": db_doc.id,
        "status": "completed",
        "filename": db_doc.filename,
        "session_id": session.id,
    }

from fastapi.responses import FileResponse

@router.get("/view/{doc_id}")
async def view_document(
    doc_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Securely serve the original document binary for the preview overlay."""
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not doc.storage_path or not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="Original file not found on disk")
    
    media_type = "application/pdf" if doc.extension == ".pdf" else "application/octet-stream"
    return FileResponse(doc.storage_path, media_type=media_type, filename=doc.filename)


@router.get("/")
def list_documents(
    session_id: str = Query(..., description="Session ID is required to list documents"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List documents for a specific session only.
    session_id is mandatory — no global document listing allowed."""
    normalized_session_id = _normalize_session_id(session_id)
    if not normalized_session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    docs = (
        db.query(models.Document)
        .filter(
            models.Document.user_id == current_user.id,
            models.Document.session_id == normalized_session_id,
        )
        .order_by(models.Document.uploaded_at.desc())
        .all()
    )
    return docs


@router.delete("/{doc_id}")
def delete_document(
    doc_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.user_id and doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Remove all vector embeddings for this document from ChromaDB
    try:
        chroma_collection = rag_engine.db
        existing = chroma_collection.get(where={"document_id": doc_id})
        if existing and existing.get("ids"):
            chroma_collection.delete(ids=existing["ids"])
            print(f"[DELETE] Removed {len(existing['ids'])} vectors for doc {doc_id}")
    except Exception as e:
        # Non-fatal — log but don't block the DB delete
        print(f"[DELETE] ChromaDB cleanup warning for {doc_id}: {e}")

    db.delete(doc)
    db.commit()
    return {"status": "deleted", "id": doc_id}
