import re

from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"

_model: SentenceTransformer | None = None


def get_embedder() -> SentenceTransformer:
    """Load the embedding model once and reuse it."""
    global _model

    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)

    return _model


def embed_query(query: str) -> list[float]:
    embedder = get_embedder()
    embedding = embedder.encode(
        "Represent this sentence for searching relevant passages: " + query,
        normalize_embeddings=True,
    )

    return embedding.tolist()


def embed_document(text: str) -> list[float]:
    embedder = get_embedder()
    embedding = embedder.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def build_embedding_text(
    program_name: str, document_name: str, parent_text: str
) -> str:
    """Prefix document text with its program and cleaned document name."""
    doc = re.sub(
        r"\.(docx|pdf)$", "", (document_name or "").strip(), flags=re.IGNORECASE
    )
    prefix = " | ".join(p for p in [(program_name or "").strip(), doc] if p)
    return f"{prefix}\n{parent_text}" if prefix else parent_text
