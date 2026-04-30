import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { Brain, LogIn, Loader2, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

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
        toast.success("Account created! Check your email for verification.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
    } catch (e: any) {
      setErr(e.message ?? "Authentication failed");
      toast.error(e.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;
  if (session?.user) return <>{children(session.user)}</>;

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[80px]" />

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] border border-white p-12 relative z-10">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 rounded-[28px] forest-gradient flex items-center justify-center shadow-xl shadow-primary/20 mb-6">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Chartmate</h1>
            <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mt-2">
              Trading Journal
            </p>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-xl font-black text-foreground">
              {mode === "signin" ? "Welcome back!" : "Join the community"}
            </h2>
            <p className="text-sm font-medium text-muted-foreground mt-2">
              {mode === "signin"
                ? "Enter your credentials to access your journal"
                : "Create an account to start your trading journey"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Email Address
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
                  className="w-full bg-muted/30 border border-transparent rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Security Password
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
                  className="w-full bg-muted/30 border border-transparent rounded-2xl pl-14 pr-6 py-4 text-sm font-bold outline-none focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
            </div>

            {err && (
              <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-xs font-bold text-center animate-in shake-in duration-300">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-14 forest-gradient text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {mode === "signin" ? "Sign In Now" : "Create Account"}
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/50 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              {mode === "signin"
                ? "Don't have an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
          &copy; 2026 Chartmate • Modern Trading Journal
        </p>
      </div>
    </div>
  );
}
