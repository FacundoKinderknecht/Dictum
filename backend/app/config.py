from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    # Opcional: solo necesario para validar tokens Legacy HS256 aún en circulación.
    # Con el nuevo sistema ECC (P-256) de Supabase, la validación usa JWKS.
    supabase_jwt_secret: str | None = None
    supabase_service_role_key: str
    allowed_origins: str
    environment: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
