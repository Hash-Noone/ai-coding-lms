import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { concepts, problems, resources, type BankProblem } from "virtual:problem-bank";
import { supabase } from "./supabase";
import { ProblemView, resourceUrl } from "./ProblemView";
import "./practice.css";

const SOLVED_STORAGE_KEY = "ai-coding-lms:solved";
const SESSION_URL = "https://app.devin.ai/sessions/40bf9e5ed6a0494891a02defce1018e7";

function loadSolved(): string[] {
  try {
    const raw = window.localStorage.getItem(SOLVED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function App() {
  const [tab, setTab] = useState<"problems" | "resources">("problems");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [solved, setSolved] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadSolved()));
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    );
    return () => subscription.unsubscribe();
  }, []);

  const conceptNames = useMemo(
    () => Object.fromEntries(concepts.map((c) => [c.slug, c.name])),
    [],
  );

  const selectedProblem: BankProblem | undefined = useMemo(
    () => problems.find((p) => p.slug === selectedSlug),
    [selectedSlug],
  );

  const filteredProblems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return problems.filter((problem) => {
      if (conceptFilter !== "all" && !problem.concepts.includes(conceptFilter)) return false;
      if (!query) return true;
      return (
        problem.title.toLowerCase().includes(query)
        || problem.prompt.toLowerCase().includes(query)
        || problem.concepts.some((slug) => (conceptNames[slug] ?? slug).toLowerCase().includes(query))
      );
    });
  }, [conceptFilter, search, conceptNames]);

  const filteredResources = useMemo(() => {
    if (conceptFilter === "all") return resources;
    return resources.filter((r) => r.concepts.includes(conceptFilter));
  }, [conceptFilter]);

  const relatedResources = useMemo(() => {
    if (!selectedProblem) return [];
    const set = new Set(selectedProblem.concepts);
    return resources.filter((r) => r.concepts.some((c) => set.has(c)));
  }, [selectedProblem]);

  function markSolved(slug: string) {
    setSolved((prev) => {
      if (prev.includes(slug)) return prev;
      const next = [...prev, slug];
      try {
        window.localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors in private browsing.
      }
      return next;
    });
  }

  return (
    <main>
      <header className="app-header">
        <div>
          <h1>AI Coding LMS</h1>
          <p className="subtitle">Practice Python in your browser with instant public test feedback.</p>
        </div>
        <nav className="app-nav" aria-label="Primary">
          <button
            type="button"
            className={tab === "problems" && !selectedProblem ? "nav-btn active" : "nav-btn"}
            onClick={() => {
              setTab("problems");
              setSelectedSlug(null);
            }}
          >
            Problems ({problems.length})
          </button>
          <button
            type="button"
            className={tab === "resources" && !selectedProblem ? "nav-btn active" : "nav-btn"}
            onClick={() => {
              setTab("resources");
              setSelectedSlug(null);
            }}
          >
            Resources ({resources.length})
          </button>
        </nav>
      </header>

      {selectedProblem ? (
        <ProblemView
          key={selectedProblem.slug}
          problem={selectedProblem}
          conceptNames={conceptNames}
          relatedResources={relatedResources}
          onBack={() => setSelectedSlug(null)}
          onSolved={markSolved}
          accessToken={session?.access_token}
        />
      ) : tab === "problems" ? (
        <section aria-labelledby="bank-heading">
          <div className="bank-controls">
            <div className="bank-heading-row">
              <h2 id="bank-heading">Problem bank</h2>
              <span className="muted-line">
                {solved.length} of {problems.length} solved in this browser
              </span>
            </div>
            <label className="search-label">
              <span className="sr-only">Search problems</span>
              <input
                type="search"
                className="search-input"
                placeholder="Search problems by title, prompt, or concept…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="filter-bar" role="group" aria-label="Filter by concept">
              <button
                type="button"
                className={conceptFilter === "all" ? "filter-pill active" : "filter-pill"}
                onClick={() => setConceptFilter("all")}
              >
                All ({problems.length})
              </button>
              {concepts.map((concept) => (
                <button
                  key={concept.slug}
                  type="button"
                  className={conceptFilter === concept.slug ? "filter-pill active" : "filter-pill"}
                  onClick={() => setConceptFilter(concept.slug)}
                >
                  {concept.name}
                </button>
              ))}
            </div>
          </div>

          {filteredProblems.length === 0 ? (
            <p className="problem-panel muted-line">No problems match your current filter.</p>
          ) : (
            <ul className="problem-grid">
              {filteredProblems.map((problem) => {
                const isSolved = solved.includes(problem.slug);
                return (
                  <li key={problem.slug} className="problem-card">
                    <div className="problem-card-top">
                      <h3>{problem.title}</h3>
                      {isSolved && <span className="solved-badge">Solved</span>}
                    </div>
                    <p className="problem-card-prompt">{problem.prompt}</p>
                    <div className="concept-pills">
                      {problem.concepts.map((slug) => (
                        <span key={slug} className="tag">{conceptNames[slug] ?? slug}</span>
                      ))}
                    </div>
                    <div className="problem-card-footer">
                      <span className="muted-line">{problem.publicTests.length} public tests</span>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setSelectedSlug(problem.slug)}
                      >
                        Open {problem.title}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section aria-labelledby="resources-heading">
          <div className="bank-controls">
            <h2 id="resources-heading">Curated Python videos</h2>
            <div className="filter-bar" role="group" aria-label="Filter resources by concept">
              <button
                type="button"
                className={conceptFilter === "all" ? "filter-pill active" : "filter-pill"}
                onClick={() => setConceptFilter("all")}
              >
                All ({resources.length})
              </button>
              {concepts.map((concept) => (
                <button
                  key={concept.slug}
                  type="button"
                  className={conceptFilter === concept.slug ? "filter-pill active" : "filter-pill"}
                  onClick={() => setConceptFilter(concept.slug)}
                >
                  {concept.name}
                </button>
              ))}
            </div>
          </div>
          <ul className="resource-list">
            {filteredResources.map((resource) => (
              <li key={`${resource.url}-${resource.start_seconds}`} className="problem-panel resource-item">
                <div>
                  <a href={resourceUrl(resource)} target="_blank" rel="noreferrer" className="resource-link">
                    {resource.title}
                  </a>
                  <div className="concept-pills">
                    {resource.concepts.map((slug) => (
                      <span key={slug} className="tag">{conceptNames[slug] ?? slug}</span>
                    ))}
                    {resource.mistake_type && (
                      <span className="tag">{resource.mistake_type.replaceAll("_", " ")}</span>
                    )}
                  </div>
                </div>
                <a href={resourceUrl(resource)} target="_blank" rel="noreferrer" className="btn-secondary">
                  Watch →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="account-panel problem-panel">
        {supabase ? <Auth client={supabase} session={session} /> : <p>Sign-in is not configured.</p>}
      </div>

      <footer className="app-footer">
        <span>AI Coding LMS beta</span>
        <a href={SESSION_URL} target="_blank" rel="noreferrer">Request changes</a>
      </footer>
    </main>
  );
}

function Auth({ client, session }: { client: SupabaseClient; session: Session | null | undefined }) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const signingUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const credentials = { email, password };
      const result = signingUp
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);

      if (result.error) {
        setError(result.error.message);
      } else {
        setPassword("");
        if (signingUp && !result.data.session) {
          setMessage("Check your email to confirm your account before signing in.");
        }
      }
    } catch {
      setError("Could not reach the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) setError(result.error.message);
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (session === undefined) return <p role="status">Checking sign-in status…</p>;

  return (
    <section aria-labelledby="auth-heading">
      <h2 id="auth-heading">{session ? "Account" : signingUp ? "Create an account" : "Sign in"}</h2>
      {session ? (
        <div className="auth-signed-in">
          <p>Signed in as {session.user.email}.</p>
          <button type="button" className="btn-secondary" onClick={signOut} disabled={busy}>Sign out</button>
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={signingUp ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <div className="auth-actions">
              <button type="submit" className="btn-primary" disabled={busy}>
                {signingUp ? "Sign up" : "Sign in"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  setMode(signingUp ? "sign-in" : "sign-up");
                  setError("");
                  setMessage("");
                  setPassword("");
                }}
              >
                {signingUp ? "Back to sign in" : "Create an account"}
              </button>
            </div>
          </form>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
