from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url

from app.settings import Settings


def run_migrations(connection):
    context.configure(connection=connection, version_table_schema="public")
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    run_migrations(connection)
else:
    database_url = Settings().database_url
    if database_url is None:
        raise SystemExit("Set DATABASE_URL in api/.env or in the environment.")

    url = make_url(database_url.get_secret_value()).set(drivername="postgresql+psycopg")
    if context.is_offline_mode():
        context.configure(url=url, version_table_schema="public")
        with context.begin_transaction():
            context.run_migrations()
    else:
        engine = create_engine(url, poolclass=pool.NullPool)
        with engine.begin() as connection:
            if context.get_x_argument(as_dictionary=True).get("local_auth_stub") == "true":
                fixture = Path(__file__).resolve().parent.parent / "tests/fixtures/supabase_auth.sql"
                connection.exec_driver_sql(fixture.read_text())
            run_migrations(connection)
