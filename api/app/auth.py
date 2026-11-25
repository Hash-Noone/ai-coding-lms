from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.settings import Settings

bearer = HTTPBearer(auto_error=False)


def get_settings() -> Settings:
    return Settings()


def sign_in_required() -> HTTPException:
    return HTTPException(401, "A valid Supabase session is required.", {"WWW-Authenticate": "Bearer"})


def get_session_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> UUID:
    if credentials is None:
        raise sign_in_required()
    if settings.supabase_url is None or settings.supabase_publishable_key is None:
        raise HTTPException(503, "Supabase authentication is not configured.")

    url = str(settings.supabase_url).rstrip("/").removesuffix("/rest/v1")
    try:
        response = httpx.get(
            f"{url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_publishable_key.get_secret_value().strip(),
                "Authorization": f"Bearer {credentials.credentials}",
            },
            timeout=5,
        )
    except httpx.HTTPError:
        raise HTTPException(503, "Could not verify the Supabase session.") from None

    if response.status_code in (401, 403):
        raise sign_in_required()
    if response.status_code != 200:
        raise HTTPException(503, "Could not verify the Supabase session.")
    try:
        return UUID(response.json()["id"])
    except (ValueError, TypeError, KeyError, AttributeError):
        raise HTTPException(503, "Could not verify the Supabase session.") from None
