from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .core import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # UUID string
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)  # UUID string
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    filename = Column(String, index=True)
    extension = Column(String)
    storage_path = Column(String, nullable=True)  # Path to persistent PDF binary
    status = Column(String)  # 'processing', 'completed', 'failed'
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="documents")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="chat_sessions")
    documents = relationship("Document", back_populates="session", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    citations = Column(Text, nullable=True)  # JSON serialized source chunks
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String, index=True)  # 'query', 'upload', etc
    query_text = Column(String, nullable=True)
    response_time_ms = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
