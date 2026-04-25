import pytesseract
from PIL import Image

try:
    print("Testing basic Tesseract installation")
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    img = Image.new('RGB', (100, 100), color = 'white')
    text = pytesseract.image_to_string(img, lang='eng')
    print("Tesseract works! Output:", repr(text))
except Exception as e:
    print("Tesseract failed:", e)

try:
    import fitz
    print("PyMuPDF works!")
    doc = fitz.open("test_scan.pdf")
    print("Pages:", len(doc))
    page = doc.load_page(0)
    text = page.get_text("text")
    print("Text extracted:", len(text))
    if len(text.strip()) < 10:
        print("Empty text, meaning this represents a scanned PDF")
        pix = page.get_pixmap(dpi=200)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        ocr_text = pytesseract.image_to_string(img, lang='eng')
        print("OCR extracted:", len(ocr_text))
except Exception as e:
    print("Error:", e)
