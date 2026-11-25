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

it("compares booleans, floats, strings, lists, and dicts without conflating bool and int", () => {
  const results = runPythonTests(pyodide, {
    code: "def check(x): return x",
    entryPoint: "check",
    tests: [
      { id: "bool-true", label: "bool true", args: [true], expected: true },
      { id: "bool-vs-int", label: "bool vs int", args: [1], expected: true },
      { id: "dict-order", label: "dict key order", args: [{ b: 2, a: 1 }], expected: { a: 1, b: 2 } },
      { id: "str", label: "string", args: ["hi"], expected: "hi" },
    ],
  });
  expect(results).toEqual([
    { id: "bool-true", passed: true, actual: "True" },
    { id: "bool-vs-int", passed: false, actual: "1" },
    { id: "dict-order", passed: true, actual: "{'a': 1, 'b': 2}" },
    { id: "str", passed: true, actual: "'hi'" },
  ]);

  const floatResults = runPythonTests(pyodide, {
    code: "def avg(xs): return float(sum(xs) / len(xs)) if xs else 0.0",
    entryPoint: "avg",
    tests: [
      { id: "whole-float", label: "whole float", args: [[80, 90, 100]], expected: 90 },
      { id: "zero-float", label: "zero float", args: [[]], expected: 0 },
    ],
  });
  expect(floatResults).toEqual([
    { id: "whole-float", passed: true, actual: "90.0" },
    { id: "zero-float", passed: true, actual: "0.0" },
  ]);
});
