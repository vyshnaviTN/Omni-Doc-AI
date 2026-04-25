from services.document_processor import process_file
import sys
try:
    chunks = process_file("test_scan.pdf", "test_scan.pdf", ".pdf")
    print("SUCCESS: Retrieved", len(chunks), "chunks")
    for i, c in enumerate(chunks[:2]):
        print(f"Chunk {i}:", c.page_content)
except Exception as e:
    print("FAILED:", e)
