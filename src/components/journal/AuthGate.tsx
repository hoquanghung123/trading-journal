import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { Terminal as TerminalIcon, LogIn } from "lucide-react";

interface Props {
  children: (user: User) => React.ReactNode;
}

export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e.message ?? "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;
  if (session?.user) return <>{children(session.user)}</>;

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="glass-strong rounded-xl w-full max-w-sm p-6 space-y-4"
      >
        <div className="flex items-center gap-2 justify-center">
          <TerminalIcon className="w-5 h-5 text-neon-cyan text-glow-cyan" />
          <h1 className="text-sm font-bold tracking-[0.3em] text-neon-cyan text-glow-cyan">
            ICT_JOURNAL
          </h1>
        </div>
        <div className="text-center text-[10px] tracking-widest text-muted-foreground">
          // {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm outline-none"
          />
        </label>

        {err && <div className="text-xs text-neon-red">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold tracking-widest bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/60 rounded hover:bg-neon-cyan/30 text-glow-cyan disabled:opacity-50"
        >
          <LogIn className="w-3.5 h-3.5" />
          {busy ? "..." : mode === "signin" ? "SIGN IN" : "SIGN UP"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-[10px] tracking-widest text-muted-foreground hover:text-neon-cyan"
        >
          {mode === "signin" ? "// NO ACCOUNT? SIGN UP" : "// HAVE ACCOUNT? SIGN IN"}
        </button>
      </form>
    </div>
  );
}
