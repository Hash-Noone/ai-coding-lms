import { type FormEvent, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

export function Auth({ client, session }: { client: SupabaseClient; session: Session | null | undefined }) {
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
