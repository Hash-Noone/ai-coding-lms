from unittest.mock import MagicMock

import psycopg

from app import check_db


def test_check_db_requires_database_url(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    assert check_db.main() == 1
    assert "Set DATABASE_URL" in capsys.readouterr().out


def test_check_db_reads_local_env(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    database_url = "postgresql://localhost/lms"
    (tmp_path / ".env").write_text(f"DATABASE_URL={database_url}\n")
    connect = MagicMock()
    monkeypatch.setattr(check_db.psycopg, "connect", connect)

    assert check_db.main() == 0
    connect.assert_called_once_with(database_url, connect_timeout=5)
    connect.return_value.__enter__.return_value.execute.assert_called_once_with("SELECT 1")
    assert capsys.readouterr().out == "Postgres connection OK.\n"


def test_check_db_does_not_print_connection_details(monkeypatch, tmp_path, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/lms")
    connect = MagicMock(side_effect=psycopg.OperationalError("private connection details"))
    monkeypatch.setattr(check_db.psycopg, "connect", connect)

    assert check_db.main() == 1
    assert capsys.readouterr().out == (
        "Could not reach Postgres. Check DATABASE_URL and network access.\n"
    )
