import pypdfium2 as pdfium
from PIL import Image

pdf = pdfium.PdfDocument("test_scan3.pdf")
page = pdf[0]
bitmap = page.render(scale=2)
img = bitmap.to_pil()
extrema = img.getextrema()
print("pdfium Extrema:", extrema)
