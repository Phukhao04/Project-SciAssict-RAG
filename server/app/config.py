from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    TIDB_HOST: str
    TIDB_PORT: int = 4000
    TIDB_USER: str
    TIDB_PASSWORD: str
    TIDB_DB: str

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
    )

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.TIDB_USER}:{self.TIDB_PASSWORD}"
            f"@{self.TIDB_HOST}:{self.TIDB_PORT}/{self.TIDB_DB}"
            f"?ssl_verify_cert=true&ssl_verify_identity=true"
        )

settings = Settings()