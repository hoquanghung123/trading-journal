import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aliasesForSymbol,
  assetMarkLetters,
  countSymbolUsage,
  deleteSymbol,
  getAssetIconUrl,
  guessIsForex,
  insertSymbol,
  kindLabelForAsset,
  symbolsQueryKey,
  toggleForexSymbol,
  useSymbols,
  type Symbol,
} from "@/lib/symbols";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

function AssetMark({ name, large }: { name: string; large?: boolean }) {
  const url = getAssetIconUrl(name);
  const box = large ? "h-14 w-14 rounded-2xl text-sm" : "h-7 w-7 rounded-lg text-[9px]";
  if (url) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden bg-muted", box)}>
        <img src={url} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-[#EEF4EB] font-mono font-extrabold text-primary",
        box,
      )}
    >
      {assetMarkLetters(name)}
    </span>
  );
}

export function ManageAssetsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { data: symbols = [], isLoading } = useSymbols();
  const [name, setName] = useState("");
  const [landingFx, setLandingFx] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const bias = useMemo(
    () => symbols.filter((s) => !s.isForex).sort((a, b) => a.name.localeCompare(b.name)),
    [symbols],
  );
  const fx = useMemo(
    () => symbols.filter((s) => s.isForex).sort((a, b) => a.name.localeCompare(b.name)),
    [symbols],
  );
  const selected = symbols.find((s) => s.id === selectedId) ?? symbols[0] ?? null;

  useEffect(() => {
    if (!open) {
      setMobileDetail(false);
      setName("");
      setConfirmOpen(false);
      return;
    }
    if (selectedId && symbols.some((s) => s.id === selectedId)) return;
    const fallback = symbols.find((s) => !s.isForex) ?? symbols[0];
    setSelectedId(fallback?.id ?? null);
  }, [open, symbols, selectedId]);

  const usageQuery = useQuery({
    queryKey: ["symbol-usage", selected?.name],
    queryFn: () => countSymbolUsage(selected!.name),
    enabled: open && !!selected,
  });
  const usage = usageQuery.data;
  const blocked = !!usage && (usage.trades > 0 || usage.biasDays > 0);

  const addMut = useMutation({
    mutationFn: (n: string) => insertSymbol(n, landingFx),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      setName("");
      setSelectedId(created.id);
      setMobileDetail(true);
      toast.success(`${created.name} added to ${created.isForex ? "FX pairs" : "Bias desk"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (s: Symbol) => deleteSymbol(s),
    onSuccess: (_, s) => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      setConfirmOpen(false);
      setMobileDetail(false);
      setSelectedId((cur) => (cur === s.id ? null : cur));
      toast.success(`${s.name} removed`);
    },
    onError: (e: Error) => {
      setConfirmOpen(false);
      toast.error(e.message);
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isForex }: { id: string; isForex: boolean }) =>
      toggleForexSymbol(id, isForex),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: symbolsQueryKey });
      toast.success(
        vars.isForex ? `${selected?.name ?? "Ticker"} moved to FX pairs` : `${selected?.name ?? "Ticker"} moved to Bias desk`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addMut.mutate(name);
  };

  const guess = name.trim()
    ? guessIsForex(name)
      ? `${name.trim()} looks like FX — Trade Log + MTF. Override with Bias if it belongs on Expect.`
      : `${name.trim()} looks like Bias desk — Expect + Telegram.`
    : "Add lands in the active lane. Inspector explains the rest.";

  const pick = (s: Symbol) => {
    setSelectedId(s.id);
    setMobileDetail(true);
  };

  const aliases = selected ? aliasesForSymbol(selected.name) : [];
  const onBias = selected ? !selected.isForex : true;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden border-border bg-white p-0 text-foreground shadow-2xl",
            "h-[min(640px,92vh)] w-[calc(100%-16px)] max-w-[920px] rounded-[20px]",
            "grid grid-cols-1 md:grid-cols-[minmax(280px,42%)_1fr]",
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0",
            "max-sm:h-[92vh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-[20px]",
            "[&>button]:hidden",
          )}
        >
          <DialogTitle className="sr-only">Watchlist — two desks</DialogTitle>

          <section
            className={cn(
              "flex min-h-0 flex-col border-border bg-white md:border-r",
              mobileDetail && "max-md:hidden",
            )}
          >
            <div className="shrink-0 px-4 pb-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                    Watchlist
                  </p>
                  <h3 className="text-lg font-black tracking-tight">Two desks</h3>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {symbols.length} tickers · {bias.length} Bias · {fx.length} FX
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="hidden h-8 w-8 rounded-lg text-lg leading-none text-muted-foreground hover:bg-muted md:grid md:place-items-center"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="NQ1! or EURUSD"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="h-9 min-w-[120px] flex-1 rounded-xl border-border px-3 font-mono text-xs font-bold uppercase placeholder:normal-case placeholder:font-medium"
                  maxLength={20}
                  disabled={addMut.isPending}
                />
                <div
                  className="inline-flex overflow-hidden rounded-[10px] border border-border bg-white"
                  role="group"
                  aria-label="Landing desk"
                >
                  <button
                    type="button"
                    onClick={() => setLandingFx(false)}
                    className={cn(
                      "px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider",
                      !landingFx ? "bg-primary text-white" : "text-muted-foreground",
                    )}
                  >
                    Bias
                  </button>
                  <button
                    type="button"
                    onClick={() => setLandingFx(true)}
                    className={cn(
                      "border-l border-border px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider",
                      landingFx ? "bg-primary text-white" : "text-muted-foreground",
                    )}
                  >
                    FX
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={addMut.isPending || !name.trim()}
                  className="forest-gradient h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                >
                  {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                </button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">{guess}</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-3">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="sticky top-0 z-[1] flex items-center justify-between bg-[#F7FAF5] px-3 py-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                        Bias desk
                      </p>
                      <p className="text-[10px] text-muted-foreground">Expect · Telegram · palette</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-primary">{bias.length}</span>
                  </div>
                  {bias.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Empty. Add NQ, GC, or DXY.
                    </p>
                  ) : (
                    bias.map((s) => (
                      <TickerRow
                        key={s.id}
                        symbol={s}
                        active={selected?.id === s.id}
                        onPick={() => pick(s)}
                      />
                    ))
                  )}
                  <div className="sticky top-[42px] z-[1] mt-1 flex items-center justify-between border-t border-border bg-white px-3 py-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        FX pairs
                      </p>
                      <p className="text-[10px] text-muted-foreground">Trade Log · MTF charts</p>
                    </div>
                    <span className="font-mono text-sm font-bold text-muted-foreground">
                      {fx.length}
                    </span>
                  </div>
                  {fx.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Empty. Add EURUSD for MTF slots.
                    </p>
                  ) : (
                    fx.map((s) => (
                      <TickerRow
                        key={s.id}
                        symbol={s}
                        active={selected?.id === s.id}
                        onPick={() => pick(s)}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </section>

          <section
            className={cn(
              "flex min-h-0 flex-col bg-background",
              !mobileDetail && "max-md:hidden",
            )}
          >
            <div className="flex shrink-0 items-center justify-between px-4 pt-4 md:hidden">
              <button
                type="button"
                onClick={() => setMobileDetail(false)}
                className="text-[12px] font-semibold text-primary"
              >
                ← Desks
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-[12px] font-bold text-muted-foreground"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a ticker on the left.</p>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <AssetMark name={selected.name} large />
                    <div>
                      <p className="font-mono text-2xl font-bold tracking-tight">{selected.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {onBias
                          ? `${kindLabelForAsset(selected.name, false)} · Bias desk`
                          : "FX pair · Trade Log"}
                      </p>
                    </div>
                  </div>
                  {aliases.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {aliases.map((a) => (
                        <span
                          key={a}
                          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground"
                        >
                          {a}
                        </span>
                      ))}
                      <span className="ml-1 self-center text-[11px] text-muted-foreground">
                        match this watchlist name
                      </span>
                    </div>
                  )}
                  <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Appears on
                  </p>
                  <p className="mb-2 mt-1 text-[11px] text-muted-foreground">
                    Toggling Bias Expect moves it to the other desk.
                  </p>
                  <div className="space-y-2">
                    <Surface on={onBias}>
                      <div className="flex-1">
                        <p className="text-sm font-bold">Bias Expect</p>
                        <p className="text-[11px] text-muted-foreground">
                          Daily HTF tape and session clock.
                        </p>
                      </div>
                      <Switch
                        checked={onBias}
                        disabled={toggleMut.isPending}
                        onCheckedChange={(on) =>
                          toggleMut.mutate({ id: selected.id, isForex: !on })
                        }
                      />
                    </Surface>
                    <Surface on={onBias}>
                      <div className="flex-1">
                        <p className="text-sm font-bold">Telegram + command palette</p>
                        <p className="text-[11px] text-muted-foreground">
                          Session bias follows the Bias desk.
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-widest",
                          onBias ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {onBias ? "Follows" : "Off"}
                      </span>
                    </Surface>
                    <Surface on locked>
                      <div className="flex-1">
                        <p className="text-sm font-bold">Trade Log</p>
                        <p className="text-[11px] text-muted-foreground">
                          Every ticker can be journaled.
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        Always
                      </span>
                    </Surface>
                    <Surface on={!onBias}>
                      <div className="flex-1">
                        <p className="text-sm font-bold">Multi-timeframe slots</p>
                        <p className="text-[11px] text-muted-foreground">
                          Monthly through M15. On when it leaves the Bias desk.
                        </p>
                      </div>
                      <Switch
                        checked={!onBias}
                        disabled={toggleMut.isPending}
                        onCheckedChange={(on) =>
                          toggleMut.mutate({ id: selected.id, isForex: on })
                        }
                      />
                    </Surface>
                  </div>
                  <p className="mt-5 text-xs text-muted-foreground">
                    {usageQuery.isPending
                      ? "Checking usage…"
                      : `${usage?.trades ?? 0} trade${usage?.trades === 1 ? "" : "s"} · ${usage?.biasDays ?? 0} bias day${usage?.biasDays === 1 ? "" : "s"}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    disabled={usageQuery.isPending || delMut.isPending}
                    className="mt-4 h-11 w-full rounded-xl border border-destructive/30 text-sm font-bold text-destructive disabled:opacity-50"
                  >
                    {blocked ? "Can't remove yet" : "Remove from watchlist"}
                  </button>
                </>
              )}
            </div>
          </section>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="z-[70] max-w-sm rounded-2xl border-border bg-white p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black">
              {blocked ? `Keep ${selected?.name}` : `Remove ${selected?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              {blocked
                ? `Still on ${usage?.trades ?? 0} trades / ${usage?.biasDays ?? 0} bias days — remove those first.`
                : "It leaves the watchlist. You cannot pick it on new trades."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex-row gap-2 sm:space-x-0">
            <AlertDialogCancel className="h-11 flex-1 rounded-xl">
              {blocked ? "OK" : "Cancel"}
            </AlertDialogCancel>
            {!blocked && (
              <AlertDialogAction
                className="h-11 flex-1 rounded-xl bg-destructive text-sm font-black uppercase tracking-widest text-white hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (selected) delMut.mutate(selected);
                }}
              >
                {delMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TickerRow({
  symbol,
  active,
  onPick,
}: {
  symbol: Symbol;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left",
        active && "bg-[#EEF4EB] shadow-[inset_3px_0_0_#4C763B]",
      )}
    >
      <AssetMark name={symbol.name} />
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-sm font-bold">{symbol.name}</span>
        <span className="text-[10px] text-muted-foreground">
          {symbol.isForex ? "Trade Log · MTF" : "On Bias Expect"}
        </span>
      </span>
    </button>
  );
}

function Surface({
  on,
  locked,
  children,
}: {
  on?: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border bg-white px-3.5 py-3 text-left",
        on && "border-primary/40 bg-[#F7FAF5] shadow-[inset_3px_0_0_#4C763B]",
        locked && "opacity-75",
      )}
    >
      {children}
    </div>
  );
}
