from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    TIDB_HOST: str
    TIDB_PORT: int
    TIDB_USER: str
    TIDB_PASSWORD: str
    TIDB_DATABASE: str

    class Config:
        env_file = ".env"


settings = Settings()