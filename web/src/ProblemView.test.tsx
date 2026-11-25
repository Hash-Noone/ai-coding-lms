// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { postAttempt } from "./attempts";
import { sampleProblem } from "./sampleProblem";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: null }));
vi.mock("./pythonRunner", () => ({
  RUN_TIMEOUT_MS: 3000,
  createPythonRunner: () => ({ run, dispose: vi.fn() }),
}));
vi.mock("./PythonEditor", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ onReady }: { onReady: (ready: boolean) => void }) => {
      useEffect(() => onReady(true), [onReady]);
      return <div>Python editor ready</div>;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("opens the sample and shows pass or fail for each public test", async () => {
  run.mockResolvedValue({
    status: "completed",
    results: [
      { id: "mixed", passed: false, actual: "0" },
      { id: "negative", passed: true, actual: "0" },
      { id: "empty", passed: true, actual: "0" },
    ],
  });
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Open Sum of positive numbers" }));
  expect(screen.getByRole("heading", { name: "Sum of positive numbers" })).toBeTruthy();
  await screen.findByText("Python editor ready");
  await user.click(screen.getByRole("button", { name: "Run public tests" }));
  expect(await screen.findByText("2 of 3 public tests passed")).toBeTruthy();
  expect(screen.getByText("Expected 8, got 0")).toBeTruthy();
  expect(screen.getAllByText("Pass")).toHaveLength(2);
  expect(screen.getByText("Fail")).toBeTruthy();
  expect(run).toHaveBeenCalledWith({
    code: sampleProblem.starterCode, entryPoint: sampleProblem.entryPoint, tests: sampleProblem.publicTests,
  });
});

it("posts the submitted code and public test results to the authenticated attempts endpoint", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetch);
  const body = {
    problem_slug: sampleProblem.slug,
    code: sampleProblem.starterCode,
    test_results: [{ id: "mixed", passed: false, actual: "0" }],
  };
  await postAttempt("https://api.example.com/", "test-token", body);
  expect(fetch).toHaveBeenCalledWith("https://api.example.com/attempts", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
});
