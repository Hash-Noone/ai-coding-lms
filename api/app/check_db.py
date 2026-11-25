import psycopg

from app.settings import Settings


def main() -> int:
    database_url = Settings().database_url
    if database_url is None:
        print("Set DATABASE_URL in api/.env or in the environment.")
        return 1

    try:
        with psycopg.connect(database_url.get_secret_value(), connect_timeout=5) as connection:
            connection.execute("SELECT 1")
    except psycopg.Error:
        print("Could not reach Postgres. Check DATABASE_URL and network access.")
        return 1

    print("Postgres connection OK.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
