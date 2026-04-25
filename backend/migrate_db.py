import sqlite3
from pathlib import Path
import sys

def migrate(db_path):
    if not Path(db_path).exists():
        print(f"DB not found at {db_path}, skipping.")
        return
        
    print(f"Applying migration to {db_path}...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        # Check if session_id already exists
        cur.execute("PRAGMA table_info(documents)")
        columns = [info[1] for info in cur.fetchall()]
        if 'session_id' in columns:
            print(f"session_id column already exists in {db_path}.")
            conn.close()
            return
            
        cur.executescript("""
        PRAGMA foreign_keys=OFF;
        BEGIN TRANSACTION;

        ALTER TABLE documents ADD COLUMN session_id TEXT;
        CREATE INDEX IF NOT EXISTS ix_documents_session_id ON documents(session_id);

        COMMIT;
        PRAGMA foreign_keys=ON;
        """)

        conn.commit()
        print(f"Successfully migrated: {db_path}")
    except Exception as e:
        print(f"Error migrating {db_path}: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    db_paths = [
        r"C:\Users\vaish\AppData\Roaming\Omni-Doc\omni_doc.db",
        r"c:\Users\vaish\OneDrive\Desktop\New folder (3)\omni-doc\backend\omni_doc.db"
    ]
    for p in db_paths:
        migrate(p)
