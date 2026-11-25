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
        with engine.connect() as connection:
            run_migrations(connection)
