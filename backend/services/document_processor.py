import os
import re
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import pytesseract
from PIL import Image

# Tesseract OCR Configuration for Windows - set unconditionally
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def _clean_text(text: str) -> str:
    """Remove excessive whitespace and repeating symbol noise."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'([^\w\s])\1{3,}', r'\1', text)
    return text.strip()


def _ocr_pdf(file_path: str, filename: str) -> list:
    """Convert PDF pages to images and OCR each one using pdf2image + pytesseract."""
    try:
        from pdf2image import convert_from_path

        # Determine poppler path if bundled
        poppler_path = None
        bundled_poppler = os.path.join(os.path.dirname(__file__), '..', 'poppler', 'bin')
        if os.path.exists(bundled_poppler):
            poppler_path = bundled_poppler

        print(f"OCR fallback triggered for: {filename}")
        images = convert_from_path(file_path, dpi=200, poppler_path=poppler_path)
        docs = []
        for i, img in enumerate(images):
            text = pytesseract.image_to_string(img)
            cleaned = _clean_text(text)
            if cleaned:
                docs.append(Document(page_content=cleaned, metadata={"page": i + 1, "source": filename}))
        return docs
    except Exception as ocr_err:
        print(f"pdf2image OCR failed for {filename}: {ocr_err}. Trying PyMuPDF fallback...")
        return _ocr_pdf_pymupdf(file_path, filename)


def _ocr_pdf_pymupdf(file_path: str, filename: str) -> list:
    """Second-level fallback: use PyMuPDF (fitz) to render pages and OCR them."""
    try:
        import fitz
        doc = fitz.open(file_path)
        docs = []
        for i in range(len(doc)):
            page = doc.load_page(i)
            pix = page.get_pixmap(dpi=200)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(img)
            cleaned = _clean_text(text)
            if cleaned:
                docs.append(Document(page_content=cleaned, metadata={"page": i + 1, "source": filename}))
        return docs
    except Exception as e:
        print(f"PyMuPDF OCR also failed for {filename}: {e}")
        return []


def _load_docx(file_path: str, filename: str) -> list:
    """Parse DOCX using python-docx, preserving paragraph structure."""
    try:
        import docx
        doc = docx.Document(file_path)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        full_text = "\n\n".join(paragraphs)
        cleaned = _clean_text(full_text)
        if not cleaned:
            raise ValueError("No text found in the DOCX document.")
        return [Document(page_content=cleaned, metadata={"page": 1, "source": filename})]
    except ImportError:
        raise ValueError("python-docx not installed. Run: pip install python-docx")
    except Exception as e:
        raise ValueError(f"DOCX parsing failed: {e}")


def process_file(file_path: str, filename: str, extension: str):
    """
    Loads a file, splits it into semantic chunks, and returns them.
    Supported extensions: .pdf, .docx, .txt, .md, .png, .jpg, .jpeg
    """
    documents = []

    try:
        if extension == '.pdf':
            # Step 1: Try standard text extraction
            try:
                loader = PyPDFLoader(file_path)
                documents = loader.load()
            except Exception as pdf_err:
                print(f"PyPDFLoader failed for {filename}: {pdf_err}. Running OCR directly...")
                documents = []

            # Step 2: Check if text was actually extracted
            has_text = any(len(doc.page_content.strip()) > 20 for doc in documents)
            if not documents or not has_text:
                documents = _ocr_pdf(file_path, filename)

            # Step 3: Final safety check
            if not documents:
                raise ValueError(
                    "Could not extract any text from this PDF. "
                    "Ensure Tesseract OCR is installed and the document is readable."
                )

        elif extension == '.docx':
            documents = _load_docx(file_path, filename)

        elif extension == '.txt':
            loader = TextLoader(file_path, encoding='utf-8')
            documents = loader.load()

        elif extension == '.md':
            loader = TextLoader(file_path, encoding='utf-8')
            documents = loader.load()

        elif extension in ['.png', '.jpg', '.jpeg']:
            try:
                img = Image.open(file_path)
                text = pytesseract.image_to_string(img)
                cleaned = _clean_text(text)
                if not cleaned:
                    raise ValueError("No text found in the image.")
                documents = [Document(page_content=cleaned, metadata={"page": 1, "source": filename})]
            except Exception as img_err:
                raise ValueError(f"Image OCR failed: {img_err}")

        else:
            raise ValueError(f"Unsupported file type: {extension}. Supported: PDF, DOCX, TXT, MD, PNG, JPG.")

        # Add filename to metadata and clean all text
        for doc in documents:
            doc.metadata["source"] = filename
            doc.page_content = _clean_text(doc.page_content)

        # Remove empty documents
        documents = [doc for doc in documents if len(doc.page_content.strip()) > 10]

        if not documents:
            raise ValueError("Document was processed but no usable text was found after cleaning.")

        # Semantic Chunking — 500 chars gives better RAG context than 300
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=75,
            length_function=len,
            is_separator_regex=False,
        )

        chunks = text_splitter.split_documents(documents)

        # Stamp chunk_index into metadata for precise citation display
        for i, chunk in enumerate(chunks):
            chunk.metadata["chunk_index"] = i

        print(f"Successfully processed '{filename}': {len(chunks)} chunks created.")
        return chunks

    except Exception as e:
        print(f"Error processing document '{filename}': {str(e)}")
        raise e
