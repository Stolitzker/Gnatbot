// Server-side only: called from the sendGnatMessage server function.
// Plain fetch, no SDK, so nothing extra ships to the browser bundle.
// The API key is read at call time from process.env and never leaves the server.
import { gnatMood } from "@/lib/gnat-behavior";
import { gnatInstructions, type GnatTurn } from "@/lib/gnat-persona";

type Provider = "anthropic" | "openai";

const MAX_TOKENS = 150; // replies are meant to be under 25 words

function provider(): Provider {
  return process.env.AI_PROVIDER?.toLowerCase() === "openai" ? "openai" : "anthropic";
}

async function askAnthropic(system: string, turns: { role: "user" | "assistant"; content: string }[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: MAX_TOKENS,
      system,
      messages: turns,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n")
    .trim();
}

async function askOpenAI(system: string, turns: { role: "user" | "assistant"; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...turns],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

export async function gnatReply(opts: {
  history: GnatTurn[];
  displayName: string;
  fallback: () => string;
}): Promise<string> {
  // Both APIs want the conversation to start with a user turn.
  const turns = opts.history.map((t) => ({
    role: t.role === "user" ? ("user" as const) : ("assistant" as const),
    content: t.content,
  }));
  while (turns.length > 0 && turns[0]?.role === "assistant") turns.shift();

  const lastUser = opts.history.filter((t) => t.role === "user").at(-1)?.content ?? "";
  const system = `${gnatInstructions(opts.displayName)}\nCurrent reaction: ${gnatMood(lastUser)}.`;

  try {
    const text = provider() === "openai" ? await askOpenAI(system, turns) : await askAnthropic(system, turns);
    if (text) return text;
  } catch (error) {
    console.error("[gnat] reply failed", error);
  }

  return opts.fallback();
}
