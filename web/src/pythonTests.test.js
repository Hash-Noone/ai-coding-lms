import { createRequire } from "node:module";
import { dirname } from "node:path";
import { loadPyodide } from "pyodide";
import { beforeAll, expect, it } from "vitest";
import { runPythonTests } from "./pythonTests";
import { sampleProblem } from "./sampleProblem";

let pyodide;

beforeAll(async () => {
  const indexURL = dirname(createRequire(import.meta.url).resolve("pyodide/package.json"));
  pyodide = await loadPyodide({ indexURL });
}, 30_000);

function run(code) {
  return runPythonTests(pyodide, {
    code,
    entryPoint: sampleProblem.entryPoint,
    tests: sampleProblem.publicTests,
  });
}

it("runs the sample's correct and deliberately incomplete solutions", () => {
  expect(run("def sum_positives(numbers): return sum(n for n in numbers if n > 0)")).toEqual([
    { id: "mixed", passed: true, actual: "8" },
    { id: "negative", passed: true, actual: "0" },
    { id: "empty", passed: true, actual: "0" },
  ]);
  expect(run(sampleProblem.starterCode)).toEqual([
    { id: "mixed", passed: false, actual: "0" },
    { id: "negative", passed: true, actual: "0" },
    { id: "empty", passed: true, actual: "0" },
  ]);
});

it("reports Python errors per test and isolates learner globals", () => {
  const failed = run("def sum_positives(numbers): return 1 / 0");
  expect(failed).toHaveLength(3);
  for (const result of failed) {
    expect(result).toMatchObject({ passed: false, error: "ZeroDivisionError: division by zero" });
  }
  const namespaceCheck = run("seen = []\ndef sum_positives(numbers):\n    seen.append(1)\n    return len(seen)");
  expect(namespaceCheck.map(({ actual }) => actual)).toEqual(["1", "1", "1"]);
});
