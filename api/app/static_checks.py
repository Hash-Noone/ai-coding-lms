import json
import subprocess
import sys
from typing import Literal

from pydantic import BaseModel


class StaticFinding(BaseModel):
    source: Literal["ruff"]
    code: str
    message: str
    line: int | None
    column: int | None


def check_code(code: str) -> list[StaticFinding]:
    result = subprocess.run(
        [
            sys.executable, "-I", "-m", "ruff", "check",
            "--isolated", "--no-cache", "--output-format", "json",
            "--target-version", "py314",  # Match the Python version in the browser's Pyodide runtime.
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
