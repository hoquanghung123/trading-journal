import { useState } from "react";
import { Brain, Save, X, Loader2, Sparkles } from "lucide-react";
import {
  MOOD_OPTIONS,
  type PsychologyLog,
  upsertPsychologyLog,
  newDailyLog,
  toLocalDateStr,
} from "@/lib/psychology";
import { toast } from "sonner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  existingLog?: PsychologyLog;
}

export function MorningPsychologyPrompt({ isOpen, onClose, existingLog }: Props) {
  const [mood, setMood] = useState<string | undefined>(existingLog?.morningMood);
  const [notes, setNotes] = useState<string>(existingLog?.morningNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!mood) {
      toast.error("Vui lòng chọn cảm xúc");
      return;
    }

    setSaving(true);
    try {
      const log = existingLog ?? newDailyLog(toLocalDateStr(new Date()));
      await upsertPsychologyLog({
        ...log,
        morningMood: mood,
        morningNotes: notes,
      });
      toast.success("Đã cập nhật tâm thế!");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Lỗi lưu dữ liệu");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-2xl animate-in slide-in-from-top-10 duration-500">
      <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[24px] overflow-hidden">
        {/* Compact Header / Info bar */}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl forest-gradient flex items-center justify-center shadow-lg shadow-primary/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                Morning Ritual <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                Hôm nay bạn thế nào?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/50">
              {MOOD_OPTIONS.map((m) => {
                const active = mood === m;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setMood(m);
                      setIsExpanded(true);
                    }}
                    className={`text-xl w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-300 ${
                      active
                        ? "bg-white shadow-md scale-110 border border-primary/20"
                        : "hover:bg-white/50 grayscale-[0.5] hover:grayscale-0"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                placeholder="Thêm ghi chú nhanh về tâm thế của bạn..."
                rows={2}
                className="w-full bg-muted/20 border border-border/50 rounded-xl px-4 py-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
              <div className="flex justify-end items-center gap-4">
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-50">
                  Tâm lý tốt, giao dịch tốt
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="forest-gradient text-white px-6 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  Hoàn tất check-in
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
