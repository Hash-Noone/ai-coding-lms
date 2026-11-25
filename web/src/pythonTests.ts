import type { PyodideInterface } from "pyodide";

export type PublicTest = {
  id: string;
  label: string;
  args: unknown[];
  expected: unknown;
};

export type TestResult = { id: string; passed: boolean; actual?: string; error?: string };
export type RunRequest = { code: string; entryPoint: string; tests: PublicTest[] };

export type WorkerReply =
  | { type: "ready" }
  | { type: "results"; results: TestResult[] }
  | { type: "error"; message: string };

export function runPythonTests(pyodide: PyodideInterface, request: RunRequest): TestResult[] {
  const globals = pyodide.toPy({
    submission: request.code,
    entry_point: request.entryPoint,
    test_cases_json: JSON.stringify(request.tests),
  });

  try {
    const results = pyodide.runPython(`
import json
import reprlib

def values_equal(actual, expected):
    if type(actual) is bool or type(expected) is bool:
        return type(actual) is type(expected) and actual == expected
    if isinstance(actual, (int, float)) and isinstance(expected, (int, float)):
        return actual == expected
    if type(actual) is not type(expected):
        return False
    if isinstance(actual, list):
        return len(actual) == len(expected) and all(
            values_equal(a, b) for a, b in zip(actual, expected)
        )
    if isinstance(actual, dict):
        return actual.keys() == expected.keys() and all(
            values_equal(actual[k], expected[k]) for k in actual
        )
    return actual == expected

def run_test(case):
    namespace = {"__name__": "__main__"}
    try:
        exec(submission, namespace)
        actual = namespace[entry_point](*case["args"])
        try:
            normalized = json.loads(json.dumps(actual, allow_nan=False))
            passed = values_equal(normalized, case["expected"])
            return {
                "id": case["id"],
                "passed": passed,
                "actual": reprlib.repr(actual),
            }
        except (TypeError, ValueError):
            return {
                "id": case["id"],
                "passed": False,
                "error": f"Returned a non-JSON value: {reprlib.repr(actual)}"[:500],
            }
    except BaseException as error:
        return {
            "id": case["id"],
            "passed": False,
            "error": f"{type(error).__name__}: {error}"[:500],
        }

json.dumps([run_test(case) for case in json.loads(test_cases_json)])
`, { globals }) as string;
    return JSON.parse(results) as TestResult[];
  } finally {
    globals.destroy();
  }
}
