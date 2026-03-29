import pytesseract
try:
    print("Tesseract Version:", pytesseract.get_tesseract_version())
except Exception as e:
    print("Tesseract Error:", e)
