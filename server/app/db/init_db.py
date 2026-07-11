from app.db.session import Base, engine
from app.models import role, user, chat_session, document_category, message, document, document_chunk

def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()