import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { postAttempt } from "./attempts";
import { createPythonRunner, RUN_TIMEOUT_MS, type RunnerState, type RunOutcome } from "./pythonRunner";
import { sampleProblem as problem } from "./sampleProblem";

const PythonEditor = lazy(() => import("./PythonEditor"));
const apiUrl = import.meta.env.VITE_API_URL?.trim();

export function ProblemView({ accessToken }: { accessToken?: string }) {
  const [code, setCode] = useState(problem.starterCode);
  const [editorReady, setEditorReady] = useState(false);
  const [runnerState, setRunnerState] = useState<RunnerState>("idle");
  const [outcome, setOutcome] = useState<RunOutcome>();
  const [saveStatus, setSaveStatus] = useState("");
  const runner = useRef<ReturnType<typeof createPythonRunner> | null>(null);
  const runSequence = useRef(0);

  useEffect(() => {
    const instance = createPythonRunner(setRunnerState);
    runner.current = instance;
    return () => {
      runner.current = null;
      instance.dispose();
    };
  }, []);

  async function run() {
    const instance = runner.current;
    if (!instance) return;
    const sequence = ++runSequence.current;
    setOutcome(undefined);
    setSaveStatus("");
    const result = await instance.run({ code, entryPoint: problem.entryPoint, tests: problem.publicTests });
    if (runner.current !== instance) return;
    setOutcome(result);
    if (result.status !== "completed" || !apiUrl || !accessToken) return;

    setSaveStatus("Saving attempt…");
    let message: string;
    try {
      await postAttempt(apiUrl, accessToken, {
        problem_slug: problem.slug, code, test_results: result.results,
      });
      message = "Attempt saved.";
    } catch {
      message = "Could not save this attempt. Your test results are still available here.";
    }
    if (runner.current === instance && runSequence.current === sequence) setSaveStatus(message);
  }

  const busy = runnerState === "loading" || runnerState === "running";
  const results = outcome?.status === "completed" ? outcome.results : undefined;

  return (
    <section aria-labelledby="problem-title" className="problem-layout">
      <div className="problem-panel">
        <p className="problem-category">Python practice / Sample problem</p>
        <h2 id="problem-title">{problem.title}</h2>
        <p>{problem.prompt}</p>
        <h3>Example</h3>
        <pre>{`sum_positives([3, -2, 0, 5]) → 8`}</pre>
        <p>Complete <code>sum_positives(numbers)</code> and return an integer.</p>
      </div>
      <div className="problem-panel">
        <h3>Python editor</h3>
        <Suspense fallback={<p>Loading editor…</p>}>
          <PythonEditor initialCode={problem.starterCode} onChange={setCode} onReady={setEditorReady} />
        </Suspense>
        <div className="run-controls">
          <button type="button" onClick={run} disabled={!editorReady || busy}>Run public tests</button>
          {runnerState === "loading" && (
            <span role="status">{outcome?.status === "timeout" ? "Restarting Python…" : "Loading Pyodide (Python runtime)…"}</span>
          )}
          {runnerState === "running" && <span role="status">Running public tests…</span>}
        </div>
        <h3>Public test results</h3>
        {outcome?.status === "timeout" && (
          <p role="alert">Timed out after {RUN_TIMEOUT_MS / 1000} seconds. Python is reset; update your code and run again.</p>
        )}
        {outcome?.status === "error" && <p role="alert">{outcome.message}</p>}
        {results ? (
          <div aria-live="polite">
            <p>{results.filter((result) => result.passed).length} of {problem.publicTests.length} public tests passed</p>
            <ul className="test-results">
              {results.map((result) => {
                const test = problem.publicTests.find(({ id }) => id === result.id);
                return (
                  <li key={result.id}>
                    <strong className={result.passed ? "pass" : "fail"}>{result.passed ? "Pass" : "Fail"}</strong>
                    {" · "}{test?.label ?? result.id}
                    {!result.passed && <div>{result.error ?? `Expected ${test?.expected}, got ${result.actual}`}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : !outcome && <p>Run your solution to see how it does on the {problem.publicTests.length} public tests.</p>}
        {saveStatus && <p role="status">{saveStatus}</p>}
      </div>
    </section>
  );
}
