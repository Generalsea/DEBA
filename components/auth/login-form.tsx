"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google") {
    setError(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) setError(error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start OAuth.");
    }
  }

  return (
    <section>
      <h1>Sign in to DEBA</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
        <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input aria-label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <button type="button" onClick={() => oauth("google")} style={{ marginTop: 12 }}>
        Continue with Google
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
