import hashlib
import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def hash_password(password: str) -> str:
    return sha256_hex(password)

def get_current_date_for_token() -> str:
    now = datetime.now()
    return now.strftime("%d-%m-%Y")


def sign_token(payload: dict) -> str:
    to_encode = payload.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expires_days)
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None