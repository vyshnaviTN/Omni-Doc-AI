import PyInstaller.__main__
import os

# Build the FastAPI backend as a single directory (not a single file, to avoid extraction overhead)
# This will output to ./dist/main/
backend_dir = os.path.dirname(os.path.abspath(__file__))
main_script = os.path.join(backend_dir, "main.py")

PyInstaller.__main__.run([
    main_script,
    '--name=omni_backend',
    '--onedir',          # Output as a directory containing the executable and dependencies
    '--noconfirm',       # Overwrite output directory
    '--clean',           # Clean PyInstaller cache
    '--additional-hooks-dir=.', 
    # Add hidden imports frequently missed by PyInstaller for FastAPI / LangChain
    '--hidden-import=uvicorn.logging',
    '--hidden-import=uvicorn.loops',
    '--hidden-import=uvicorn.loops.auto',
    '--hidden-import=uvicorn.protocols',
    '--hidden-import=uvicorn.protocols.http',
    '--hidden-import=uvicorn.protocols.http.auto',
    '--hidden-import=uvicorn.protocols.websockets',
    '--hidden-import=uvicorn.protocols.websockets.auto',
    '--hidden-import=uvicorn.lifespan',
    '--hidden-import=uvicorn.lifespan.on',
    '--hidden-import=langchain_community',
    '--hidden-import=langchain_core',
    '--hidden-import=langchain_chroma',
    '--hidden-import=sentence_transformers',
    '--hidden-import=chromadb',
    '--hidden-import=pydantic',
    '--hidden-import=pypdf',
    '--hidden-import=rank_bm25',
    '--hidden-import=pytesseract',
    '--hidden-import=pdf2image',
    '--hidden-import=PIL',
    '--hidden-import=sse_starlette'
])

print("Backend compilation completed to ./dist/omni_backend")
