from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class User(Base):
    __tablename__ = "user"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(255), nullable=False)  # เก็บ bcrypt hash
    email = Column(String(255), unique=True, nullable=False)
    role_id = Column(String(10), ForeignKey("role.role_id"), nullable=False)
    firstname = Column(String(100))
    lastname = Column(String(100))

    role = relationship("Role")