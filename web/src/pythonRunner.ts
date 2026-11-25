import type { RunRequest, TestResult, WorkerReply } from "./pythonTests";

export type RunnerState = "idle" | "loading" | "ready" | "running";
export type RunOutcome =
  | { status: "completed"; results: TestResult[] }
  | { status: "timeout" }
  | { status: "error"; message: string };

export type RunnerWorker = {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage: (request: RunRequest) => void;
  terminate: () => void;
};

export const RUN_TIMEOUT_MS = 3_000;
const LOAD_TIMEOUT_MS = 60_000;

export function createPythonRunner(
  onState: (state: RunnerState) => void,
  createWorker: () => RunnerWorker = () => new Worker(
    new URL("./python.worker.ts", import.meta.url), { type: "module" },
  ),
) {
  let worker: RunnerWorker | undefined;
  let ready = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { request: RunRequest; resolve: (outcome: RunOutcome) => void } | undefined;

  function finish(outcome: RunOutcome) {
    const run = pending;
    pending = undefined;
    run?.resolve(outcome);
  }

  function stopWorker() {
    clearTimeout(timer);
    worker?.terminate();
    worker = undefined;
    ready = false;
  }

  function fail(message: string) {
    stopWorker();
    finish({ status: "error", message });
    onState("idle");
  }

  function execute() {
    if (!worker || !pending) return;
    const { request } = pending;
    onState("running");
    timer = setTimeout(() => {
      stopWorker();
      finish({ status: "timeout" });
      startWorker();
    }, RUN_TIMEOUT_MS);
    worker.postMessage(request);
  }

  function startWorker() {
    onState("loading");
    try {
      const next = createWorker();
      worker = next;
      timer = setTimeout(() => fail("Pyodide took too long to load. Try again."), LOAD_TIMEOUT_MS);
      next.onmessage = ({ data }) => {
        if (worker !== next) return;
        clearTimeout(timer);
        if (data.type === "ready") {
          ready = true;
          if (pending) execute();
          else onState("ready");
        } else if (data.type === "error") {
          fail(data.message);
        } else {
          finish({ status: "completed", results: data.results });
          onState("ready");
        }
      };
      next.onerror = () => {
        if (worker === next) fail("The Python worker stopped unexpectedly. Try again.");
      };
    } catch {
      fail("Could not start the Python worker. Try again.");
    }
  }

  return {
    run(request: RunRequest): Promise<RunOutcome> {
      if (pending) return Promise.resolve({ status: "error", message: "A run is already in progress." });
      return new Promise((resolve) => {
        pending = { request, resolve };
        if (ready) execute();
        else if (!worker) startWorker();
      });
    },
    dispose() {
      stopWorker();
      finish({ status: "error", message: "Run canceled." });
    },
  };
}
