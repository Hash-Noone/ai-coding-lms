/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    const cleanedPath = parsed.pathname.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
    return cleanedPath ? `${parsed.origin}${cleanedPath}` : parsed.origin;
  } catch {
    return null;
  }
}

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabase = url && publishableKey
  ? createClient(url, publishableKey)
  : null;
