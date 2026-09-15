import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { LogIn, Loader2, Mail, Lock, Terminal as TerminalIcon } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

interface Props {
  children: (user: User) => React.ReactNode;
}

export function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
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
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to verify.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Authentication failed";
      setErr(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (session?.user) return <>{children(session.user)}</>;

  const heading =
    mode === "forgot" ? "Reset password" : mode === "signup" ? "Create account" : "Welcome back";
  const sub =
    mode === "forgot"
      ? "We'll email you a link to choose a new password"
      : mode === "signup"
        ? "Sign up to start journaling"
        : "Sign in to your journal";

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 relative overflow-hidden">
      <ThemeToggle className="top-4" />
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[80px]" />

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-card rounded-[48px] border border-border p-10 sm:p-12 relative z-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 rounded-[28px] forest-gradient flex items-center justify-center shadow-xl shadow-primary/20 mb-6">
              <TerminalIcon className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Chartmate</h1>
            <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mt-2">
              Trading Journal
            </p>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-xl font-black text-foreground">{heading}</h2>
            <p className="text-sm font-medium text-muted-foreground mt-2">{sub}</p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Email
              </label>
              <div className="relative group">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/30 border border-transparent rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                />
              </div>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/30 border border-transparent rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:bg-card focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all text-foreground"
                  />
                </div>
              </div>
            )}

            {mode === "signin" && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setErr(null);
                  }}
                  className="text-xs font-bold text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {err && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl text-xs font-bold text-center">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-14 forest-gradient text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in"}
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/50 text-center">
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === "signup" || mode === "forgot"
                ? "Already have an account? Sign in"
                : "Don't have an account? Create one"}
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          Chartmate
        </p>
      </div>
    </div>
  );
}
