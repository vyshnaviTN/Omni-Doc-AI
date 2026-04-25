from services.document_processor import process_file
import sys
import logging
logging.basicConfig(level=logging.DEBUG)

print("Starting tests...")
try:
    print("Testing test_scan.pdf")
    chunks = process_file("test_scan.pdf", "test_scan.pdf", ".pdf")
    print("SUCCESS: Retrieved", len(chunks), "chunks")
    for i, c in enumerate(chunks[:2]):
        print(f"Chunk {i}:", c.page_content)
except Exception as e:
    print("FAILED test_scan.pdf:", e)

try:
    print("Testing test_real.pdf")
    chunks = process_file("test_real.pdf", "test_real.pdf", ".pdf")
    print("SUCCESS: Retrieved", len(chunks), "chunks")
except Exception as e:
    print("FAILED test_real.pdf:", e)
