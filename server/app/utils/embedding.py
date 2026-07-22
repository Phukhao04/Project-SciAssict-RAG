"""
Embedding model wrapper

โหลด BAAI/bge-m3 เพียงครั้งเดียว (Singleton)
และแยกการสร้าง embedding สำหรับ Query และ Document
เพื่อให้การค้นหา Retrieval มีความแม่นยำมากขึ้น
"""

from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"

_model: SentenceTransformer | None = None


def get_embedder() -> SentenceTransformer:
    """
    โหลดโมเดลครั้งเดียว
    """
    global _model

    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)

    return _model


def embed_query(query: str) -> list[float]:
    """
    สร้าง embedding สำหรับ "คำถาม"

    BGE-M3 แนะนำให้เติม instruction สำหรับ Query
    เพื่อเพิ่มประสิทธิภาพ Retrieval
    """

    embedder = get_embedder()

    embedding = embedder.encode(
        "Represent this sentence for searching relevant passages: " + query,
        normalize_embeddings=True,
    )

    return embedding.tolist()


def embed_document(text: str) -> list[float]:
    """
    สร้าง embedding สำหรับ Document
    """

    embedder = get_embedder()

    embedding = embedder.encode(
        text,
        normalize_embeddings=True,
    )

    return embedding.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """
    ใช้ตอนสร้าง Vector Database

    เร็วกว่าการเรียกทีละข้อความ
    """

    embedder = get_embedder()

    embeddings = embedder.encode(
        texts,
        normalize_embeddings=True,
    )

    return embeddings.tolist()