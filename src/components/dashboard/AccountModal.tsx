import { useState, useEffect } from "react";
import { X, Wallet, Plus, Trash2, Loader2, Save } from "lucide-react";
import { fetchFunding, upsertFunding, deleteFunding, type MonthlyFunding } from "@/lib/funding";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { format, addMonths, parseISO } from "date-fns";

interface AccountModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

export function AccountModal({ onClose, onRefresh }: AccountModalProps) {
  const [funding, setFunding] = useState<MonthlyFunding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const data = await fetchFunding();
      setFunding(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMonth = () => {
    // If empty, start with current month. Otherwise, add 1 month to the last entry.
    let nextMonth: string;
    if (funding.length === 0) {
      nextMonth = format(new Date(), "yyyy-MM");
    } else {
      const lastMonth = parseISO(funding[funding.length - 1].monthKey + "-01");
      nextMonth = format(addMonths(lastMonth, 1), "yyyy-MM");
    }

    // Check if already exists
    if (funding.find((f) => f.monthKey === nextMonth)) {
      toast.error("Month already exists");
      return;
    }

    setFunding([...funding, { id: generateId(), monthKey: nextMonth, amount: 0 }]);
  };

  const handleUpdateMonthKey = (id: string, monthKey: string) => {
    setFunding(funding.map((f) => (f.id === id ? { ...f, monthKey } : f)));
  };

  const handleUpdateAmount = (id: string, amount: number) => {
    setFunding(funding.map((f) => (f.id === id ? { ...f, amount } : f)));
  };

  const handleSave = async (f: MonthlyFunding) => {
    setSaving(true);
    try {
      await upsertFunding(f);
      toast.success(`Saved capital for ${f.monthKey}`);
      await load();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this month's capital?")) return;
    try {
      await deleteFunding(id);
      setFunding(funding.filter((f) => f.id !== id));
      toast.success("Removed");
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Capital Management
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Account Funding Plan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
              <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">
                Loading Capital Data...
              </p>
            </div>
          ) : funding.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-slate-200 dark:text-slate-700" />
              </div>
              <p className="text-sm font-medium text-slate-500">No funding records yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add your starting capital to track ROI.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...funding]
                .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-primary/20 transition-all group"
                  >
                    <div className="min-w-[100px]">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Month
                      </div>
                      <input
                        type="month"
                        value={f.monthKey}
                        onChange={(e) => handleUpdateMonthKey(f.id, e.target.value)}
                        className="bg-transparent border-none p-0 text-sm font-black text-slate-700 dark:text-slate-200 focus:ring-0"
                      />
                    </div>

                    <div className="flex-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                        Capital ($)
                      </div>
                      <input
                        type="number"
                        value={f.amount}
                        onChange={(e) => handleUpdateAmount(f.id, Number(e.target.value))}
                        className="w-full bg-transparent border-none p-0 text-lg font-black text-primary focus:ring-0 placeholder:text-slate-300"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleSave(f)}
                        disabled={saving}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-xl transition-all"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-50 dark:border-slate-800 flex gap-3">
          <button
            onClick={handleAddMonth}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <Plus className="w-4 h-4" /> Add Month
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
