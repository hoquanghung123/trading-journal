import { useEffect, useState } from "react";
import { BookOpen, Crosshair, Send, X } from "lucide-react";
import { navigateToPage } from "@/lib/nav-bus";
import { useQuery } from "@tanstack/react-query";
import { fetchEntries } from "@/lib/journal";
import { fetchPlaybook, playbookQueryKey } from "@/lib/playbook";
import { fetchSettings } from "@/lib/settings";

const STORAGE_KEY = "chartmate-onboarded";

export function OnboardingModal() {
  const [open, setOpen] = useState(false);

  const { data: entries } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: () => fetchEntries(),
  });
  const { data: playbooks } = useQuery({
    queryKey: playbookQueryKey,
    queryFn: fetchPlaybook,
  });
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    setOpen(true);
  }, []);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const go = (page: "bias" | "playbook" | "account") => {
    dismiss();
    navigateToPage(page);
  };

  const hasBias = (entries?.length ?? 0) > 0;
  const hasModel = (playbooks?.length ?? 0) > 0;
  const hasTelegram = !!settings?.telegramChatId;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-[32px] w-full max-w-lg p-8 relative shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss onboarding"
          className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-2xl font-black text-foreground tracking-tight">Set up Chartmate</h2>
        <p className="text-sm text-muted-foreground font-medium mt-2 mb-8">
          Three steps to start journaling. You can skip and come back later.
        </p>
        <ol className="space-y-3">
          <Step
            done={hasBias}
            icon={Crosshair}
            title="Record today's bias"
            body="Paste charts and mark HTF bias before the session."
            cta="Open Bias Expect"
            onClick={() => go("bias")}
          />
          <Step
            done={hasModel}
            icon={BookOpen}
            title="Define a playbook model"
            body="Name the setup you actually take so trades can be graded."
            cta="Open Playbook"
            onClick={() => go("playbook")}
          />
          <Step
            done={hasTelegram}
            icon={Send}
            title="Link Telegram (optional)"
            body="Get session reminders on your phone via the mini app."
            cta="Open Account"
            onClick={() => go("account")}
          />
        </ol>
        <button
          type="button"
          onClick={dismiss}
          className="mt-8 w-full py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function Step({
  done,
  icon: Icon,
  title,
  body,
  cta,
  onClick,
}: {
  done: boolean;
  icon: typeof Crosshair;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <li className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-muted/20">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          done ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-foreground">
          {title}
          {done ? " — done" : ""}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{body}</p>
        {!done && (
          <button
            type="button"
            onClick={onClick}
            className="mt-3 text-xs font-black uppercase tracking-wider text-primary hover:underline"
          >
            {cta}
          </button>
        )}
      </div>
    </li>
  );
}
