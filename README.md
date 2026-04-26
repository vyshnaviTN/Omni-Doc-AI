# 🚀 Omni-Doc AI
### *The Ultimate Offline Document Intelligence Engine*

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Offline%20LLM-white?style=for-the-badge&logo=ollama)](https://ollama.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-Vector%20Storage-orange?style=for-the-badge&logo=chroma)](https://www.trychroma.com/)

An enterprise-grade, **fully offline** AI system designed to understand, search, and answer complex questions from your documents using a high-precision Retrieval-Augmented Generation (RAG) pipeline.

---

## 🏗️ System Architecture

Omni-Doc uses a multi-layered architecture designed for speed, privacy, and accuracy.

```mermaid
graph TD
    subgraph Frontend [React / Electron Desktop]
        UI[Chat Interface] --> DP[PDF Inspector / Viewer]
        UI --> US[Upload System]
    end

    subgraph Backend [FastAPI Service]
        US --> DP_SRV[Document Processor]
        DP_SRV --> OCR[VLM OCR - Moondream]
        OCR --> CHK[Semantic Chunking]
        CHK --> EMB[E5-Small Embeddings]
        EMB --> VDB[(ChromaDB)]
        
        UI --> QRY[Query Rewriter]
        QRY --> RET[Hybrid Retriever]
        RET --> VDB
        RET --> LLM[Ollama - Mistral/Phi]
        LLM --> UI
    end

    subgraph Storage [Local Storage]
        VDB --> DISK[Encrypted Local Disk]
        DP_SRV --> FILES[Original PDF Storage]
    end
```

---

## ✨ Standout Features

### 🔍 Integrated Document Inspector
Unlike generic chat apps, Omni-Doc provides a **synchronized dual-pane view**. When the AI cites a source, you can click the citation to open the exact PDF page in the integrated inspector, complete with page-specific navigation.

### 🧠 VLM-Powered OCR (Vision Language Model)
We don't just use standard OCR. Omni-Doc implements a **3-strip horizontal slicing strategy** using `moondream` via Ollama. This allows the system to process dense, handwritten notes and complex layouts that traditional OCR often misses.

### 🔐 Secure Session Isolation
Every chat session is a private workspace. Documents uploaded to "Session A" are never visible or retrievable in "Session B," ensuring perfect multi-tenant privacy on your local machine.

### ⚡ Hybrid Search Performance
- **Semantic Search**: Vector embeddings for conceptual understanding.
- **BM25 Keyword Search**: High-precision term matching.
- **Query Rewriting**: The AI refines your questions to improve search results.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, Framer Motion, Lucide Icons.
- **Desktop Engine**: Vite + Electron (for native offline experience).
- **Backend API**: FastAPI (Python 3.11+).
- **RAG Orchestration**: LangChain & ChromaDB.
- **AI Models**: 
  - **LLM**: `Mistral` / `Phi-3` (via Ollama).
  - **VLM**: `Moondream2` (for high-accuracy OCR).
  - **Embeddings**: `intfloat/e5-small-v2` (Local).

---

## ⚙️ Installation & Setup (Windows)

### 1️⃣ Prepare AI Models (Ollama)
Download and install [Ollama](https://ollama.com). Then, pull the required models:
```powershell
ollama pull phi
ollama pull moondream
```

### 2️⃣ Backend Configuration
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Copy .env.example to .env and configure local paths
python main.py
```

### 3️⃣ Frontend Development
```bash
cd frontend
npm install
npm run dev
```

---

## 📈 Data Flow Lifecycle

1. **Ingestion**: File is sliced into strips -> VLM extracts text -> Recursive chunking.
2. **Indexing**: Chunks are embedded into 384-dimensional vectors -> Saved to ChromaDB with metadata (Page #, Source ID).
3. **Retrieval**: User query is rewritten -> Hybrid search finds top 5 relevant chunks -> Context is pruned.
4. **Generation**: LLM generates answer with `[N]` citations based *only* on retrieved context.

---

## 📊 Roadmap
- [x] Streaming LLM Responses
- [x] Integrated PDF Page Viewer
- [x] VLM-based OCR Fallback
- [ ] Multi-Modal Image Chat
- [ ] Exportable Research Reports
- [ ] Dark Mode UI Theme

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

**Built with ❤️ for Privacy and Intelligence.**
