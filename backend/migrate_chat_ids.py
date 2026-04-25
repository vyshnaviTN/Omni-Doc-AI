"""
Migration: Convert chat_messages.id from INTEGER to TEXT (UUID).

This fixes the Pydantic validation error where ChatMessageResponse expects
id: str but the DB returns an integer.

Strategy: Recreate the table with TEXT id, copy data with str() conversion.
"""
import sqlite3
import uuid
import os
from pathlib import Path


def migrate(db_path: str):
    if not Path(db_path).exists():
        print(f"DB not found at {db_path}, skipping.")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    try:
        # Check current id column type
        cur.execute("PRAGMA table_info(chat_messages)")
        columns = cur.fetchall()
        if not columns:
            print(f"chat_messages table does not exist in {db_path}, skipping.")
            conn.close()
            return

        id_col = next((c for c in columns if c[1] == "id"), None)
        if not id_col:
            print(f"No 'id' column found in chat_messages at {db_path}, skipping.")
            conn.close()
            return

        declared_type = (id_col[2] or "").upper()
        if "INT" not in declared_type:
            print(f"chat_messages.id is already TEXT/VARCHAR in {db_path}, no migration needed.")
            conn.close()
            return

        print(f"Migrating chat_messages.id INTEGER → TEXT in {db_path}...")

        cur.executescript("""
        PRAGMA foreign_keys=OFF;
        BEGIN TRANSACTION;

        CREATE TABLE IF NOT EXISTS chat_messages_new (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        );

        COMMIT;
        PRAGMA foreign_keys=ON;
        """)

        # Copy existing rows, converting integer id to uuid string
        cur.execute("SELECT id, session_id, role, content, created_at FROM chat_messages")
        rows = cur.fetchall()
        for row in rows:
            old_id, session_id, role, content, created_at = row
            new_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO chat_messages_new (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (new_id, session_id, role, content, created_at),
            )

        cur.executescript("""
        PRAGMA foreign_keys=OFF;
        BEGIN TRANSACTION;

        DROP TABLE chat_messages;
        ALTER TABLE chat_messages_new RENAME TO chat_messages;
        CREATE INDEX IF NOT EXISTS ix_chat_messages_id ON chat_messages(id);
        CREATE INDEX IF NOT EXISTS ix_chat_messages_session_id ON chat_messages(session_id);

        COMMIT;
        PRAGMA foreign_keys=ON;
        """)

        conn.commit()
        print(f"Successfully migrated {len(rows)} messages in {db_path}")

    except Exception as e:
        print(f"Error migrating {db_path}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()


def ensure_chat_message_ids_are_text(db_path: str):
    if not Path(db_path).exists():
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA table_info(chat_messages)")
        columns = cur.fetchall()
        if not columns:
            return

        id_col = next((c for c in columns if c[1] == "id"), None)
        if not id_col:
            return

        declared_type = (id_col[2] or "").upper()
        if "INT" in declared_type:
            conn.close()
            migrate(db_path)
            return
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    app_data = os.getenv("APPDATA")
    db_paths = []

    if app_data:
        db_paths.append(os.path.join(app_data, "Omni-Doc", "omni_doc.db"))

    db_paths.append(
        r"c:\Users\vaish\OneDrive\Desktop\New folder (3)\omni-doc\backend\omni_doc.db"
    )

    for p in db_paths:
        migrate(p)
