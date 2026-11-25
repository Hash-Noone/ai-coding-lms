"""Validate the problem bank in data/problems.

Each problem lives in data/problems/<slug>/ with problem.json, starter.py,
reference.py and wrong.py. A problem is rejected when its metadata is
malformed, the reference solution fails any public or hidden test, or the
deliberately wrong solution (or the untouched starter code) passes them all.
"""

import argparse
import ast
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from bank import DATA_DIR, load_concepts, load_mistake_types

SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
PROBLEM_KEYS = {
    "slug", "title", "prompt", "entry_point", "concepts",
    "public_tests", "hidden_tests", "wrong_solution",
}
TEST_KEYS = {"label", "args", "expected"}
WRONG_KEYS = {"mistake_type", "explanation"}
SOURCE_FILES = ("starter.py", "reference.py", "wrong.py")
MIN_PUBLIC_TESTS = 3
MIN_HIDDEN_TESTS = 2
MAX_CONCEPTS = 3
TEST_TIMEOUT_SECONDS = 2.0

# Runs one solution against every test in a fresh interpreter. Each test gets
# a fresh namespace and its own timer, so an infinite loop fails that test.
HARNESS = r"""
import json, signal, sys

def canonical(value):
    return json.dumps(value, sort_keys=True, allow_nan=False)

def on_timeout(signum, frame):
    raise TimeoutError("test exceeded the time limit")

request = json.load(sys.stdin)
signal.signal(signal.SIGALRM, on_timeout)
results = []
for test in request["tests"]:
    signal.setitimer(signal.ITIMER_REAL, request["timeout"])
    try:
        namespace = {"__name__": "__main__"}
        exec(compile(request["code"], "solution.py", "exec"), namespace)
        actual = namespace[request["entry_point"]](*test["args"])
        try:
            passed = canonical(actual) == canonical(test["expected"])
            result = {"passed": passed, "actual": repr(actual)[:200]}
        except (TypeError, ValueError):
            result = {"passed": False, "error": f"returned a non-JSON value: {actual!r}"[:200]}
    except BaseException as error:
        result = {"passed": False, "error": f"{type(error).__name__}: {error}"[:200]}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    results.append(result)
sys.stdout.write(json.dumps(results))
"""


