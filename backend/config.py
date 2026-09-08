from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://topik:topik@localhost:5432/topik"
    valid_passcode: str
    frontend_origins: str = "http://localhost:5173"
    gemini_api_key: Optional[str] = None
    vertex_project: Optional[str] = None
    vertex_credentials_json: Optional[str] = None
    vertex_location: str = "us-central1"
    writing_grader_model: str = "gemini-2.5-pro"

    @property
    def allowed_frontend_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]

    @property
    def grader_api_key(self) -> Optional[str]:
        return self.gemini_api_key

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
