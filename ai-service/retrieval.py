"""
Retrieval-augmented context builder.

Replaces blind "first N characters" truncation of the raw FDD text with
similarity-based retrieval: the FDD is split into overlapping chunks, each
chunk and the section's topic query are embedded, and the chunks whose
embeddings are most similar to the query are kept.

No vector database is used — the working set is one document's worth of
chunks (tens, not millions), held in memory only for the lifetime of a
single generation request, so an in-memory numpy similarity search is both
simpler and fast enough. A vector DB (Chroma, Pinecone, ...) would only earn
its keep if chunks needed to persist across requests or scale far beyond a
single document.
"""

import hashlib
import logging
import threading
from collections import OrderedDict
import numpy as np

logger = logging.getLogger(__name__)

_model = None
_model_lock = threading.Lock()

# Chunk embeddings, keyed by a hash of the document text. One generation
# request calls get_relevant_context() 3 times with the SAME raw_text (once
# per tool that uses retrieval) but a different query each time -- without
# this cache, each call would independently re-chunk and re-embed the exact
# same document text, tripling that work for no benefit. Capped size so a
# long-running process doesn't accumulate embeddings for every document it
# has ever seen.
_embedding_cache = OrderedDict()
_embedding_cache_lock = threading.Lock()
_EMBEDDING_CACHE_MAX_ENTRIES = 20


def _get_model():
    """
    Lazily load the embedding model once per process (it's ~90MB).

    Guarded by a lock: the 3 MCP tools that use retrieval now run
    concurrently in a thread pool, so without this, a cold start could have
    all 3 threads see `_model is None` at once and race to load it.
    """
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:  # re-check: another thread may have loaded it while we waited
                from sentence_transformers import SentenceTransformer
                logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
                _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> list:
    """Split text into overlapping fixed-size character chunks."""
    text = text.strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start + chunk_size])
        start += chunk_size - overlap
    return chunks


def _get_chunk_embeddings(raw_text: str, chunks: list):
    """Embed a document's chunks once and reuse across same-document calls."""
    key = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

    with _embedding_cache_lock:
        cached = _embedding_cache.get(key)
        if cached is not None:
            _embedding_cache.move_to_end(key)
            return cached

    model = _get_model()
    chunk_embeddings = model.encode(chunks, convert_to_numpy=True)

    with _embedding_cache_lock:
        _embedding_cache[key] = chunk_embeddings
        _embedding_cache.move_to_end(key)
        while len(_embedding_cache) > _EMBEDDING_CACHE_MAX_ENTRIES:
            _embedding_cache.popitem(last=False)

    return chunk_embeddings


def get_relevant_context(raw_text: str, query: str, top_k: int = 5, max_chars: int = 3000) -> str:
    """
    Return the chunks of raw_text most semantically similar to `query`,
    joined back together, capped at max_chars.

    Falls back to the first max_chars of raw_text if the document is too
    short to chunk meaningfully, or if embedding fails for any reason
    (keeps generation working even if the model can't load).
    """
    chunks = chunk_text(raw_text)
    if len(chunks) <= top_k:
        return raw_text[:max_chars]

    try:
        model = _get_model()
        chunk_embeddings = _get_chunk_embeddings(raw_text, chunks)
        query_embedding = model.encode([query], convert_to_numpy=True)[0]

        # Cosine similarity between the query and every chunk.
        chunk_norms = np.linalg.norm(chunk_embeddings, axis=1)
        query_norm = np.linalg.norm(query_embedding)
        similarities = (chunk_embeddings @ query_embedding) / (chunk_norms * query_norm + 1e-8)

        top_indices = np.argsort(similarities)[::-1][:top_k]
        # Keep retrieved chunks in their original document order for readability.
        ordered_indices = sorted(top_indices)
        relevant = "\n...\n".join(chunks[i] for i in ordered_indices)
        return relevant[:max_chars]

    except Exception as e:
        logger.error(f"Retrieval failed, falling back to truncation: {e}")
        return raw_text[:max_chars]
