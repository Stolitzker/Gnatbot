import { createServerFn } from "@tanstack/react-start";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { createGagPicker, GNAT_FALLBACK_LINES, type GnatTurn } from "@/lib/gnat-persona";
import { gnatReply } from "@/lib/gnat-ai";

type GnatContext = { supabase: SupabaseClient<Database>; userId: string };

const fallbackGag = createGagPicker(GNAT_FALLBACK_LINES);

const DEFAULT_TITLE = "untitled rant";

function requireThreadId(data: unknown): { threadId: string } {
  const value = (data as { threadId?: unknown })?.threadId;
  if (typeof value !== "string" || value.length === 0) throw new Error("Missing chat id");
  return { threadId: value };
}

function requireExchange(data: unknown) {
  const { threadId } = requireThreadId(data);
  const value = data as { userText?: unknown; botText?: unknown };
  if (typeof value.userText !== "string" || typeof value.botText !== "string") {
    throw new Error("Missing exchange");
  }
  return { threadId, userText: value.userText, botText: value.botText };
}

function requirePrompt(data: unknown) {
  const { threadId } = requireThreadId(data);
  const value = data as { text?: unknown };
  if (typeof value.text !== "string" || value.text.trim().length === 0) throw new Error("Missing message");
  return { threadId, text: value.text.trim().slice(0, 2000) };
}

async function claimThread(context: GnatContext, threadId: string) {
  const { data, error } = await context.supabase
    .from("threads")
    .select("id,title")
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That chat isn't yours");
  return data as { id: string; title: string };
}

export const getGnatProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { displayName: data?.display_name ?? "annoying human" };
  });

export const listGnatThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data as { id: string; title: string; updated_at: string }[];
  });

export const createGnatThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: DEFAULT_TITLE })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data as { id: string };
  });

export const deleteGnatThread = createServerFn({ method: "POST" })
  .inputValidator(requireThreadId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("threads").delete().eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGnatThreadMessages = createServerFn({ method: "GET" })
  .inputValidator(requireThreadId)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await claimThread(context, data.threadId);

    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("role,content,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows as { role: "user" | "bot"; content: string; created_at: string }[];
  });

export const sendGnatMessage = createServerFn({ method: "POST" })
  .inputValidator(requirePrompt)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const thread = await claimThread(context, data.threadId);

    const { error: insertError } = await supabase
      .from("messages")
      .insert({ thread_id: thread.id, user_id: userId, role: "user", content: data.text });
    if (insertError) throw new Error(insertError.message);

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role,content")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: false })
      .limit(24);
    if (historyError) throw new Error(historyError.message);

    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    const displayName = (profile?.display_name as string | undefined) ?? "annoying human";

    const turns = (history as GnatTurn[]).slice().reverse();
    const reply = await gnatReply({ history: turns, displayName, fallback: fallbackGag });

    const { error: botError } = await supabase
      .from("messages")
      .insert({ thread_id: thread.id, user_id: userId, role: "bot", content: reply });
    if (botError) throw new Error(botError.message);

    const updated_at = new Date().toISOString();
    const patch =
      thread.title === DEFAULT_TITLE ? { title: data.text.slice(0, 40), updated_at } : { updated_at };
    await supabase.from("threads").update(patch).eq("id", thread.id);

    return { reply };
  });

export const recordGnatExchange = createServerFn({ method: "POST" })
  .inputValidator(requireExchange)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const thread = await claimThread(context, data.threadId);

    const { error } = await supabase.from("messages").insert([
      { thread_id: thread.id, user_id: userId, role: "user", content: data.userText },
      { thread_id: thread.id, user_id: userId, role: "bot", content: data.botText },
    ]);
    if (error) throw new Error(error.message);

    const updated_at = new Date().toISOString();
    const patch =
      thread.title === DEFAULT_TITLE ? { title: data.userText.slice(0, 40), updated_at } : { updated_at };
    await supabase.from("threads").update(patch).eq("id", thread.id);

    return { ok: true };
  });
