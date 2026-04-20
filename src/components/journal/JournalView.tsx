import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ChevronsRight, Filter, Activity, Terminal as TerminalIcon } from "lucide-react";
import {
  type DayEntry, type SlotKind,
  fetchEntries, upsertEntry, deleteEntry, monthKey, uid,
} from "@/lib/journal";
import { useSymbols } from "@/lib/symbols";
import { DayColumn } from "./DayColumn";
import { EditDayModal } from "./EditDayModal";
import { onBiasFocus } from "@/lib/nav-bus";
import { toast } from "sonner";

const newEntry = (asset: string): DayEntry => ({
  id: uid(),
  date: new Date().toISOString().slice(0, 10),
  asset,
  weeklyBias: "consolidation",
  weeklyCorrect: false,
  dailyBias: "consolidation",
  dailyCorrect: false,
  h4: {},
});

export function JournalView() {
  const { data: assetList = [] } = useSymbols();
  const ASSETS = useMemo(() => assetList.map((s) => s.name), [assetList]);
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [asset, setAsset] = useState<string>("ALL");
  const [month, setMonth] = useState<string>("ALL");
  const [editing, setEditing] = useState<DayEntry | null>(null);
  const [focusedSlot, setFocusedSlot] = useState<{ id: string; slot: SlotKind } | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEntries().then(setEntries).catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-slot-root]")) setFocusedSlot(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Subscribe to smart-link focus events from Trade Log
  useEffect(() => {
    return onBiasFocus((entryId) => {
      setAsset("ALL");
      setMonth("ALL");
      setPendingFocusId(entryId);
    });
  }, []);

  // Poll for the target element until it appears (data may still be loading,
  // or filters/render may not have flushed yet). Up to ~3 seconds.
  useEffect(() => {
    if (!pendingFocusId) return;
    let attempts = 0;
    let raf = 0;
    const tick = () => {
      const el = document.getElementById(`bias-entry-${pendingFocusId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
        el.classList.add("bias-flash");
        setTimeout(() => el.classList.remove("bias-flash"), 2200);
        setPendingFocusId(null);
        return;
      }
      attempts += 1;
      if (attempts > 30) { // ~3s at 100ms
        toast.error("Bias entry not found");
        setPendingFocusId(null);
        return;
      }
      raf = window.setTimeout(tick, 100) as unknown as number;
    };
    tick();
    return () => { if (raf) clearTimeout(raf); };
  }, [pendingFocusId, entries]);


  const months = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.date)));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return [...entries]
      .filter((e) => (asset === "ALL" ? true : e.asset === asset))
      .filter((e) => (month === "ALL" ? true : monthKey(e.date) === month))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, asset, month]);

  const stats = useMemo(() => {
    const total = filtered.length * 2;
    const correct = filtered.reduce((s, e) => s + (e.weeklyCorrect ? 1 : 0) + (e.dailyCorrect ? 1 : 0), 0);
    const acc = total ? Math.round((correct / total) * 100) : 0;
    return { days: filtered.length, correct, total, acc };
  }, [filtered]);

  const jumpRight = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  };

  const upsert = async (e: DayEntry) => {
    setEntries((p) => (p.find((x) => x.id === e.id) ? p.map((x) => (x.id === e.id ? e : x)) : [...p, e]));
    try { await upsertEntry(e); } catch (err: any) { toast.error(err.message); }
  };

  const remove = async (id: string) => {
    setEntries((p) => p.filter((x) => x.id !== id));
    try { await deleteEntry(id); } catch (err: any) { toast.error(err.message); }
  };

  const addEntry = async () => {
    const fallback = ASSETS[0] ?? "XAUUSD";
    const e = newEntry(asset === "ALL" ? fallback : asset);
    await upsert(e);
    setEditing(e);
    setTimeout(jumpRight, 100);
  };

  return (
    <div className="min-h-screen grid-bg">
      <header className="sticky top-0 z-30 glass-strong border-b border-terminal-border">
        <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-neon-cyan text-glow-cyan" />
            <h1 className="text-sm font-bold tracking-[0.3em] text-neon-cyan text-glow-cyan">BIAS_EXPECT</h1>
            <span className="text-[10px] text-muted-foreground tracking-widest">// JOURNAL TIMELINE</span>
          </div>

          <button
            type="button"
            onClick={addEntry}
            className="relative flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-[0.2em] bg-gradient-to-r from-neon-cyan/40 to-neon-cyan/20 text-neon-cyan border-2 border-neon-cyan rounded hover:from-neon-cyan/60 hover:to-neon-cyan/30 text-glow-cyan transition-all shadow-[0_0_18px_oklch(0.85_0.18_200/0.4)] hover:shadow-[0_0_28px_oklch(0.85_0.18_200/0.7)]"
          >
            <Plus className="w-4 h-4" strokeWidth={3} /> ADD DAY
          </button>

          <div className="h-6 w-px bg-terminal-border" />

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] text-muted-foreground tracking-widest mr-1">ASSET:</span>
            <button onClick={() => setAsset("ALL")}
              className={`px-2 py-1 text-[10px] font-bold tracking-widest rounded border transition-all ${asset === "ALL" ? "bg-neon-amber/20 text-neon-amber border-neon-amber/60" : "border-terminal-border text-muted-foreground hover:text-foreground"}`}>
              ALL
            </button>
            {ASSETS.map((a) => (
              <button key={a} onClick={() => setAsset(a)}
                className={`px-2 py-1 text-[10px] font-bold tracking-widest rounded border transition-all ${asset === a ? "bg-neon-amber/20 text-neon-amber border-neon-amber/60" : "border-terminal-border text-muted-foreground hover:text-foreground"}`}>
                {a}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 ml-auto">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs outline-none">
              <option value="ALL">All months</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>

          <button onClick={jumpRight}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold tracking-widest border border-terminal-border rounded hover:border-neon-cyan/60 hover:text-neon-cyan transition-all">
            JUMP <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-6 px-4 py-1.5 border-t border-terminal-border bg-black/30 text-[10px] tracking-widest">
          <Stat label="DAYS" value={stats.days} />
          <Stat label="CHECKS" value={`${stats.correct}/${stats.total}`} />
          <Stat label="ACC" value={`${stats.acc}%`} accent={stats.acc >= 60 ? "green" : "amber"} />
          <span className="ml-auto flex items-center gap-1.5 text-neon-green">
            <Activity className="w-3 h-3 animate-pulse" /> LIVE
          </span>
        </div>
      </header>

      <main className="px-4 py-5">
        {filtered.length === 0 ? (
          <Empty onAdd={addEntry} />
        ) : (
          <div ref={scrollerRef} data-slot-root className="overflow-x-auto scrollbar-terminal pb-4">
            <div className="flex gap-3 min-w-min items-start">
              {filtered.map((e) => (
                <DayColumn
                  key={e.id}
                  entry={e}
                  focusedSlot={focusedSlot}
                  setFocus={setFocusedSlot}
                  onUpdate={upsert}
                  onEdit={setEditing}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {editing && (
        <EditDayModal
          entry={editing}
          onSave={upsert}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: "green" | "amber" }) {
  const color = accent === "green" ? "text-neon-green" : accent === "amber" ? "text-neon-amber" : "text-foreground";
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </span>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass rounded-lg p-12 text-center max-w-xl mx-auto mt-12">
      <TerminalIcon className="w-10 h-10 mx-auto text-neon-cyan/60 mb-3" />
      <h2 className="text-lg font-bold tracking-widest text-neon-cyan text-glow-cyan">NO ENTRIES</h2>
      <p className="text-xs text-muted-foreground mt-1 mb-4 tracking-wide">
        // Initialize your journal by adding your first trading day.
      </p>
      <button onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold tracking-widest bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/60 rounded hover:bg-neon-cyan/30 text-glow-cyan">
        <Plus className="w-3.5 h-3.5" /> ADD FIRST DAY
      </button>
    </div>
  );
}
