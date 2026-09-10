from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    TIDB_HOST: str
    TIDB_PORT: int
    TIDB_USER: str
    TIDB_PASSWORD: str
    TIDB_DATABASE: str

    # ไม่มี default โดยตั้งใจ - ถ้า .env ไม่มี JWT_SECRET_KEY ให้แอปพังตั้งแต่
    # start ดีกว่าปล่อยให้รันด้วย secret ที่เดาได้แล้วโดนปลอม token
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expires_days: int = 1

    dotblue_api_key: str

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
