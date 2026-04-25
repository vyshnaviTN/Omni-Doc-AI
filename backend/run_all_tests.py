import fitz
import pytesseract
from PIL import Image
import os

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

for filename in ["test_scan.pdf", "test_scan2.pdf", "test_scan3.pdf", "test_blank.pdf", "test_real.pdf"]:
    print(f"\n--- Testing {filename} ---")
    if not os.path.exists(filename):
        print("Not found")
        continue
    try:
        doc = fitz.open(filename)
        page = doc.load_page(0)
        text = page.get_text("text")
        print("Normal text length:", len(text))
        if len(text.strip()) < 10:
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ocr_text = pytesseract.image_to_string(img, lang='eng')
            print("OCR extracted length:", len(ocr_text))
            if len(ocr_text) > 0:
                print("OCR Preview:", repr(ocr_text[:50]))
    except Exception as e:
        print("Error:", e)
