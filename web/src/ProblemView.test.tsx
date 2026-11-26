// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { problems } from "virtual:problem-bank";
import { App } from "./App";
import { postAttempt } from "./attempts";
import { ProblemView } from "./ProblemView";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("./pythonRunner", () => ({
  RUN_TIMEOUT_MS: 3000,
  createPythonRunner: () => ({ run, dispose: vi.fn() }),
}));
vi.mock("./PythonEditor", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({
      initialCode,
      onChange,
      onReady,
    }: {
      initialCode: string;
      onChange: (code: string) => void;
      onReady: (ready: boolean) => void;
    }) => {
      useEffect(() => onReady(true), [onReady]);
      return (
        <div>
          <span>Python editor ready</span>
          <textarea
            aria-label="Mock Python editor"
            defaultValue={initialCode}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );
    },
  };
});

beforeEach(() => {
  window.history.replaceState(null, "", "#explore");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it("opens a lesson from its course and shows pass or fail for each public test", async () => {
  const sumOfEvens = problems.find((p) => p.slug === "sum-of-evens")!;
  expect(problems).toHaveLength(52);
  run.mockResolvedValue({
    status: "completed",
    results: [
      { id: sumOfEvens.publicTests[0].id, passed: false, actual: "0" },
      { id: sumOfEvens.publicTests[1].id, passed: true, actual: "0" },
      { id: sumOfEvens.publicTests[2].id, passed: true, actual: "0" },
    ],
  });
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "View Thinking in Python" }));
  await user.click(screen.getByRole("button", { name: new RegExp(sumOfEvens.title) }));
  expect(screen.getByRole("heading", { name: sumOfEvens.title })).toBeTruthy();
  await screen.findByText("Python editor ready");
  await user.click(screen.getByRole("button", { name: "Run public tests" }));
  expect(await screen.findByText("2 of 3 public tests passed")).toBeTruthy();
  expect(screen.getByText("Expected 6, got 0")).toBeTruthy();
  expect(screen.getAllByText("Pass")).toHaveLength(2);
  expect(screen.getByText("Fail")).toBeTruthy();
  expect(run).toHaveBeenCalledWith({
    code: sumOfEvens.starterCode,
    entryPoint: sumOfEvens.entryPoint,
    tests: sumOfEvens.publicTests,
  });
});

it("preserves draft code across navigation until reset", async () => {
  const sumOfEvens = problems.find((p) => p.slug === "sum-of-evens")!;
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "View Thinking in Python" }));
  await user.click(screen.getByRole("button", { name: new RegExp(sumOfEvens.title) }));
  const editor = await screen.findByLabelText("Mock Python editor") as HTMLTextAreaElement;
  await user.clear(editor);
  await user.type(editor, "def sum_evens(numbers): return 42");

  await user.click(screen.getByRole("button", { name: "← Course overview" }));
  await user.click(screen.getByRole("button", { name: new RegExp(sumOfEvens.title) }));
  const reopened = await screen.findByLabelText("Mock Python editor") as HTMLTextAreaElement;
  expect(reopened.value).toBe("def sum_evens(numbers): return 42");

  await user.click(screen.getByRole("button", { name: "Reset code" }));
  const reset = await screen.findByLabelText("Mock Python editor") as HTMLTextAreaElement;
  expect(reset.value).toBe(sumOfEvens.starterCode);
});

it("posts the submitted code and public test results to the authenticated attempts endpoint", async () => {
  const sumOfEvens = problems.find((p) => p.slug === "sum-of-evens")!;
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetch);
  const body = {
    problem_slug: sumOfEvens.slug,
    code: sumOfEvens.starterCode,
    test_results: [{ id: sumOfEvens.publicTests[0].id, passed: false, actual: "0" }],
  };
  await postAttempt("https://api.example.com/", "test-token", body);
  expect(fetch).toHaveBeenCalledWith("https://api.example.com/attempts", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
});

it("saves a signed-in timed out run and shows findings returned by the API", async () => {
  const problem = problems.find((p) => p.slug === "sum-of-evens")!;
  vi.stubEnv("VITE_API_URL", "https://api.example.com");
  run.mockResolvedValue({ status: "timeout" });
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 42,
      test_results: [],
      static_findings: [
        { source: "ruff", code: "F401", message: "Unused import", line: 1, column: 8 },
      ],
    }),
  });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(
    <ProblemView
      problem={problem}
      conceptNames={{}}
      relatedResources={[]}
      onBack={() => {}}
      accessToken="test-token"
    />,
  );

  await screen.findByText("Python editor ready");
  await user.click(screen.getByRole("button", { name: "Run public tests" }));

  expect(await screen.findByText("Attempt saved.")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("Timed out");
  expect(screen.getByText("Line 1: Unused import (F401)")).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith("https://api.example.com/attempts", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ problem_slug: problem.slug, code: problem.starterCode, test_results: [] }),
  });
});
