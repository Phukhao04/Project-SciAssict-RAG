import json
from sqlalchemy import text
from app.db.session import SessionLocal
from app.utils.embedding import get_embedder, build_embedding_text
from app.utils.ingestion import clean_text

db = SessionLocal()
rows = db.execute(text("""
    SELECT dc.chunk_id, dc.parent_text, d.document_name, p.program_name
    FROM document_chunk dc
    JOIN document d ON d.document_id = dc.document_id
    LEFT JOIN program p ON p.program_id = d.program_id
""")).fetchall()

texts = [
    clean_text(build_embedding_text(r.program_name, r.document_name, r.parent_text))
    for r in rows
]
vecs = get_embedder().encode(texts, normalize_embeddings=True, batch_size=32).tolist()

for r, v in zip(rows, vecs):
    db.execute(
        text("UPDATE document_chunk SET embedding_vector = :v WHERE chunk_id = :id"),
        {"v": json.dumps(v), "id": r.chunk_id},
    )
db.commit()
print(f"re-embed เสร็จ {len(rows)} chunks")