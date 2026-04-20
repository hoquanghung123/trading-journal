import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteSymbol,
  insertSymbol,
  symbolsQueryKey,
  useSymbols,
  type Symbol,
} from "@/lib/symbols";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ManageAssetsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: symbols = [], isLoading } = useSymbols();
  const [name, setName] = useState("");

  const addMut = useMutation({
    mutationFn: (n: string) => insertSymbol(n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      setName("");
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addMut.mutate(name);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 bg-[#0D1117] border-terminal-border text-foreground">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-terminal-border flex flex-row items-center justify-between">
          <DialogTitle className="text-neon-cyan tracking-[0.2em] text-sm font-bold">
            MANAGE ASSETS
          </DialogTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-neon-cyan">
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <form onSubmit={submit} className="flex gap-2">
            <Input
              placeholder="e.g. SOLUSD"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="h-9 bg-black/40 border-terminal-border uppercase tracking-widest text-xs"
              maxLength={20}
              disabled={addMut.isPending}
            />
            <button
              type="submit"
              disabled={addMut.isPending || !name.trim()}
              className="flex items-center gap-1.5 px-3 rounded border border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan text-xs tracking-widest hover:bg-neon-cyan/25 disabled:opacity-50"
            >
              {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              ADD
            </button>
          </form>

          <div className="border-t border-terminal-border pt-3">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-2">
              // {symbols.length} ASSETS
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-neon-cyan" />
              </div>
            ) : symbols.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground tracking-widest">
                // NO ASSETS YET
              </div>
            ) : (
              <ul className="space-y-1 max-h-[40vh] overflow-y-auto">
                {symbols.map((s) => {
                  const isDeleting = delMut.isPending && delMut.variables?.id === s.id;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 rounded border border-terminal-border bg-black/30"
                    >
                      <span className="font-mono text-xs tracking-widest text-foreground">{s.name}</span>
                      <button
                        onClick={() => {
                          if (confirm(`Delete asset "${s.name}"?`)) delMut.mutate(s);
                        }}
                        disabled={isDeleting}
                        className="text-muted-foreground hover:text-red-400 disabled:opacity-50"
                        title="Delete"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
