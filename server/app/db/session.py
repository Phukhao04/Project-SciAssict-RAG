from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

DATABASE_URL = (
    f"mysql+pymysql://{settings.TIDB_USER}:{settings.TIDB_PASSWORD}"
    f"@{settings.TIDB_HOST}:{settings.TIDB_PORT}/{settings.TIDB_DATABASE}"
    f"?ssl_verify_cert=true"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=280)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Yield a database session and close it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
