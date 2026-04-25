import os
import uuid
from datetime import datetime, timedelta
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel
from jose import JWTError, jwt
from database.core import get_db
from database import models

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Config — reads from .env via load_dotenv() in main.py
SECRET_KEY = os.getenv("SECRET_KEY", "omni-doc-fallback-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    email: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _get_or_create_user_by_email(
    db: Session,
    email: str,
    default_password: str = "localtest",
) -> models.User:
    normalized_email = email.strip().lower()
    user = db.query(models.User).filter(models.User.email == normalized_email).first()
    if not user:
        user = models.User(
            id=str(uuid.uuid4()),
            email=normalized_email,
            hashed_password=hash_password(default_password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _get_or_create_local_user(db: Session) -> models.User:
    """Return a fallback local user for testing without JWT."""
    return _get_or_create_user_by_email(db, "local@test", default_password="localtest")


def get_accessible_user_ids(db: Session, current_user: models.User) -> list[str]:
    accessible_ids = [current_user.id]

    current_doc_count = (
        db.query(models.Document)
        .filter(models.Document.user_id == current_user.id)
        .count()
    )

    if current_doc_count == 0 and current_user.email != "local@test":
        local_user = db.query(models.User).filter(models.User.email == "local@test").first()
        if local_user:
            local_doc_count = (
                db.query(models.Document)
                .filter(models.Document.user_id == local_user.id)
                .count()
            )
            if local_doc_count > 0:
                accessible_ids.append(local_user.id)

    return accessible_ids


def _get_user_from_header(request: Request, db: Session) -> models.User | None:
    header_email = request.headers.get("X-User-Email")
    if not header_email or not header_email.strip():
        return None
    return _get_or_create_user_by_email(db, header_email)


def _get_user_from_token(token: str | None, db: Session) -> models.User | None:
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except JWTError:
        return None

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        return None
    return user


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    token_user = _get_user_from_token(token, db)
    if token_user:
        return token_user

    header_user = _get_user_from_header(request, db)
    if header_user:
        return header_user

    # --- DEV BYPASS: allow unauthenticated access for local testing ---
    return _get_or_create_local_user(db)


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # Check if email exists
    existing = db.query(models.User).filter(models.User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = models.User(
        id=str(uuid.uuid4()),
        email=request.email,
        hashed_password=hash_password(request.password)
    )
    db.add(user)
    db.commit()

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "email": user.email}


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "email": user.email}


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "created_at": current_user.created_at}
