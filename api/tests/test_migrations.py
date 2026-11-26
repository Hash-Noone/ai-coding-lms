import os
from contextlib import nullcontext
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

from app import attempts
from app.problems import problem_bank

TESTS_DIR = Path(__file__).parent
AUTH_STUB = TESTS_DIR / "fixtures/supabase_auth.sql"
TABLES = {
    "users", "concepts", "problems", "test_cases", "attempts", "mastery",
    "questions", "resources", "resource_clicks", "problem_concepts", "resource_concepts",
}


@pytest.fixture
def postgres():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set TEST_DATABASE_URL to run the migration test on a fresh local Postgres DB.")

    engine = create_engine(make_url(url).set(drivername="postgresql+psycopg"))
    try:
        with engine.connect() as connection, connection.begin() as transaction:
            connection.exec_driver_sql(AUTH_STUB.read_text())
            config = Config(TESTS_DIR.parent / "alembic.ini")
            config.attributes["connection"] = connection
            yield connection, config
            transaction.rollback()
    finally:
        engine.dispose()


def test_migration_lifecycle(postgres):
    db, config = postgres
    sql = db.exec_driver_sql
    existing_user, new_user = uuid4(), uuid4()
    sql("INSERT INTO auth.users VALUES (%s)", (existing_user,))
    command.upgrade(config, "head")

    rls_tables = set(sql("""
        SELECT relname FROM pg_class JOIN pg_namespace ON pg_namespace.oid = relnamespace
        WHERE nspname = 'public' AND relrowsecurity
    """).scalars())
    assert TABLES | {"alembic_version"} <= rls_tables
    assert sql("SELECT id FROM public.users").scalar_one() == existing_user
    concept_slugs = set(sql("SELECT slug FROM public.concepts").scalars())
    assert len(concept_slugs) == 12
    assert {"arrays", "hashing", "loops", "recursion"} <= concept_slugs

    sql("CREATE ROLE lms_test_authenticated NOLOGIN")
    sql("GRANT USAGE ON SCHEMA auth, public TO lms_test_authenticated")
    sql("GRANT INSERT ON auth.users TO lms_test_authenticated")
    sql("GRANT SELECT ON ALL TABLES IN SCHEMA public TO lms_test_authenticated")
    sql("SET LOCAL ROLE lms_test_authenticated")
    sql("INSERT INTO auth.users VALUES (%s)", (new_user,))
    assert sql("SELECT count(*) FROM public.users").scalar_one() == 0
    sql("RESET ROLE")
    assert set(sql("SELECT id FROM public.users").scalars()) == {existing_user, new_user}

    problem_id = sql("""
        INSERT INTO public.problems (slug, title, prompt)
        VALUES ('echo', 'Echo', 'Return the input') RETURNING id
    """).scalar_one()
    sql("""
        INSERT INTO public.test_cases (problem_id, position, input, expected_output, is_hidden)
        VALUES (%s, 0, '1', '1', false), (%s, 1, '2', '2', true)
    """, (problem_id, problem_id))
    sql("SET LOCAL ROLE lms_test_authenticated")
    assert sql("SELECT count(*) FROM public.test_cases").scalar_one() == 0
    sql("RESET ROLE")

    attempt_id = sql("""
        INSERT INTO public.attempts (user_id, problem_id, code, test_results)
        VALUES (%s, %s, 'return value', '[]') RETURNING id
    """, (new_user, problem_id)).scalar_one()
    concept_id = sql("SELECT id FROM public.concepts WHERE slug = 'functions'").scalar_one()
    sql("INSERT INTO public.mastery (user_id, concept_id, score) VALUES (%s, %s, 0.5)",
        (new_user, concept_id))
    with pytest.raises(IntegrityError), db.begin_nested():
        sql("UPDATE public.mastery SET score = 1.1")
    with pytest.raises(IntegrityError), db.begin_nested():
        sql("INSERT INTO public.questions (user_id, attempt_id, body) VALUES (%s, %s, 'Help')",
            (existing_user, attempt_id))
    sql("INSERT INTO public.questions (user_id, attempt_id, body) VALUES (%s, %s, 'Help')",
        (new_user, attempt_id))
    resource_id = sql("""
        INSERT INTO public.resources (title, url, mistake_type, start_seconds)
        VALUES ('Functions', 'https://example.com/functions', 'function_contract', 45) RETURNING id
    """).scalar_one()
    sql("INSERT INTO public.resource_concepts VALUES (%s, %s)", (resource_id, concept_id))
    sql("INSERT INTO public.resource_clicks (resource_id, user_id) VALUES (%s, %s)",
        (resource_id, new_user))

    sql("DELETE FROM auth.users WHERE id = %s", (new_user,))
    for table in ("attempts", "mastery", "questions", "resource_clicks"):
        assert sql(f"SELECT count(*) FROM public.{table}").scalar_one() == 0

    command.downgrade(config, "base")
    public_tables = set(sql("""
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    """).scalars())
    assert not TABLES.intersection(public_tables)
    assert sql("SELECT id FROM auth.users").scalar_one() == existing_user

    sql(AUTH_STUB.read_text())
    command.upgrade(config, "head")
    assert sql("SELECT id FROM public.users").scalar_one() == existing_user
    assert sql("SELECT count(*) FROM public.concepts").scalar_one() == 12


def test_save_attempt_on_migrated_postgres(postgres, monkeypatch):
    db, config = postgres
    command.upgrade(config, "head")
    user_id = uuid4()
    db.exec_driver_sql("INSERT INTO auth.users VALUES (%s)", (user_id,))
    monkeypatch.setattr(
        attempts.psycopg, "connect", lambda *args, **kwargs: nullcontext(db.connection.driver_connection)
    )
    problem = problem_bank()["sum-of-evens"]
    test_results = [{"id": problem.public_tests[0].id, "passed": False, "actual": "0"}]
    submission = attempts.AttemptSubmission(
        problem_slug=problem.slug, code=problem.starter_code, test_results=test_results
    )

    first_id = attempts.save_attempt("unused", user_id, problem, submission)
    second_id = attempts.save_attempt("unused", user_id, problem, submission)

    assert first_id != second_id
    saved = db.exec_driver_sql("""
        SELECT attempts.id, user_id, problems.slug, code, test_results
        FROM public.attempts JOIN public.problems ON problems.id = attempts.problem_id
        ORDER BY attempts.id
    """).all()
    assert saved == [
        (attempt_id, user_id, problem.slug, problem.starter_code, test_results)
        for attempt_id in (first_id, second_id)
    ]
