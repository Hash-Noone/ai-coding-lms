/// <reference lib="webworker" />
import type { loadPyodide } from "pyodide";
import { version } from "pyodide/package.json";
import { runPythonTests, type RunRequest, type WorkerReply } from "./pythonTests";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const reply = (message: WorkerReply) => worker.postMessage(message);
const runtimeUrl = `https://cdn.jsdelivr.net/pyodide/v${version}/full/pyodide.mjs`;

async function initialize() {
  try {
    const runtime = await import(/* @vite-ignore */ runtimeUrl) as { loadPyodide: typeof loadPyodide };
    const pyodide = await runtime.loadPyodide({
      jsglobals: Object.create(null),
      stdout: () => {},
      stderr: () => {},
    });
    worker.onmessage = (event: MessageEvent<RunRequest>) => {
      try {
        reply({ type: "results", results: runPythonTests(pyodide, event.data) });
      } catch {
        reply({ type: "error", message: "Python could not finish the run. Try running your code again." });
      }
    };
    reply({ type: "ready" });
  } catch {
    reply({ type: "error", message: "Could not load Pyodide. Check your connection and try again." });
  }
}

void initialize();
