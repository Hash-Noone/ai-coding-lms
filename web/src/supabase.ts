/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

function isHttpUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && publishableKey && isHttpUrl(url)
  ? createClient(url, publishableKey)
  : null;
