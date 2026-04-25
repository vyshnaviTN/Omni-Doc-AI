import fitz
from PIL import Image

doc = fitz.open("test_scan3.pdf")
pix = doc[0].get_pixmap(dpi=200)
img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
extrema = img.getextrema()
print("Extrema:", extrema)
