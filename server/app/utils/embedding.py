"""
Embedding model wrapper
ทำไมต้องเป็น singleton (โหลดครั้งเดียว): โมเดล bge-m3 มีขนาดใหญ่ โหลดใช้เวลาหลายวินาที
ถ้าโหลดใหม่ทุกครั้งที่มี request เข้ามา ระบบจะช้ามากจนใช้งานจริงไม่ได้
"""
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-m3"

_model: SentenceTransformer | None = None


def get_embedder() -> SentenceTransformer:
    """คืน instance เดียวที่โหลดไว้แล้ว ถ้ายังไม่เคยโหลดค่อยโหลด (lazy singleton)"""
    global _model
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def embed_text(text: str) -> list[float]:
    """แปลงข้อความ 1 ชิ้นเป็น embedding vector (list of float ยาว 1024 ตัว)"""
    embedder = get_embedder()
    return embedder.encode(text).tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    """แปลงหลายข้อความพร้อมกัน เร็วกว่าเรียก embed_text() วนลูปทีละอัน"""
    embedder = get_embedder()
    return embedder.encode(texts).tolist()