from pydantic import AliasChoices, Field, HttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True)

    database_url: SecretStr | None = None
    gemini_api_key: SecretStr | None = None
    supabase_url: HttpUrl | None = Field(
        default=None, validation_alias=AliasChoices("SUPABASE_URL", "VITE_SUPABASE_URL")
    )
    supabase_publishable_key: SecretStr | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"),
    )
