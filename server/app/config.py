from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    TIDB_HOST: str
    TIDB_PORT: int
    TIDB_USER: str
    TIDB_PASSWORD: str
    TIDB_DATABASE: str

    # Require a secret rather than falling back to an insecure default.
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expires_days: int = 1

    dotblue_api_key: str

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
