from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    TIDB_HOST: str
    TIDB_PORT: int
    TIDB_USER: str
    TIDB_PASSWORD: str
    TIDB_DATABASE: str
    
    jwt_secret_key: str = "some-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_expires_days: int = 1

    class Config:
        env_file = ".env"


settings = Settings()