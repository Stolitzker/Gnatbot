/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to .env and restart the dev server.",
  );
}

const isBrowser = typeof window !== "undefined";

// Shared client for the browser (sessions live in localStorage).
// On the server it is only used for module imports; server functions create
// their own per-request client in auth-middleware.ts.
export const supabase = createClient<Database>(url, key, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});
