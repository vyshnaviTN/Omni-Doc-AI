import os
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

# Constants
app_data = os.getenv('APPDATA')
if app_data:
    APP_DATA_DIR = os.path.join(app_data, 'Omni-Doc')
else:
    APP_DATA_DIR = os.path.join(os.getcwd(), 'omni_doc_data')

os.makedirs(APP_DATA_DIR, exist_ok=True)
CHROMA_PERSIST_DIR = os.path.join(APP_DATA_DIR, "chroma_db")
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

# Similarity score threshold - lower = more strict (cosine distance)
RELEVANCE_THRESHOLD = 0.55


class RewrittenQuery(BaseModel):
    query: str = Field(description="The improved keyword and semantic search query.")


class RAGEngine:
    def __init__(self):
        # Semantic Caching
        from langchain_core.globals import set_llm_cache
        from langchain_community.cache import SQLiteCache
        cache_path = os.path.join(APP_DATA_DIR, ".langchain.db")
        set_llm_cache(SQLiteCache(database_path=cache_path))

        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        self.db = Chroma(
            collection_name="omni_doc_collection",
            embedding_function=self.embeddings,
            persist_directory=CHROMA_PERSIST_DIR
        )
        self.llm = ChatOllama(
            model="phi",
            temperature=0.1,
            repeat_penalty=1.1,
            num_predict=512,
            stop=["<|endoftext|>", "User:", "<|im_end|>", "Human:"]
        )

    def add_documents(self, chunks):
        """Add semantic chunks to the vector database."""
        if not chunks:
            return
        self.db.add_documents(chunks)

    def rewrite_query(self, query: str, chat_history: str = "") -> str:
        """Return the query directly to avoid an extra LLM call that adds latency."""
        return query.strip()

    def retrieve(self, query: str, user_id: str, k: int = 3):
        """
        Retrieve the most relevant chunks using similarity score filtering.
        Uses cosine distance - lower score means MORE relevant (0=identical, 2=opposite).
        Only returns chunks below the RELEVANCE_THRESHOLD.
        """
        try:
            results = self.db.similarity_search_with_score(query, k=k * 2, filter={"user_id": user_id})

            # Filter by relevance threshold and sort by score (ascending = most relevant first)
            filtered = [(doc, score) for doc, score in results if score <= RELEVANCE_THRESHOLD]
            filtered.sort(key=lambda x: x[1])

            # If nothing passes the threshold, fall back to top-k regardless
            if not filtered:
                print(f"No chunks above threshold {RELEVANCE_THRESHOLD}, falling back to top-{k}")
                filtered = sorted(results, key=lambda x: x[1])

            # Attach score to metadata for transparency
            docs = []
            for doc, score in filtered[:k]:
                doc.metadata["relevance_score"] = round(float(score), 3)
                docs.append(doc)

            return docs
        except Exception as e:
            print(f"Retrieval error: {e}")
            return []

    def generate_answer(self, query: str, chunks):
        """Generate answer grounded in chunks."""
        if not chunks:
            return "I cannot find the answer in the uploaded documents."

        context = ""
        for i, chunk in enumerate(chunks[:3]):
            source = chunk.metadata.get("source", "Unknown Document")
            page = chunk.metadata.get("page", "N/A")
            context += f"[{source} p.{page}]: {chunk.page_content}\n\n"

        prompt = f"""You are Omni-Doc, an AI assistant. Answer ONLY using the context below.
If the answer is not in the context, say: "I cannot find the answer in the uploaded documents."

Context:
{context}

Question: {query}
Answer:"""
        response = self.llm.invoke([HumanMessage(content=prompt)])
        return response.content

    def generate_answer_stream(self, query: str, chunks):
        """Generate streaming answer grounded in chunks."""
        if not chunks:
            yield "I cannot find the answer in the uploaded documents."
            return

        context = ""
        for i, chunk in enumerate(chunks[:3]):
            source = chunk.metadata.get("source", "Unknown Document")
            page = chunk.metadata.get("page", "N/A")
            context += f"[{source} p.{page}]: {chunk.page_content}\n\n"

        prompt = f"""You are Omni-Doc, an AI assistant. Answer ONLY using the context below.
If the answer is not in the context, say: "I cannot find the answer in the uploaded documents."

Context:
{context}

Question: {query}
Answer:"""
        for chunk in self.llm.stream([HumanMessage(content=prompt)]):
            if chunk.content:
                yield chunk.content


# Singleton instance
rag_engine = RAGEngine()
