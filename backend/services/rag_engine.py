import os
import re
import logging
from typing import List, Generator

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_ollama import ChatOllama

logger = logging.getLogger("rag_engine")
logger.setLevel(logging.DEBUG)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[RAG] %(message)s"))
    logger.addHandler(handler)

# ---------------------------------------------------------------------------
# Retrieval Constants
# ---------------------------------------------------------------------------

RETRIEVAL_TOP_K = 5
SIMILARITY_THRESHOLD = 0.65
MAX_CONTEXT_CHUNKS = 5
NO_RELEVANT_CONTENT_MESSAGE = "No relevant content found in this session"
NOT_ENOUGH_INFORMATION_MESSAGE = "Not enough information"


class RagEngine:
    def __init__(self):
        app_data = os.getenv('APPDATA')
        self.app_data_dir = (
            os.path.join(app_data, 'Omni-Doc') if app_data
            else os.path.join(os.getcwd(), 'omni_doc_data')
        )
        os.makedirs(self.app_data_dir, exist_ok=True)
        self.chroma_persist_dir = os.path.join(self.app_data_dir, "chroma_db")
        self.uploads_dir = os.path.join(self.app_data_dir, "uploads")
        os.makedirs(self.chroma_persist_dir, exist_ok=True)
        os.makedirs(self.uploads_dir, exist_ok=True)

        logger.debug("Initializing Embeddings: intfloat/e5-small-v2")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="intfloat/e5-small-v2",
            encode_kwargs={'normalize_embeddings': True}
        )

        logger.debug("Initializing Chroma DB")
        self.db = Chroma(
            persist_directory=self.chroma_persist_dir,
            embedding_function=self.embeddings,
            collection_name="omni_doc_collection"
        )

        model_name = os.getenv("OLLAMA_MODEL", "phi").strip() or "phi"
        logger.debug("Initializing Ollama model: %s", model_name)
        self.llm = ChatOllama(model=model_name, temperature=0.0)

    def add_documents(self, chunks: List[Document]):
        logger.debug(f"Adding {len(chunks)} chunks to Chroma DB")
        self.db.add_documents(chunks)

    def rewrite_query(self, query: str, chat_history: str) -> str:
        if not chat_history.strip():
            return query

        sys_prompt = "You are a query optimizer for a document retrieval system. Rewrite the user's latest query to be fully self-contained, resolving any pronouns or references from the chat history. Provide ONLY the rewritten query text."
        prompt = f"Chat History:\n{chat_history}\n\nUser Query: {query}\n\nRewritten Query:"

        try:
            res = self.llm.invoke([("system", sys_prompt), ("human", prompt)])
            rewritten = res.content.strip()
            rewritten = re.sub(r'^["\']|["\']$', '', rewritten)
            return rewritten if rewritten else query
        except Exception as e:
            logger.warning(f"Query rewrite failed: {e}")
            return query

    def _tokenize(self, text: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[a-zA-Z0-9]+", text.lower())
            if len(token) > 2
        }

    def _split_sentences(self, text: str) -> List[str]:
        parts = re.split(r"(?<=[.!?])\s+|\n+", text)
        return [part.strip() for part in parts if part and part.strip()]

    def _build_extractive_answer(self, query: str, chunks: List[Document]) -> str:
        query_tokens = self._tokenize(query)
        best_sentences: list[tuple[float, str]] = []

        for chunk in chunks:
            for sentence in self._split_sentences(chunk.page_content):
                sentence_tokens = self._tokenize(sentence)
                if not sentence_tokens:
                    continue

                overlap = len(query_tokens & sentence_tokens) if query_tokens else 0
                coverage = overlap / len(query_tokens) if query_tokens else 0
                density = overlap / len(sentence_tokens) if sentence_tokens else 0
                score = max(coverage, density)

                if score <= 0:
                    continue
                best_sentences.append((score, sentence))

        best_sentences.sort(key=lambda item: item[0], reverse=True)
        selected = []
        seen = set()
        for _, sentence in best_sentences:
            normalized = sentence.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            selected.append(sentence)
            if len(selected) >= 6:
                break

        if not selected:
            return NOT_ENOUGH_INFORMATION_MESSAGE

        while len(selected) < 4 and len(selected) < len(best_sentences):
            for _, sentence in best_sentences:
                normalized = sentence.lower()
                if normalized in seen:
                    continue
                seen.add(normalized)
                selected.append(sentence)
                break
            else:
                break

        return "\n".join(selected[:6]).strip()

    def _metadata_matches_filters(
        self,
        metadata: dict | None,
        session_id: str | None = None,
        selected_doc_id: str | None = None,
    ) -> bool:
        metadata = metadata or {}
        if session_id and metadata.get("session_id") != session_id:
            return False
        if selected_doc_id and metadata.get("document_id") != selected_doc_id:
            return False
        return True

    def _normalize_similarity_score(self, raw_score: float) -> float:
        """Chroma returns distance-like scores; convert to a similarity-style score."""
        return max(0.0, 1.0 - float(raw_score))

    def retrieve(
        self,
        query: str,
        user_id: str,
        session_id: str,
        k: int = RETRIEVAL_TOP_K,
        selected_doc_id: str = None,
    ) -> List[Document]:
        """
        Retrieves top k documents for a query, strictly filtered by session_id.
        ONLY chunks where chunk.metadata["session_id"] == current_session_id are returned.
        """
        import time
        start_time = time.time()
        
        logger.debug("Retrieving chunks for query '%s' in session '%s'", query, session_id)

        search_filter = {
            "$and": [
                {"session_id": session_id},
                {"user_id": user_id}
            ]
        }
        if selected_doc_id:
            search_filter["$and"].append({"document_id": selected_doc_id})
            logger.debug("Applying strict filter: document_id == %s", selected_doc_id)

        try:
            results = self.db.similarity_search_with_score(query, k=k, filter=search_filter)
        except Exception as e:
            logger.error(f"Search failed: {e}")
            results = []

        if not results:
            logger.debug("No results found in Chroma.")
            logger.debug("Retrieval time: %.3fs", time.time() - start_time)
            return []

        filtered = []
        for doc, raw_score in results:
            if not self._metadata_matches_filters(doc.metadata, session_id, selected_doc_id):
                logger.debug("Discarded chunk outside session filter from %s", doc.metadata.get("source", ""))
                continue

            similarity_score = self._normalize_similarity_score(raw_score)
            doc.metadata["relevance_score"] = similarity_score
            doc.metadata["raw_score"] = float(raw_score)

            if similarity_score >= SIMILARITY_THRESHOLD:
                filtered.append(doc)
                logger.debug(
                    "Accepted chunk: [raw %.3f | similarity %.3f] from %s",
                    float(raw_score),
                    similarity_score,
                    doc.metadata.get("source", ""),
                )
            else:
                logger.debug(
                    "Discarded weak chunk: [raw %.3f | similarity %.3f] from %s",
                    float(raw_score),
                    similarity_score,
                    doc.metadata.get("source", ""),
                )

        filtered.sort(key=lambda x: x.metadata["relevance_score"], reverse=True)
        logger.debug("Filtered chunks above threshold: %s", len(filtered))

        seen_content = set()
        validated_chunks = []
        for doc in filtered[:k]:
            content_clean = doc.page_content.strip().lower()
            if len(content_clean) > 30 and content_clean not in seen_content:
                validated_chunks.append(doc)
                seen_content.add(content_clean)
            else:
                logger.debug("Removed weak or duplicate chunk during validation.")

        logger.debug("Final selected chunks: %s", len(validated_chunks))
        logger.debug("Retrieval time: %.3fs", time.time() - start_time)
        logger.debug("Chunks retrieved: %s", len(validated_chunks))
        if validated_chunks:
            top_score = validated_chunks[0].metadata.get("relevance_score", 0)
            logger.debug("Top similarity score: %.3f", top_score)
            
        return validated_chunks

    def build_sources(self, chunks: List[Document]) -> list[dict]:
        """Build structured source list from retrieved chunks.
        Returns only unique (document, page) pairs with excerpts."""
        seen = set()
        sources = []
        for chunk in chunks:
            source = chunk.metadata.get("source", "Unknown")
            page = chunk.metadata.get("page", None)
            key = (source, page)
            if key in seen:
                continue
            seen.add(key)

            excerpt = " ".join(chunk.page_content.split())
            if len(excerpt) > 200:
                excerpt = f"{excerpt[:197]}..."

            # Fallback: If document_id is missing, the frontend can try to lookup by source filename
            # or we can pass it as a hint.
            sources.append({
                "source": source,
                "doc_id": chunk.metadata.get("document_id"),
                "source_fallback": source, # Hint for the frontend to lookup ID if needed
                "page": page,
                "content": excerpt,
            })
        return sources

    def generate_answer_stream(self, query: str, chunks: List[Document]) -> Generator[str, None, None]:
        """Stream clean answer tokens. NO source/citation text is appended.
        Sources are delivered separately via the SSE 'citations' event."""
        if not chunks:
            yield NO_RELEVANT_CONTENT_MESSAGE
            return

        context_parts = []
        for i, c in enumerate(chunks[:MAX_CONTEXT_CHUNKS]):
            truncated_content = c.page_content[:900]
            context_parts.append(f"--- Passage {i+1} (Source: {c.metadata.get('source', 'Unknown')}, Page: {c.metadata.get('page', 'N/A')}) ---\n{truncated_content}")

        context_str = "\n\n".join(context_parts)

        sys_prompt = (
            "You are a strict document-based assistant.\n\n"
            "Rules:\n\n"
            "* Answer ONLY using provided context\n"
            "* Use inline citations in the format [1], [2], etc., referring to the Passage number.\n"
            "* Do NOT guess\n"
            "* If unclear -> say 'Not enough information'\n"
            "* Provide complete, clear explanation\n"
            "* Ignore irrelevant chunks"
        )

        prompt = f"Context:\n{context_str}\n\nQuestion:\n{query}\n\nAnswer:"

        logger.debug("Generating streaming answer from LLM")
        try:
            has_content = False
            for chunk in self.llm.stream([("system", sys_prompt), ("human", prompt)]):
                token = chunk.content
                if token:
                    has_content = True
                    yield token

            if not has_content:
                yield NOT_ENOUGH_INFORMATION_MESSAGE

        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield "Sorry, I encountered an error while generating the answer."

rag_engine = RagEngine()