def run_solution(code: str, entry_point: str, tests: list[dict]) -> list[dict]:
    request = {
        "code": code,
        "entry_point": entry_point,
        "tests": [{"args": test["args"], "expected": test["expected"]} for test in tests],
        "timeout": TEST_TIMEOUT_SECONDS,
    }
    try:
        completed = subprocess.run(
            [sys.executable, "-I", "-c", HARNESS],
            input=json.dumps(request),
            capture_output=True,
            text=True,
            timeout=TEST_TIMEOUT_SECONDS * len(tests) + 10,
        )
        return json.loads(completed.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        return [{"passed": False, "error": "the solution did not finish"} for _ in tests]


def function_params(tree: ast.Module, name: str) -> list[str] | None:
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == name:
            args = node.args
            return [arg.arg for arg in args.posonlyargs + args.args]
    return None


def check_tests(tests, kind: str, minimum: int) -> list[str]:
    if not isinstance(tests, list) or len(tests) < minimum:
        return [f"needs at least {minimum} {kind} tests"]
    errors = []
    for position, test in enumerate(tests):
        where = f"{kind} test {position}"
        if not isinstance(test, dict) or set(test) != TEST_KEYS:
            errors.append(f"{where} must have exactly the keys {sorted(TEST_KEYS)}")
        elif not isinstance(test["label"], str) or not test["label"].strip():
            errors.append(f"{where} needs a label")
        elif not isinstance(test["args"], list):
            errors.append(f"{where} args must be a list of positional arguments")
    return errors


def check_metadata(problem, slug: str, concepts: set[str], mistake_types: set[str]) -> list[str]:
    if not isinstance(problem, dict) or set(problem) != PROBLEM_KEYS:
        return [f"problem.json must have exactly the keys {sorted(PROBLEM_KEYS)}"]
    errors = []
    if problem["slug"] != slug or not SLUG.match(slug):
        errors.append("slug must be kebab-case and match the directory name")
    for key in ("title", "prompt"):
        if not isinstance(problem[key], str) or not problem[key].strip():
            errors.append(f"{key} must be a non-empty string")
    if not isinstance(problem["entry_point"], str) or not problem["entry_point"].isidentifier():
        errors.append("entry_point must be a Python identifier")
    tags = problem["concepts"]
    if not isinstance(tags, list) or not 1 <= len(tags) <= MAX_CONCEPTS:
        errors.append(f"concepts must list 1 to {MAX_CONCEPTS} concept slugs")
    elif len(set(tags)) != len(tags) or not set(tags) <= concepts:
        errors.append(f"unknown or repeated concepts: {sorted(set(tags) - concepts) or tags}")
    errors += check_tests(problem["public_tests"], "public", MIN_PUBLIC_TESTS)
    errors += check_tests(problem["hidden_tests"], "hidden", MIN_HIDDEN_TESTS)
    wrong = problem["wrong_solution"]
    if not isinstance(wrong, dict) or set(wrong) != WRONG_KEYS:
        errors.append(f"wrong_solution must have exactly the keys {sorted(WRONG_KEYS)}")
    elif wrong["mistake_type"] not in mistake_types:
        errors.append(f"unknown mistake_type {wrong['mistake_type']!r}")
    elif not isinstance(wrong["explanation"], str) or not wrong["explanation"].strip():
        errors.append("wrong_solution needs an explanation")
    if errors:
        return errors

    all_tests = problem["public_tests"] + problem["hidden_tests"]
    labels = [test["label"] for test in all_tests]
    if len(set(labels)) != len(labels):
        errors.append("test labels must be unique")
    arg_lists = [json.dumps(test["args"], sort_keys=True) for test in all_tests]
    if len(set(arg_lists)) != len(arg_lists):
        errors.append("two tests use the same arguments")
    return errors


def check_sources(sources: dict[str, str], entry_point: str, mistake_type: str) -> list[str]:
    errors = []
    trees = {}
    for name, code in sources.items():
        try:
            trees[name] = ast.parse(code, name)
        except SyntaxError as error:
            if not (name == "wrong.py" and mistake_type == "syntax"):
                errors.append(f"{name} does not parse: {error.msg} (line {error.lineno})")
    if mistake_type == "syntax" and "wrong.py" in trees:
        errors.append("wrong.py is labeled syntax but parses")
    signature = function_params(trees["reference.py"], entry_point) if "reference.py" in trees else None
    if "reference.py" in trees and signature is None:
        errors.append(f"reference.py does not define {entry_point}()")
    for name in ("starter.py", "wrong.py"):
        if name in trees and signature is not None:
            params = function_params(trees[name], entry_point)
            if params is None:
                errors.append(f"{name} does not define {entry_point}()")
            elif len(params) != len(signature):
                errors.append(f"{name} {entry_point}() takes {params}, reference takes {signature}")
    if sources["wrong.py"].strip() == sources["reference.py"].strip():
        errors.append("wrong.py is identical to reference.py")
    return errors


def check_behavior(sources: dict[str, str], problem: dict) -> list[str]:
    tests = problem["public_tests"] + problem["hidden_tests"]
    entry_point = problem["entry_point"]
    errors = []
    for test, result in zip(tests, run_solution(sources["reference.py"], entry_point, tests)):
        if not result["passed"]:
            detail = result.get("error") or f"returned {result['actual']}"
            errors.append(f"reference fails {test['label']!r}: {detail}, expected {test['expected']!r}")
    for name in ("wrong.py", "starter.py"):
        if all(result["passed"] for result in run_solution(sources[name], entry_point, tests)):
            errors.append(f"{name} passes every test; add a test that catches it")
    return errors


def validate_problem(problem_dir: Path, concepts: set[str], mistake_types: set[str]):
    """Return (problem or None, errors) for one problem directory."""
    missing = [name for name in ("problem.json", *SOURCE_FILES) if not (problem_dir / name).is_file()]
    if missing:
        return None, [f"missing {', '.join(missing)}"]
    try:
        problem = json.loads((problem_dir / "problem.json").read_text())
    except json.JSONDecodeError as error:
        return None, [f"problem.json is not valid JSON: {error}"]
    errors = check_metadata(problem, problem_dir.name, concepts, mistake_types)
    if errors:
        return None, errors
    sources = {name: (problem_dir / name).read_text() for name in SOURCE_FILES}
    errors = check_sources(sources, problem["entry_point"], problem["wrong_solution"]["mistake_type"])
    if not errors:
        errors = check_behavior(sources, problem)
    return problem, errors


def check_coverage(problems: list[dict], concepts: set[str], mistake_types: set[str]) -> list[str]:
    used_concepts = {tag for problem in problems for tag in problem["concepts"]}
    used_mistakes = {problem["wrong_solution"]["mistake_type"] for problem in problems}
    errors = []
    if concepts - used_concepts:
        errors.append(f"no problem covers concepts: {sorted(concepts - used_concepts)}")
    if mistake_types - used_mistakes:
        errors.append(f"no wrong solution covers mistake types: {sorted(mistake_types - used_mistakes)}")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR)
    parser.add_argument("slugs", nargs="*", help="validate only these problems (skips coverage checks)")
    args = parser.parse_args(argv)

    concepts = load_concepts(args.data_dir)
    mistake_types = load_mistake_types(args.data_dir)
    problems_dir = args.data_dir / "problems"
    dirs = [problems_dir / slug for slug in args.slugs] or sorted(
        path for path in problems_dir.iterdir() if path.is_dir()
    )

    failed = 0
    problems = []
    for problem_dir in dirs:
        problem, errors = validate_problem(problem_dir, concepts, mistake_types)
        if errors:
            failed += 1
            print(f"FAIL {problem_dir.name}")
            for error in errors:
                print(f"  - {error}")
        else:
            problems.append(problem)
            print(f"ok   {problem_dir.name}")

    coverage_errors = [] if args.slugs else check_coverage(problems, concepts, mistake_types)
    for error in coverage_errors:
        print(f"FAIL bank: {error}")

    concept_counts = Counter(tag for problem in problems for tag in problem["concepts"])
    mistake_counts = Counter(problem["wrong_solution"]["mistake_type"] for problem in problems)
    print(f"\n{len(problems)} of {len(dirs)} problems valid")
    print("concepts: " + ", ".join(f"{tag} {concept_counts[tag]}" for tag in sorted(concepts)))
    print("mistake types: " + ", ".join(f"{kind} {mistake_counts[kind]}" for kind in sorted(mistake_types)))
    return 1 if failed or coverage_errors else 0


if __name__ == "__main__":
    sys.exit(main())
