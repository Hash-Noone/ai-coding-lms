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

def canonical(value):
    return json.dumps(value, sort_keys=True, allow_nan=False)

def run_test(case):
    namespace = {"__name__": "__main__"}
    try:
        exec(submission, namespace)
        actual = namespace[entry_point](*case["args"])
        try:
            passed = canonical(actual) == canonical(case["expected"])
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
