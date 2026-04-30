import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, X, Settings } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteSymbol,
  insertSymbol,
  toggleForexSymbol,
  symbolsQueryKey,
  useSymbols,
  type Symbol,
} from "@/lib/symbols";
import { fetchSettings, updateSettings } from "@/lib/settings";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ManageAssetsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: symbols = [], isLoading } = useSymbols();
  const [name, setName] = useState("");
  const [isForex, setIsForex] = useState(false);

  const addMut = useMutation({
    mutationFn: (n: string) => insertSymbol(n, isForex),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      setName("");
      setIsForex(false);
      toast.success("Asset added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (s: Symbol) => deleteSymbol(s),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      toast.success("Asset removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isForex }: { id: string; isForex: boolean }) =>
      toggleForexSymbol(id, isForex),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      toast.success("Configuration updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  const updateSettingsMut = useMutation({
    mutationFn: (show: boolean) => updateSettings({ showTradeGrade: show }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_settings"] });
      toast.success("Settings updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addMut.mutate(name);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 bg-white border-white/20 text-foreground overflow-hidden rounded-[32px] shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <DialogHeader className="px-8 pt-8 pb-6 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">
                Manage Assets
              </DialogTitle>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                Trading pairs & Symbol configuration
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-3 mb-2 px-1">
              <div className="h-4 w-1 bg-primary rounded-full" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">
                Add New Asset
              </h3>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Input
                  placeholder="e.g. XAUUSD, BTCUSDT"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20 transition-all uppercase placeholder:normal-case placeholder:font-medium placeholder:text-muted-foreground/40"
                  maxLength={20}
                  disabled={addMut.isPending}
                />
              </div>
              <button
                type="submit"
                disabled={addMut.isPending || !name.trim()}
                className="forest-gradient h-12 flex items-center gap-2 px-6 rounded-xl text-xs font-black text-white shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
              >
                {addMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>

            <label className="flex items-center gap-3 px-4 py-3 bg-muted/20 rounded-xl border border-border/50 cursor-pointer hover:bg-muted/30 transition-all select-none">
              <input
                type="checkbox"
                checked={isForex}
                onChange={(e) => setIsForex(e.target.checked)}
                className="w-5 h-5 rounded-md border-border text-primary focus:ring-primary/20 accent-primary"
              />
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-foreground">
                  Mark as Forex
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  Enables multi-timeframe image analysis
                </span>
              </div>
            </label>
          </form>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="h-4 w-1 bg-primary rounded-full" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Available Assets ({symbols.length})
                </h3>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/10 overflow-hidden">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : symbols.length === 0 ? (
                <div className="text-center py-12 text-xs font-medium text-muted-foreground italic">
                  No assets configured yet.
                </div>
              ) : (
                <ul className="divide-y divide-border/50 max-h-[300px] overflow-y-auto">
                  {symbols.map((s) => {
                    const isDeleting = delMut.isPending && delMut.variables?.id === s.id;
                    const isToggling = toggleMut.isPending && toggleMut.variables?.id === s.id;

                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm text-foreground tracking-tight">
                            {s.name}
                          </span>
                          <button
                            onClick={() => toggleMut.mutate({ id: s.id, isForex: !s.isForex })}
                            disabled={isToggling}
                            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-all ${
                              s.isForex
                                ? "bg-primary text-white shadow-sm shadow-primary/20"
                                : "bg-muted text-muted-foreground/40 hover:bg-muted/50"
                            } ${isToggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            title={
                              s.isForex
                                ? "Forex Active (Click to disable)"
                                : "Click to mark as Forex"
                            }
                          >
                            {s.isForex ? "Forex" : "FX?"}
                          </button>
                        </div>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={isDeleting}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                              title="Delete"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white border-border rounded-[32px] shadow-2xl p-8 max-w-sm animate-in fade-in zoom-in-95 duration-300">
                            <AlertDialogHeader className="flex flex-col items-center text-center">
                              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                                <AlertCircle className="w-7 h-7 text-destructive" />
                              </div>
                              <AlertDialogTitle className="text-xl font-black text-foreground">
                                Delete Asset?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-xs font-medium text-muted-foreground">
                                Are you sure you want to remove{" "}
                                <span className="font-bold text-primary">{s.name}</span>? This will
                                not delete existing trades but the symbol will no longer be
                                selectable.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-8">
                              <AlertDialogCancel className="flex-1 h-12 rounded-xl border-border text-foreground font-bold hover:bg-muted transition-all">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => delMut.mutate(s)}
                                className="flex-1 h-12 rounded-xl bg-destructive text-white font-black uppercase tracking-widest hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all active:scale-95"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
