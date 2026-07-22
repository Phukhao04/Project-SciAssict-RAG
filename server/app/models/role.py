from sqlalchemy import Column, String
from app.db.session import Base


class Role(Base):
    __tablename__ = "role"

    role_id = Column(String(10), primary_key=True)
    role_name = Column(String(50), nullable=False)