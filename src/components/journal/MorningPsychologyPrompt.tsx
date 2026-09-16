import { useState } from "react";
import { Brain, Save, X, Loader2, Sparkles } from "lucide-react";
import {
  MOOD_OPTIONS,
  type PsychologyLog,
  upsertPsychologyLog,
  newDailyLog,
} from "@/lib/psychology";
import { journalTradingDate } from "@/lib/journal";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (log: PsychologyLog) => void;
  existingLog?: PsychologyLog;
}

export function MorningPsychologyPrompt({ isOpen, onClose, onSaved, existingLog }: Props) {
  const [mood, setMood] = useState<string | undefined>(existingLog?.morningMood);
  const [notes, setNotes] = useState<string>(existingLog?.morningNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!mood) {
      toast.error("Pick a mood");
      return;
    }

    setSaving(true);
    try {
      const log = existingLog ?? newDailyLog(journalTradingDate());
      const saved = {
        ...log,
        morningMood: mood,
        morningNotes: notes,
      };
      await upsertPsychologyLog(saved);
      toast.success("Mindset saved");
      onSaved?.(saved);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save check-in");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed top-16 sm:top-6 inset-x-3 z-[110] mx-auto w-auto max-w-2xl animate-in slide-in-from-top-10 duration-500">
      <div className="bg-card/95 backdrop-blur-xl border border-border shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[24px]">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl forest-gradient flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                Morning Ritual <Sparkles className="w-3 h-3 text-primary animate-pulse shrink-0" />
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                How are you showing up today?
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-1 min-w-0 justify-between gap-0.5 bg-muted/50 p-1 rounded-xl border border-border/50">
              {MOOD_OPTIONS.map((m) => {
                const active = mood === m;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMood(m);
                      setIsExpanded(true);
                    }}
                    className={`text-lg sm:text-xl flex-1 h-9 min-w-0 sm:flex-none sm:h-10 sm:w-10 flex items-center justify-center rounded-lg transition-colors ${
                      active
                        ? "bg-background shadow-md border border-primary/20"
                        : "hover:bg-muted grayscale-[0.5] hover:grayscale-0"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="hidden md:flex p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Section for Notes & Save */}
        {(isExpanded || notes) && (
          <div className="px-6 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="h-px bg-border/50 w-full" />
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="A quick note on your mindset..."
                rows={2}
                className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 sm:gap-4">
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-50 text-center sm:text-left">
                  Better psychology, better trades
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="forest-gradient text-white px-6 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Finish check-in
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
