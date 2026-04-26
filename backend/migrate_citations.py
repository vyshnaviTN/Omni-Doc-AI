import sqlite3
from pathlib import Path

def migrate(db_path):
    if not Path(db_path).exists():
        print(f"DB not found at {db_path}, skipping.")
        return
        
    print(f"Applying citation migration to {db_path}...")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    try:
        cur.execute("PRAGMA table_info(chat_messages)")
        columns = [info[1] for info in cur.fetchall()]
        if 'citations' in columns:
            print(f"citations column already exists in {db_path}.")
            conn.close()
            return
            
        cur.execute("ALTER TABLE chat_messages ADD COLUMN citations TEXT;")
        conn.commit()
        print(f"Successfully added citations column to: {db_path}")
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
