// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { problems } from "virtual:problem-bank";
import { App } from "./App";
import { postAttempt } from "./attempts";

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("opens a problem from the bank and shows pass or fail for each public test", async () => {
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

  await user.click(screen.getByRole("button", { name: `Open ${sumOfEvens.title}` }));
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

  await user.click(screen.getByRole("button", { name: `Open ${sumOfEvens.title}` }));
  const editor = await screen.findByLabelText("Mock Python editor") as HTMLTextAreaElement;
  await user.clear(editor);
  await user.type(editor, "def sum_evens(numbers): return 42");

  await user.click(screen.getByRole("button", { name: "← All problems" }));
  await user.click(screen.getByRole("button", { name: `Open ${sumOfEvens.title}` }));
  const reopened = await screen.findByLabelText("Mock Python editor") as HTMLTextAreaElement;
  expect(reopened.value).toBe("def sum_evens(numbers): return 42");

  await user.click(screen.getByRole("button", { name: "Reset code" }));
  const reset = await screen.findByLabelText("Mock Python editor") as HTMLTextAreaElement;
  expect(reset.value).toBe(sumOfEvens.starterCode);
});

it("posts the submitted code and public test results to the authenticated attempts endpoint", async () => {
  const sumOfEvens = problems.find((p) => p.slug === "sum-of-evens")!;
  const fetch = vi.fn().mockResolvedValue({ ok: true });
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
