import ast
import json
import subprocess
import sys
from typing import Literal

from pydantic import BaseModel


class StaticFinding(BaseModel):
    source: Literal["ast", "ruff"]
    code: str
    message: str
    line: int | None
    column: int | None


def check_code(code: str) -> list[StaticFinding]:
    try:
        ast.parse(code)
    except SyntaxError as exc:
        return [
            StaticFinding(
                source="ast",
                code="syntax-error",
                message=exc.msg,
                line=exc.lineno,
                column=exc.offset if exc.offset and exc.offset > 0 else None,
            )
        ]

    result = subprocess.run(
        [
            sys.executable, "-I", "-m", "ruff", "check",
            "--isolated", "--no-cache", "--output-format", "json",
            "--select", "E4,E7,E9,F", "--stdin-filename", "submission.py", "-",
        ],
        input=code,
        encoding="utf-8",
        capture_output=True,
        timeout=3,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError("Ruff did not complete.")

    return [
        StaticFinding(
            source="ruff",
            code=diagnostic["code"],
            message=diagnostic["message"],
            line=diagnostic["location"]["row"],
            column=diagnostic["location"]["column"],
        )
        for diagnostic in json.loads(result.stdout)
    ]
