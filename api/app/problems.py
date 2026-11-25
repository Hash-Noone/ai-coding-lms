import json
from functools import cache
from pathlib import Path

from pydantic import BaseModel, JsonValue

PROBLEMS_DIR = Path(__file__).resolve().parents[2] / "data" / "problems"


class PublicTest(BaseModel):
    id: str
    label: str
    args: list[JsonValue]
    expected: JsonValue


class Problem(BaseModel):
    slug: str
    title: str
    prompt: str
    entry_point: str
    concepts: list[str]
    starter_code: str
    public_tests: list[PublicTest]


@cache
def problem_bank() -> dict[str, Problem]:
    bank = {}
    for path in sorted(PROBLEMS_DIR.glob("*/problem.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        slug = data["slug"]
        data["starter_code"] = path.with_name("starter.py").read_text(encoding="utf-8")
        data["public_tests"] = [
            {**test, "id": f"{slug}-test-{index}"}
            for index, test in enumerate(data["public_tests"])
        ]
        bank[slug] = Problem.model_validate(data)
    return bank
