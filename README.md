🚀 Omni-Doc — Offline AI Document Intelligence Engine

An enterprise-grade, fully offline AI system that understands, searches, and answers questions from your documents using Retrieval-Augmented Generation (RAG).

🧠 Overview

Omni-Doc is a powerful AI-driven document assistant that allows users to upload PDFs, images, and handwritten notes, and ask intelligent questions about their content.

Unlike traditional LLM apps, Omni-Doc ensures:

✅ No hallucinations (answers grounded in documents)

✅ Full offline capability (no API keys required)

✅ Source-backed responses with citations

✨ Key Features
📄 Document Intelligence

Upload PDF, TXT, Markdown, and image files

Automatic text extraction and processing

OCR support for handwritten and scanned documents

🤖 AI-Powered Q&A (RAG)

Retrieval-Augmented Generation pipeline

Answers based only on uploaded documents

Multi-document reasoning

🔍 Hybrid Search (Advanced)

Semantic search (vector embeddings)

Keyword search (BM25)

High-accuracy retrieval system

📌 Citations & Source Transparency

Every answer includes:

Document name

Page number

Highlighted source snippet

💬 Chat System with Memory

Persistent chat history

Continue previous conversations

Multi-session support

⚡ Performance Optimizations

Semantic caching

Fast local embeddings (MiniLM)

Optimized chunking and retrieval

🖥️ Fully Offline AI

Runs on local machine using Ollama

No internet required

No API costs

🏗️ Architecture
Frontend (React / Electron)
        ↓
Backend (FastAPI)
        ↓
Vector DB (ChromaDB)
        ↓
Local LLM (Ollama - phi)
🛠️ Tech Stack
Frontend

React (Vite)

CSS / Tailwind (customizable)

Framer Motion (animations)

Backend

FastAPI

LangChain

ChromaDB (Vector DB)

AI & ML

Ollama (Local LLM - phi)

Sentence Transformers (Embeddings)

Tesseract OCR (Handwritten text recognition)

Desktop App

Electron (Offline packaging)

⚙️ Installation & Setup (Windows)
1️⃣ Clone Repository
git clone https://github.com/your-username/omni-doc.git
cd omni-doc
2️⃣ Install Ollama

Download and install Ollama:
👉 https://ollama.com

Run model:

ollama run phi
3️⃣ Backend Setup
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
4️⃣ Frontend Setup
cd frontend
npm install
npm run dev

Open:

http://localhost:5173
🧪 Usage

Upload a document (PDF/Image)

Ask questions like:

“Summarize this document”

“What is finance?”

View answers with citations and sources

📊 Future Enhancements

🔄 Streaming responses

🧠 Query rewriting

📈 Analytics dashboard

🔐 Authentication system

☁️ Cloud + Offline hybrid mode
