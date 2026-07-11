from app.db.session import SessionLocal
from app.utils.ingestion import ingest_document
from app.utils.retrieval import retrieve
from app.utils.llm import generate_answer

db = SessionLocal()

sample_text = """คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่ จัดตั้งขึ้นในปี พ.ศ. 2510
คณะวิทยาศาสตร์ ประกอบด้วย 4 สาขา ได้แก่ วิทยาศาสตร์กายภาพ วิทยาศาสตร์ชีวภาพ วิทยาศาสตร์การคำนวณ และวิทยาศาสตร์สุขภาพและวิทยาศาสตร์ประยุกต์
คณบดี คือ ศาสตราจารย์ ดร.อัญชนา ประเทพ"""

print("=== 1. Ingest ===")
result = ingest_document(
    db,
    full_text=sample_text,
    document_name="ทดสอบข้อมูลคณะ",
    document_type="txt",
    category_id=1,
    user_id=1,
)
print(result)

print("=== 2. Retrieve ===")
chunks = retrieve(db, "คณะวิทย์มีกี่สาขา", k=3)
for c in chunks:
    print(f"[{c.distance:.4f}] {c.chunk_text}")

print("=== 3. Generate (ต้องเปิด Ollama ไว้ก่อน) ===")
answer = generate_answer(db, "คณะวิทย์มีกี่สาขา")
print(answer)

db.close()