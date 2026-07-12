import hashlib
import jwt
from datetime import datetime, timedelta, timezone
from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRES_DAYS


def sha256_hex(text: str) -> str:
    """เทียบเท่า sha256.convert(utf8.encode(text)).toString() ฝั่ง Dart"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def get_current_date_for_token() -> str:
    """เทียบเท่า dateUtils.getCurrentDateForToken() ฝั่ง Node
    format แบบ dd-MM-yyyy ให้ตรงกับ getFormattedDate ฝั่ง Flutter"""
    now = datetime.now()
    return now.strftime("%d-%m-%Y")


def sign_token(payload: dict) -> str:
    """เทียบเท่า jwt.sign(payload, secretKey, { expiresIn: '1d' })"""
    to_encode = payload.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS)
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict | None:
    """เทียบเท่า jwt.verify(token, secretKey, ...) -> resolve(decoded)/reject(err)"""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None