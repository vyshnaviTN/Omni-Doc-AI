import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

app_data = os.getenv('APPDATA')
if app_data:
    db_dir = os.path.join(app_data, 'Omni-Doc')
    os.makedirs(db_dir, exist_ok=True)
    db_path = os.path.join(db_dir, 'omni_doc.db')
else:
    db_path = './omni_doc.db'

SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
