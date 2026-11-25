import { afterEach, expect, it, vi } from "vitest";
import { createPythonRunner, RUN_TIMEOUT_MS, type RunnerWorker } from "./pythonRunner";
import type { RunRequest, WorkerReply } from "./pythonTests";

const request: RunRequest = { code: "while True: pass", entryPoint: "solve", tests: [] };
const results = [{ id: "example", passed: true }];

function fakeWorker() {
  const worker: RunnerWorker = {
    onmessage: null,
    onerror: null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  };
  return Object.assign(worker, {
    reply: (data: WorkerReply) => worker.onmessage?.(new MessageEvent("message", { data })),
  });
}

afterEach(() => vi.useRealTimers());

it("waits for Pyodide to download before timing execution and replaces a timed-out worker", async () => {
  vi.useFakeTimers();
  const first = fakeWorker();
  const replacement = fakeWorker();
  const onState = vi.fn();
  const createWorker = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(replacement);
  const runner = createPythonRunner(onState, createWorker);

  const firstRun = runner.run(request);
  expect(onState).toHaveBeenLastCalledWith("loading");
  vi.advanceTimersByTime(RUN_TIMEOUT_MS + 1);
  expect(first.postMessage).not.toHaveBeenCalled();
  expect(first.terminate).not.toHaveBeenCalled();
  first.reply({ type: "ready" });
  expect(onState).toHaveBeenLastCalledWith("running");
  expect(first.postMessage).toHaveBeenCalledWith(request);

  vi.advanceTimersByTime(RUN_TIMEOUT_MS);
  expect(await firstRun).toEqual({ status: "timeout" });
  expect(first.terminate).toHaveBeenCalledOnce();
  expect(createWorker).toHaveBeenCalledTimes(2);
  expect(onState).toHaveBeenLastCalledWith("loading");

  first.reply({ type: "results", results });
  expect(onState).toHaveBeenLastCalledWith("loading");
  replacement.reply({ type: "ready" });
  const nextRun = runner.run({ ...request, code: "def solve(): return 1" });
  replacement.reply({ type: "results", results });
  expect(await nextRun).toEqual({ status: "completed", results });
  expect(onState).toHaveBeenLastCalledWith("ready");
  runner.dispose();
  expect(replacement.terminate).toHaveBeenCalledOnce();
});

it("lets the learner retry after a failed download", async () => {
  const first = fakeWorker();
  const second = fakeWorker();
  const onState = vi.fn();
  const runner = createPythonRunner(onState, vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second));

  const firstRun = runner.run(request);
  first.reply({ type: "error", message: "Download failed" });
  expect(await firstRun).toEqual({ status: "error", message: "Download failed" });
  expect(onState).toHaveBeenLastCalledWith("idle");
  expect(first.terminate).toHaveBeenCalledOnce();

  const secondRun = runner.run(request);
  second.reply({ type: "ready" });
  second.reply({ type: "results", results });
  expect(await secondRun).toEqual({ status: "completed", results });
  runner.dispose();
});
