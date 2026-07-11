"""
Embedding model wrapper
- โหลด SentenceTransformer ครั้งเดียว (singleton) กันโหลดซ้ำทุก request ซึ่งช้ามาก
- ใช้ตอน startup ของ FastAPI (app/main.py) แล้ว inject ไปใช้ใน endpoint อื่น
"""
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"

_model: SentenceTransformer | None = None


def get_embedder() -> SentenceTransformer:
    """คืน instance เดียวที่โหลดไว้แล้ว (lazy singleton)"""
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_text(text: str) -> list[float]:
    """แปลงข้อความเป็น embedding vector (list of float)"""
    embedder = get_embedder()
    return embedder.encode(text).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """แปลงหลายข้อความพร้อมกัน เร็วกว่า loop เรียกทีละอัน"""
    embedder = get_embedder()
    return embedder.encode(texts).tolist()