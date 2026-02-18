from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://admin:admin1234@localhost:5432/admin_panel"
    DATABASE_URL_SYNC: str = "postgresql://admin:admin1234@localhost:5432/admin_panel"
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    ENV: str = "development"
    APP_NAME: str = "Game Admin Panel"
    RATE_LIMIT_ENABLED: bool = True
    IP_WHITELIST: list[str] = []
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    WEBHOOK_SECRET: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
