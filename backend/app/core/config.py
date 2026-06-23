from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    DATABASE_URL: str
    SECRET_KEY: str
    # Groq API key (gsk_...), used for LLM chat completions.
    API_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173"
    # Directory (relative to the backend root or absolute) where uploaded
    # PDF files are stored on disk.
    STORAGE_DIR: str = "storage/uploads"
    MAX_UPLOAD_SIZE_MB: int = 25

    # --- RAG pipeline ---
    # OpenAI key, used only for embeddings (text-embedding-3-small).
    # Must be set for ingestion/search to work.
    OPENAI_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536
    # Groq chat model used for answering. Override in .env if deprecated.
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    # Chunking is character-based with overlap.
    CHUNK_SIZE: int = 1200
    CHUNK_OVERLAP: int = 200
    RETRIEVAL_TOP_K: int = 5
    # AI summaries: cap input fed to the LLM and output length.
    SUMMARY_MAX_INPUT_CHARS: int = 24000
    SUMMARY_MAX_TOKENS: int = 2048

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
