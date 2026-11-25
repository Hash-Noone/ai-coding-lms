// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthApiError, type AuthChangeEvent, type Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const auth = vi.mocked(supabase!.auth);
const unsubscribe = vi.fn();
const credentials = { email: "learner@example.com", password: "test-password" };
const session: Session = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "test-user",
    email: credentials.email,
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  },
};
let notify: (event: AuthChangeEvent, session: Session | null) => void;

function initializeWith(initialSession: Session | null) {
  auth.onAuthStateChange.mockImplementation((callback) => {
    notify = callback;
    notify("INITIAL_SESSION", initialSession);
    return { data: { subscription: { id: "test", callback, unsubscribe } } };
  });
}

beforeEach(() => initializeWith(null));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), credentials.email);
  await user.type(screen.getByLabelText("Password"), credentials.password);
}

it("signs up with an email and password and prompts for confirmation", async () => {
  auth.signUp.mockResolvedValue({ data: { user: session.user, session: null }, error: null });
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "Create an account" }));
  await fillCredentials(user);
  await user.click(screen.getByRole("button", { name: "Sign up" }));

  expect(auth.signUp).toHaveBeenCalledWith(credentials);
  expect(screen.getByRole("status").textContent).toMatch(/check your email/i);
});

it("shows an invalid sign-in error and lets the learner retry", async () => {
  auth.signInWithPassword.mockResolvedValueOnce({
    data: { user: null, session: null },
    error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
  }).mockImplementationOnce(async () => {
    notify("SIGNED_IN", session);
    return { data: { user: session.user, session }, error: null };
  });
  const user = userEvent.setup();
  render(<App />);
  await fillCredentials(user);
  const signIn = screen.getByRole("button", { name: "Sign in" });

  await user.click(signIn);
  expect(screen.getByRole("alert").textContent).toBe("Invalid login credentials");
  await user.click(signIn);

  expect(auth.signInWithPassword).toHaveBeenLastCalledWith(credentials);
  expect(screen.getByText("Signed in as learner@example.com.")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("restores a session on load and signs out on this device", async () => {
  initializeWith(session);
  auth.signOut.mockImplementation(async () => {
    notify("SIGNED_OUT", null);
    return { error: null };
  });
  const user = userEvent.setup();
  const { unmount } = render(<App />);

  expect(screen.getByText("Signed in as learner@example.com.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Sign out" }));

  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});
