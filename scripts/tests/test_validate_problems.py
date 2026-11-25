import json
import re
import shutil
from pathlib import Path

import pytest

import validate_problems
from bank import DATA_DIR, load_concepts, load_mistake_types

CONCEPTS = load_concepts()
MISTAKES = load_mistake_types()
EXAMPLE = DATA_DIR / "problems" / "sum-of-evens"
MIGRATION = Path(__file__).resolve().parents[2] / "api/migrations/versions/0001_lms_schema.py"


@pytest.fixture
def problem_dir(tmp_path):
    target = tmp_path / EXAMPLE.name
    shutil.copytree(EXAMPLE, target)
    return target


def validate(path):
    return validate_problems.validate_problem(path, CONCEPTS, MISTAKES)[1]


def edit(path, change):
    problem = json.loads((path / "problem.json").read_text())
    change(problem)
    (path / "problem.json").write_text(json.dumps(problem))


def test_bank_passes(capsys):
    assert validate_problems.main([]) == 0
    assert re.search(r"(\d+) of \1 problems valid", capsys.readouterr().out)


def test_bank_size_is_within_step_three_range():
    problems = [path for path in (DATA_DIR / "problems").iterdir() if path.is_dir()]
    assert 40 <= len(problems) <= 60


def test_concepts_match_migration_seed():
    seed = MIGRATION.read_text().split("INSERT INTO public.concepts", 1)[1].split(";", 1)[0]
    assert set(re.findall(r"\('([a-z_]+)',", seed)) == CONCEPTS


def test_example_is_valid(problem_dir):
    assert validate(problem_dir) == []


def test_failing_reference_is_rejected(problem_dir):
    (problem_dir / "reference.py").write_text("def sum_evens(numbers):\n    return sum(numbers)\n")
    assert any("reference fails" in error for error in validate(problem_dir))


def test_wrong_solution_that_passes_is_rejected(problem_dir):
    (problem_dir / "wrong.py").write_text(
        "def sum_evens(numbers):\n    return sum(n for n in numbers if not n % 2)\n"
    )
    assert any("wrong.py passes every test" in error for error in validate(problem_dir))


def test_infinite_loop_times_out(problem_dir, monkeypatch):
    monkeypatch.setattr(validate_problems, "TEST_TIMEOUT_SECONDS", 0.2)
    (problem_dir / "reference.py").write_text("def sum_evens(numbers):\n    while True:\n        pass\n")
    errors = validate(problem_dir)
    assert any("TimeoutError" in error for error in errors)


@pytest.mark.parametrize(
    "change, message",
    [
        (lambda p: p["concepts"].append("monads"), "unknown or repeated concepts"),
        (lambda p: p["wrong_solution"].update(mistake_type="typo"), "unknown mistake_type"),
        (lambda p: p.update(slug="other"), "match the directory name"),
        (lambda p: p.pop("prompt"), "exactly the keys"),
        (lambda p: p.update(hidden_tests=p["hidden_tests"][:1]), "at least 2 hidden tests"),
        (lambda p: p["hidden_tests"][0].update(label=p["public_tests"][0]["label"]), "labels must be unique"),
        (lambda p: p["hidden_tests"][0].update(args=p["public_tests"][0]["args"]), "same arguments"),
        (lambda p: p["public_tests"][0].update(args="1, 2"), "args must be a list"),
    ],
)
def test_bad_metadata_is_rejected(problem_dir, change, message):
    edit(problem_dir, change)
    assert any(message in error for error in validate(problem_dir))


def test_missing_file_is_rejected(problem_dir):
    (problem_dir / "starter.py").unlink()
    assert validate(problem_dir) == ["missing starter.py"]


def test_syntax_error_outside_syntax_mistake_is_rejected(problem_dir):
    (problem_dir / "wrong.py").write_text("def sum_evens(numbers)\n    return 0\n")
    assert any("wrong.py does not parse" in error for error in validate(problem_dir))


def test_syntax_mistake_must_not_parse(problem_dir):
    edit(problem_dir, lambda p: p["wrong_solution"].update(mistake_type="syntax"))
    assert "wrong.py is labeled syntax but parses" in validate(problem_dir)


def test_signature_mismatch_is_rejected(problem_dir):
    (problem_dir / "starter.py").write_text("def sum_evens():\n    return 0\n")
    assert "starter.py defines sum_evens(), reference defines sum_evens(numbers)" in validate(problem_dir)


def test_required_parameter_that_should_be_optional_is_rejected(tmp_path):
    target = tmp_path / "append-item"
    shutil.copytree(DATA_DIR / "problems" / "append-item", target)
    (target / "starter.py").write_text("def add_item(item, items):\n    return []\n")
    assert any("starter.py defines add_item(item, items)" in error for error in validate(target))


def test_printing_solutions_are_judged_by_return_value(problem_dir):
    (problem_dir / "reference.py").write_text(
        "def sum_evens(numbers):\n    print('[{\"passed\": true}]')\n    return sum(n for n in numbers if n % 2 == 0)\n"
    )
    (problem_dir / "wrong.py").write_text("def sum_evens(numbers):\n    print('[{\"passed\": true}]' * 5)\n    return 0\n")
    assert validate(problem_dir) == []


def test_missing_concept_coverage_is_reported():
    problem = json.loads((EXAMPLE / "problem.json").read_text())
    errors = validate_problems.check_coverage([problem], CONCEPTS, MISTAKES)
    assert len(errors) == 2
