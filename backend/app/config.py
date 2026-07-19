"""SentraGrid Backend — Configuration."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # LLM
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-70b-versatile"
    gemini_api_key: str = ""

    # Embedding
    embedding_model: str = "all-MiniLM-L6-v2"

    # App
    mock_mode: bool = True
    cors_origins: str = "http://localhost:3000"
    auto_start_simulator: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def use_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key) and not self.mock_mode

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
