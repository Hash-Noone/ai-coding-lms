import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it.each(["YOUR_SUPABASE_URL", "https://", "ftp://example.com"])(
  "renders the unconfigured state for Supabase URL %s",
  async (url) => {
    vi.stubEnv("VITE_SUPABASE_URL", url);
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
    const { App } = await import("./App");

    expect(renderToStaticMarkup(<App />)).toContain("Sign-in is not configured.");
  },
);

it("strips a trailing /rest/v1 path from VITE_SUPABASE_URL", async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co/rest/v1/");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  const { supabase } = await import("./supabase");

  expect(supabase).not.toBeNull();
  expect((supabase as unknown as { authUrl: URL }).authUrl.href).toBe(
    "https://example.supabase.co/auth/v1",
  );
});
