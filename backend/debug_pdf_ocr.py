import fitz
import pytesseract
from PIL import Image

filename = "test_scan3.pdf"
try:
    doc = fitz.open(filename)
    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=200)
    print("Pixmap attributes:", "width=", pix.width, "height=", pix.height, "n=", pix.n, "alpha=", pix.alpha)
    
    # Let's save the image using PyMuPDF's native save
    pix.save("debug_pixmap.png")
    
    # Then let's save the PIL image
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img.save("debug_pil.png")
    
    print("Saved debug images.")
except Exception as e:
    print("Error:", e)
