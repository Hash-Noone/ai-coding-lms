from subprocess import TimeoutExpired
from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.attempts import AttemptSubmission, SavedAttempt, save_attempt
from app.auth import get_session_user, get_settings
from app.problems import Problem, problem_bank
from app.settings import Settings
from app.static_checks import check_code

app = FastAPI(title="AI Coding LMS API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ai-coding-lms--jxxy0frp.preview.devinapps.com",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

SessionUser = Annotated[UUID, Depends(get_session_user)]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/problems", response_model=list[Problem])
def list_problems(user_id: SessionUser) -> list[Problem]:
    return list(problem_bank().values())


@app.get("/problems/{id}")
def get_problem(id: str, user_id: SessionUser) -> Problem:
    return require_problem(id)


def require_problem(slug: str) -> Problem:
    problem = problem_bank().get(slug)
    if problem is None:
        raise HTTPException(404, "Problem not found.")
    return problem


@app.post("/attempts", status_code=201, response_model_exclude_none=True)
def create_attempt(
    submission: AttemptSubmission,
    user_id: SessionUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> SavedAttempt:
    problem = require_problem(submission.problem_slug)
    if settings.database_url is None:
        raise HTTPException(503, "Attempt storage is not configured.")
    try:
        findings = check_code(submission.code)
    except (OSError, RuntimeError, TimeoutExpired):
        raise HTTPException(503, "Static checks are unavailable.") from None
    try:
        attempt_id = save_attempt(settings.database_url.get_secret_value(), user_id, problem, submission)
    except (psycopg.Error, RuntimeError):
        raise HTTPException(503, "Could not save the attempt.") from None
    return SavedAttempt(id=attempt_id, test_results=submission.test_results, static_findings=findings)
