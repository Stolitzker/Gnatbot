import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Gnatbot" },
      {
        name: "description",
        content: "Sign in so Gnatbot can remember every argument you have ever lost.",
      },
      { property: "og:title", content: "Sign in — Gnatbot" },
      {
        property: "og:description",
        content: "Gnatbot keeps your chats so it can bring them up later.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/chat", replace: true });
    });
  }, []);

  const goToChats = () => {
    void navigate({ to: "/chat", replace: true });
  };

  const emailSubmit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setNote(null);

    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name.trim() || email.trim().split("@")[0] },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        setNote(error.message);
        setBusy(false);
        return;
      }
      if (!data.session) {
        setNote("Almost — check your email and click the link, then come back and sign in.");
        setBusy(false);
        return;
      }
      goToChats();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setNote("That didn't work. Wrong email, wrong password, or you haven't signed up yet.");
      setBusy(false);
      return;
    }
    goToChats();
  };

  const googleSubmit = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    // On success the browser is sent to Google, then back to this site with a session.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setNote(error.message ?? "Google said no.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 bg-background px-5 py-10">
      <header className="text-center">
        <span className="animate-wiggle inline-block text-5xl">🦟</span>
        <h1 className="font-display text-3xl">Gnatbot wants a name</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in and it remembers every chat, forever. Unfortunately.
        </p>
      </header>

      <div className="rounded-2xl border-2 border-foreground bg-card p-4 shadow-brutal">
        <div className="mb-4 flex gap-2">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setNote(null);
              }}
              className={
                "flex-1 rounded-xl border-2 border-foreground px-3 py-2 font-display text-sm " +
                (mode === m ? "bg-primary text-primary-foreground" : "bg-background")
              }
            >
              {m === "in" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void emailSubmit();
          }}
        >
          {mode === "up" && (
            <label className="flex flex-col gap-1 text-xs font-bold uppercase">
              Name Gnatbot should use
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kitten Xia"
                className="rounded-xl border-2 border-foreground bg-background px-3 py-2 text-sm normal-case outline-none focus:ring-4 focus:ring-accent"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-bold uppercase">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border-2 border-foreground bg-background px-3 py-2 text-sm normal-case outline-none focus:ring-4 focus:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold uppercase">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-xl border-2 border-foreground bg-background px-3 py-2 text-sm normal-case outline-none focus:ring-4 focus:ring-accent"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl border-2 border-foreground bg-accent px-4 py-2 font-display text-accent-foreground shadow-brutal active:translate-y-0.5 disabled:opacity-50"
          >
            {busy ? "hmm… typing…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => void googleSubmit()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-background px-4 py-2 font-display shadow-brutal active:translate-y-0.5 disabled:opacity-50"
        >
          <span aria-hidden>🔵</span> Continue with Google
        </button>

        {note && <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{note}</p>}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        No chat is ever truly deleted. That's the joke. Or the threat.
      </p>
    </main>
  );
}
