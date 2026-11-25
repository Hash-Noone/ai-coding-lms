from typing import Annotated
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints

from app.problems import Problem
from app.static_checks import StaticFinding

Text = Annotated[str, StringConstraints(pattern=r"^[^\x00]*$")]


class PublicTestResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Text = Field(min_length=1, max_length=160)
    passed: StrictBool
    actual: Text | None = Field(default=None, max_length=100_000)
    error: Text | None = Field(default=None, max_length=500)


class AttemptSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problem_slug: str = Field(min_length=1, max_length=120)
    code: Text = Field(max_length=100_000)
    test_results: list[PublicTestResult] = Field(max_length=100)


class SavedAttempt(BaseModel):
    id: int
    test_results: list[PublicTestResult]
    static_findings: list[StaticFinding]


def save_attempt(
    database_url: str, user_id: UUID, problem: Problem, submission: AttemptSubmission
) -> int:
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute(
            """
            INSERT INTO public.problems (slug, title, prompt, starter_code)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (slug) DO NOTHING
            """,
            (problem.slug, problem.title, problem.prompt, problem.starter_code),
        )
        row = connection.execute(
            """
            INSERT INTO public.attempts (user_id, problem_id, code, test_results)
            SELECT %s, id, %s, %s FROM public.problems WHERE slug = %s
            RETURNING id
            """,
            (
                user_id,
                submission.code,
                Jsonb([result.model_dump(exclude_none=True) for result in submission.test_results]),
                problem.slug,
            ),
        ).fetchone()
        if row is None:
            raise RuntimeError("The attempt could not be inserted.")
    return row[0]
