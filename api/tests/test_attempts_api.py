from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app import auth, main
from app.settings import Settings

HEADERS = {"Authorization": "Bearer example-token"}
SUBMISSION = {
    "problem_slug": "sum-of-evens",
    "code": "import math\n",
    "test_results": [{"id": "sum-of-evens-test-0", "passed": False, "actual": "0"}],
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example/db")
    monkeypatch.setenv("VITE_SUPABASE_URL", "https://example.supabase.co/rest/v1/")
    monkeypatch.setenv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-key")
    with TestClient(main.app) as client:
        yield client


@pytest.fixture
def session(monkeypatch):
    user_id = uuid4()
    verify = Mock(return_value=httpx.Response(200, json={"id": str(user_id)}))
    monkeypatch.setattr(auth.httpx, "get", verify)
    return user_id, verify


@pytest.mark.parametrize("path", ["/problems", "/problems/sum-of-evens", "/attempts"])
def test_requires_session(client, path):
    response = (
        client.post(path, json=SUBMISSION) if path == "/attempts" else client.get(path)
    )
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(("upstream_status", "expected"), [(401, 401), (403, 401), (500, 503)])
def test_rejected_or_unavailable_session(client, session, upstream_status, expected):
    _, verify = session
    verify.return_value = httpx.Response(upstream_status)
    assert client.post("/attempts", json=SUBMISSION, headers=HEADERS).status_code == expected


def test_lists_and_reads_only_public_problem_data(client, session):
    _, verify = session
    listing = client.get("/problems", headers=HEADERS)
    assert listing.status_code == 200
    problem = next(row for row in listing.json() if row["slug"] == "sum-of-evens")
    assert set(problem) == {
        "slug", "title", "prompt", "entry_point", "concepts", "starter_code", "public_tests",
    }
    assert problem["public_tests"][0]["id"] == "sum-of-evens-test-0"
    assert client.get("/problems/sum-of-evens", headers=HEADERS).json() == problem
    assert client.get("/problems/unknown", headers=HEADERS).status_code == 404
    verify.assert_called_with(
        "https://example.supabase.co/auth/v1/user",
        headers={"apikey": "publishable-key", **HEADERS},
        timeout=5,
    )


def test_saves_attempt_for_verified_user_and_returns_results(client, session, monkeypatch):
    user_id, _ = session
    save = Mock(return_value=42)
    monkeypatch.setattr(main, "save_attempt", save)

    response = client.post("/attempts", json=SUBMISSION, headers=HEADERS)

    assert response.status_code == 201
    assert response.json() == {
        "id": 42,
        "test_results": SUBMISSION["test_results"],
        "static_findings": [
            {
                "source": "ruff", "code": "F401", "message": "`math` imported but unused",
                "line": 1, "column": 8,
            },
        ],
    }
    save.assert_called_once()
    database_url, saved_user, problem, attempt = save.call_args.args
    assert database_url == Settings().database_url.get_secret_value()
    assert saved_user == user_id
    assert problem.slug == SUBMISSION["problem_slug"]
    assert attempt.model_dump(exclude_none=True) == SUBMISSION


def test_rejects_unknown_problem_and_client_supplied_user(client, session, monkeypatch):
    save = Mock()
    monkeypatch.setattr(main, "save_attempt", save)

    unknown = client.post("/attempts", json={**SUBMISSION, "problem_slug": "unknown"}, headers=HEADERS)
    spoofed = client.post("/attempts", json={**SUBMISSION, "user_id": str(uuid4())}, headers=HEADERS)

    assert unknown.status_code == 404
    assert spoofed.status_code == 422
    save.assert_not_called()


@pytest.mark.parametrize("origin", [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://ai-coding-lms--jxxy0frp.preview.devinapps.com",
])
def test_cors_preflight(client, origin):
    response = client.options("/attempts", headers={
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
    })
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == origin
