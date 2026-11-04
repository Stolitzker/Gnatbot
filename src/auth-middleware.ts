/// <reference types="vite/client" />
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import { supabase as browserClient } from "./client";
import type { Database } from "./types";

/**
 * Protects server functions.
 *
 * client: attaches the signed-in user's access token as a Bearer header.
 * server: verifies the token with Supabase, then provides
 *         context.supabase (a client acting AS that user, so RLS applies)
 *         and context.userId.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { data } = await browserClient.auth.getSession();
    const token = data.session?.access_token;
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  })
  .server(async ({ next }) => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!url || !key) throw new Error("Supabase environment variables are not set");

    const header = getRequestHeader("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new Error("Unauthorized");

    const supabase = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) throw new Error("Unauthorized");

    return next({ context: { supabase, userId: data.user.id } });
  });
