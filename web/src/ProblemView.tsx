import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { BankProblem, CuratedResource } from "virtual:problem-bank";
import { postAttempt } from "./attempts";
import { createPythonRunner, RUN_TIMEOUT_MS, type RunnerState, type RunOutcome } from "./pythonRunner";

const PythonEditor = lazy(() => import("./PythonEditor"));
const apiUrl = import.meta.env.VITE_API_URL?.trim();

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}

function formatCall(entryPoint: string, args: unknown[]): string {
  return `${entryPoint}(${args.map(formatValue).join(", ")})`;
}

export function resourceUrl(resource: CuratedResource): string {
  if (resource.start_seconds > 0) {
    const sep = resource.url.includes("?") ? "&" : "?";
    return `${resource.url}${sep}t=${resource.start_seconds}s`;
  }
  return resource.url;
}

export function ProblemView({
  problem,
  conceptNames,
  relatedResources,
  onBack,
  onSolved,
  accessToken,
}: {
  problem: BankProblem;
  conceptNames: Record<string, string>;
  relatedResources: CuratedResource[];
  onBack: () => void;
  onSolved?: (slug: string) => void;
  accessToken?: string;
}) {
  const [code, setCode] = useState(problem.starterCode);
  const [resetCount, setResetCount] = useState(0);
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
    const result = await instance.run({
      code,
      entryPoint: problem.entryPoint,
      tests: problem.publicTests,
    });
    if (runner.current !== instance) return;
    setOutcome(result);

    if (result.status === "completed") {
      const allPassed = result.results.length > 0 && result.results.every((r) => r.passed);
      if (allPassed) onSolved?.(problem.slug);
    }

    if (result.status !== "completed" || !apiUrl || !accessToken) return;

    setSaveStatus("Saving attempt…");
    let message: string;
    try {
      await postAttempt(apiUrl, accessToken, {
        problem_slug: problem.slug,
        code,
        test_results: result.results,
      });
      message = "Attempt saved.";
    } catch {
      message = "Could not save this attempt. Your test results are still available here.";
    }
    if (runner.current === instance && runSequence.current === sequence) setSaveStatus(message);
  }

  function resetStarter() {
    setCode(problem.starterCode);
    setOutcome(undefined);
    setSaveStatus("");
    setResetCount((n) => n + 1);
  }

  const busy = runnerState === "loading" || runnerState === "running";
  const results = outcome?.status === "completed" ? outcome.results : undefined;

  return (
    <section aria-labelledby="problem-title">
      <div className="problem-toolbar">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← All problems
        </button>
        <div className="concept-pills">
          {problem.concepts.map((slug) => (
            <span key={slug} className="tag">{conceptNames[slug] ?? slug}</span>
          ))}
        </div>
      </div>

      <div className="problem-layout">
        <div className="problem-panel">
          <h2 id="problem-title">{problem.title}</h2>
          <p>{problem.prompt}</p>
          <p className="muted-line">
            Entry point: <code>{problem.entryPoint}</code>
          </p>

          <h3>Public examples</h3>
          <ul className="example-list">
            {problem.publicTests.map((test) => (
              <li key={test.id}>
                <span className="example-label">{test.label}</span>
                <pre>{`${formatCall(problem.entryPoint, test.args)} → ${formatValue(test.expected)}`}</pre>
              </li>
            ))}
          </ul>

          {relatedResources.length > 0 && (
            <div className="related-resources">
              <h3>Helpful videos</h3>
              <ul>
                {relatedResources.slice(0, 4).map((resource) => (
                  <li key={`${resource.url}-${resource.start_seconds}`}>
                    <a href={resourceUrl(resource)} target="_blank" rel="noreferrer">
                      {resource.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="problem-panel">
          <div className="editor-header">
            <h3>Python editor</h3>
            <button type="button" className="btn-secondary" onClick={resetStarter} disabled={busy}>
              Reset code
            </button>
          </div>
          <Suspense fallback={<p>Loading editor…</p>}>
            <PythonEditor
              key={`${problem.slug}-${resetCount}`}
              initialCode={problem.starterCode}
              onChange={setCode}
              onReady={setEditorReady}
            />
          </Suspense>
          <div className="run-controls">
            <button type="button" className="btn-primary" onClick={run} disabled={!editorReady || busy}>
              Run public tests
            </button>
            {runnerState === "loading" && (
              <span role="status">
                {outcome?.status === "timeout" ? "Restarting Python…" : "Loading Pyodide (Python runtime)…"}
              </span>
            )}
            {runnerState === "running" && <span role="status">Running public tests…</span>}
          </div>

          <h3>Public test results</h3>
          {outcome?.status === "timeout" && (
            <p role="alert">
              Timed out after {RUN_TIMEOUT_MS / 1000} seconds. Python is reset; update your code and run again.
            </p>
          )}
          {outcome?.status === "error" && <p role="alert">{outcome.message}</p>}
          {results ? (
            <div aria-live="polite">
              <p className="results-summary">
                {results.filter((result) => result.passed).length} of {problem.publicTests.length} public tests passed
              </p>
              <ul className="test-results">
                {results.map((result) => {
                  const test = problem.publicTests.find(({ id }) => id === result.id);
                  return (
                    <li key={result.id}>
                      <strong className={result.passed ? "pass" : "fail"}>
                        {result.passed ? "Pass" : "Fail"}
                      </strong>
                      {" · "}
                      {test?.label ?? result.id}
                      {!result.passed && (
                        <div className="test-detail">
                          {result.error ?? `Expected ${formatValue(test?.expected)}, got ${result.actual}`}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            !outcome && (
              <p className="muted-line">
                Run your solution to check it against the {problem.publicTests.length} public tests.
              </p>
            )
          )}
          {saveStatus && <p role="status">{saveStatus}</p>}
        </div>
      </div>
    </section>
  );
}
