import os
import uuid
import tempfile
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database.core import get_db
from database import models
from services.document_processor import process_file
from services.rag_engine import rag_engine
from routers.auth import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    extension = os.path.splitext(file.filename)[1].lower()
    db_doc = models.Document(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        filename=file.filename,
        extension=extension,
        status="processing",
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    temp_path = ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=db_doc.extension, mode='wb') as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        chunks = process_file(temp_path, db_doc.filename, db_doc.extension)

        if not chunks:
            db_doc.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted. Make sure it's a valid PDF, TXT, MD, or image.",
            )

        for chunk in chunks:
            chunk.metadata["document_id"] = db_doc.id
            chunk.metadata["source"] = db_doc.filename
            chunk.metadata["user_id"] = current_user.id

        rag_engine.add_documents(chunks)

        db_doc.status = "completed"
        db.commit()

    except HTTPException:
        raise
    except ValueError as ve:
        import traceback; traceback.print_exc()
        db_doc.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback; traceback.print_exc()
        db_doc.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {"id": db_doc.id, "status": "completed", "filename": db_doc.filename}


@router.get("/")
def list_documents(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(models.Document)
        .filter(models.Document.user_id == current_user.id)
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

    db.delete(doc)
    db.commit()
    return {"status": "deleted"}
