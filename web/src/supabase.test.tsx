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
