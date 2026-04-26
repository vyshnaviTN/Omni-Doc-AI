import base64
from io import BytesIO
from PIL import Image
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage
import time

def test_moondream(image_path, prompt, resize=None):
    img = Image.open(image_path)
    if resize:
        img.thumbnail(resize)
    
    buffered = BytesIO()
    img.save(buffered, format="JPEG", quality=90)
    img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    vision_llm = ChatOllama(model="moondream", temperature=0.0)
    
    message = HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_base64}"}},
        ]
    )
    
    start = time.time()
    res = vision_llm.invoke([message])
    elapsed = time.time() - start
    
    text = res.content.strip()
    print(f"--- Prompt: '{prompt[:30]}...' | Resize: {resize} ---")
    print(f"Extracted {len(text)} chars in {elapsed:.2f}s")
    print(f"Output: {text[:200]}...")
    print("-" * 50)

image_file = "c:/Users/vaish/OneDrive/Desktop/New folder (3)/omni-doc/backend/ocr_verification/1777210791_js-notes-1-10_pdf_page5.png"

prompts = [
    "You are an expert OCR and handwriting recognition assistant. Extract ALL text exactly from this image. Do NOT add notes, headers, or explanations. If the text is handwritten, do your best to transcribe every word accurately.",
    "Extract all text from this image.",
    "Read the document.",
    "What does the text say?"
]

for p in prompts:
    test_moondream(image_file, p)
    test_moondream(image_file, p, resize=(1024, 1024))
