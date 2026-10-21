import { withTimeout } from "@/lib/async-timeout";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { usePlaybook } from "@/hooks/usePlaybook";
import {
  MISS_REASONS,
  missedTradeImageKeys,
  type MissedTradeImageKey,
  type MissedTrade,
} from "@/lib/missed-trades";
import {
  deleteChartImage,
  uploadChartImage,
  fetchEntries,
  journalTradingDate,
  ddmm,
} from "@/lib/journal";
import { useQuery } from "@tanstack/react-query";
import { focusBiasEntry, navigateToPage } from "@/lib/nav-bus";
import { PasteSlot } from "./PasteSlot";
import { toast } from "sonner";
import { toNyLocal, nyLocalToIso } from "@/lib/trade-time";
import { useSymbols } from "@/lib/symbols";

const inputClass =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm";
const numberKeys = ["planned_entry", "planned_sl", "planned_tp", "hypothetical_r"] as const;
export function MissedTradeModal({
  trade,
  onClose,
  onSave,
  onDelete,
}: {
  trade: MissedTrade | null;
  onClose: () => void;
  onSave: (t: MissedTrade) => Promise<void>;
  onDelete?: (t: MissedTrade) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MissedTrade | null>(null);
  const [files, setFiles] = useState<Partial<Record<MissedTradeImageKey, File | string>>>({});
  const [focusedImage, setFocusedImage] = useState<MissedTradeImageKey | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const [confirmation, setConfirmation] = useState<"discard" | "delete" | "bias" | null>(null);
  const [error, setError] = useState("");
  const { models } = usePlaybook();
  const {
    data: symbols = [],
    isLoading: symbolsLoading,
    error: symbolsError,
    refetch: retrySymbols,
  } = useSymbols();
  const biasQuery = useQuery({
    queryKey: ["missed-trade-bias", trade?.id],
    queryFn: () => fetchEntries(),
    enabled: !!trade,
    staleTime: 0,
  });
  useEffect(() => {
    setDraft(trade ? { ...trade } : null);
    setFiles({});
    setFocusedImage(null);
    setDirty(false);
    setError("");
    setConfirmation(null);
  }, [trade]);
  if (!draft) return null;
  const biasDate = journalTradingDate(draft.setup_time);
  const matchingBias = (biasQuery.data ?? []).filter(
    (entry) => entry.asset === draft.symbol && entry.date === biasDate,
  );
  const openBias = () => {
    if (!draft.bias_entry_id) return;
    const entryId = draft.bias_entry_id;
    navigateToPage("bias");
    setTimeout(() => focusBiasEntry(entryId, draft.symbol), 50);
    onClose();
  };
  const update = (patch: Partial<MissedTrade>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (
        next.symbol !== prev.symbol ||
        journalTradingDate(next.setup_time) !== journalTradingDate(prev.setup_time)
      ) {
        next.bias_entry_id = null;
      }
      return next;
    });
    setDirty(true);
  };
  const close = () => {
    if (busy) return;
    if (dirty) setConfirmation("discard");
    else onClose();
  };
  const save = async () => {
    if (
      !draft.symbol.trim() ||
      !draft.setup_id ||
      !draft.analysis.trim() ||
      (!draft.before_img && !files.before_img) ||
      !Number.isFinite(Date.parse(draft.setup_time))
    ) {
      setError("Điền symbol, thời điểm, setup, chart và phân tích trước khi lưu.");
      return;
    }
    if (numberKeys.some((key) => draft[key] !== null && !Number.isFinite(draft[key]))) {
      setError("Giá và R phải là số hợp lệ.");
      return;
    }
    setBusy(true);
    setError("");
    const next = { ...draft, symbol: draft.symbol.trim().toUpperCase() };
    try {
      for (const key of missedTradeImageKeys) {
        if (files[key]) {
          setSaveStage(
            `Đang tải ảnh ${missedTradeImageKeys.indexOf(key) + 1}/${missedTradeImageKeys.length}…`,
          );
          const path = await withTimeout(
            uploadChartImage(files[key]!, 15 * 1024 * 1024),
            60000,
            "Tải ảnh quá 60 giây. Nội dung được giữ lại; kiểm tra kết nối rồi thử lưu lại.",
          );
          next[key] = path;
          // Keep acknowledged uploads on failure so a retry reuses them.
          setDraft((prev) => (prev ? { ...prev, [key]: path } : prev));
          setFiles((prev) => ({ ...prev, [key]: undefined }));
        }
      }
      setSaveStage("Đang ghi trade…");
      await withTimeout(
        onSave(next),
        50000,
        "Chưa nhận được xác nhận lưu. Nội dung và ảnh vẫn được giữ; kiểm tra timeline trước khi thử lại.",
      );
      // Only remove replaced files once the database points to their replacements.
      const retained = new Set(missedTradeImageKeys.map((key) => next[key]));
      const replaced = missedTradeImageKeys
        .map((key) => trade?.[key])
        .filter((p): p is string => !!p && !retained.has(p));
      void Promise.allSettled(replaced.map(deleteChartImage));
      toast.success("Đã lưu trade bị miss");
      onClose();
    } catch (e) {
      // A timed-out write might have committed. Do not delete images it may reference.
      setError(e instanceof Error ? e.message : "Không lưu được. Nội dung vẫn được giữ lại.");
    } finally {
      setBusy(false);
      setSaveStage("");
    }
  };
  const remove = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(trade ?? draft);
      const savedPaths = new Set(missedTradeImageKeys.map((key) => trade?.[key]));
      void Promise.allSettled(
        missedTradeImageKeys
          .map((key) => draft[key])
          .filter((path): path is string => !!path && !savedPaths.has(path))
          .map(deleteChartImage),
      );
      toast.success("Đã xóa trade bị miss");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được trade.");
    } finally {
      setBusy(false);
      setConfirmation(null);
    }
  };
  const label = (id: string, text: string, required = false) => (
    <label htmlFor={id} className="text-xs font-medium">
      {text}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );
  return (
    <>
      <Dialog
        open={!!trade}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="flex max-h-[94dvh] w-[calc(100%-24px)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl p-0"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader className="border-b border-border p-5 pr-12 sm:px-6">
            <DialogTitle>Phân tích trade bị miss</DialogTitle>
            <DialogDescription>
              Setup hợp lệ đã bỏ lỡ · Không tính vào P&L và win rate.
            </DialogDescription>
          </DialogHeader>
          <form
            className="min-h-0 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset
              disabled={busy}
              className="grid min-w-0 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,.8fr)]"
            >
              <div className="min-w-0 space-y-6">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold">01 · Bối cảnh setup</h3>
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      {label("miss-symbol", "Symbol", true)}
                      <select
                        id="miss-symbol"
                        required
                        value={draft.symbol}
                        onChange={(e) => update({ symbol: e.target.value })}
                        disabled={symbolsLoading && !draft.symbol}
                        className={`${inputClass} h-11 md:h-10`}
                      >
                        <option value="">
                          {symbolsLoading ? "Đang tải symbol…" : "Chọn symbol"}
                        </option>
                        {draft.symbol &&
                          !symbols.some((symbol) => symbol.name === draft.symbol) && (
                            <option value={draft.symbol}>{draft.symbol}</option>
                          )}
                        {symbols.map((symbol) => (
                          <option key={symbol.id} value={symbol.name}>
                            {symbol.name}
                          </option>
                        ))}
                      </select>
                      {symbolsError ? (
                        <p role="alert" className="text-[11px] text-destructive">
                          Không tải được danh sách symbol.{" "}
                          <button
                            type="button"
                            onClick={() => void retrySymbols()}
                            className="underline"
                          >
                            Thử lại
                          </button>
                        </p>
                      ) : (
                        !symbolsLoading &&
                        !symbols.length && (
                          <p className="text-[11px] text-muted-foreground">
                            Thêm cặp giao dịch trong Assets để chọn tại đây.
                          </p>
                        )
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {label("miss-side", "Hướng giao dịch", true)}
                      <select
                        id="miss-side"
                        value={draft.side}
                        onChange={(e) => update({ side: e.target.value as "buy" | "sell" })}
                        className={`${inputClass} h-11 md:h-10`}
                      >
                        <option value="buy">Buy / Long</option>
                        <option value="sell">Sell / Short</option>
                      </select>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      {label("miss-time", "Thời điểm setup (NY)", true)}
                      <input
                        id="miss-time"
                        type="datetime-local"
                        required
                        value={toNyLocal(draft.setup_time)}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          try {
                            update({ setup_time: nyLocalToIso(e.target.value) });
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "Ngày giờ không hợp lệ.",
                            );
                          }
                        }}
                        className={`${inputClass} h-11 md:h-10`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {label("miss-setup", "Setup", true)}
                      <select
                        id="miss-setup"
                        required
                        value={draft.setup_id ?? ""}
                        onChange={(e) => update({ setup_id: e.target.value || null })}
                        className={`${inputClass} h-11 md:h-10`}
                      >
                        <option value="">Chọn setup</option>
                        {draft.setup_id && !models.some((m) => m.id === draft.setup_id) && (
                          <option value={draft.setup_id}>Setup đã lưu</option>
                        )}
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      {!models.length && (
                        <p className="text-[11px] text-muted-foreground">
                          Thêm setup trong Playbook trước khi ghi trade miss.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {label("miss-bias", `Bias trong ngày · ${ddmm(biasDate)} · Tùy chọn`)}
                    <div className="flex min-w-0 gap-2">
                      <select
                        id="miss-bias"
                        value={draft.bias_entry_id ?? ""}
                        onChange={(e) => update({ bias_entry_id: e.target.value || null })}
                        className={`${inputClass} h-11 flex-1 md:h-10`}
                      >
                        <option value="">Không gắn bias</option>
                        {draft.bias_entry_id &&
                          !matchingBias.some((entry) => entry.id === draft.bias_entry_id) && (
                            <option value={draft.bias_entry_id}>Bias đã gắn</option>
                          )}
                        {matchingBias.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {ddmm(entry.date)} — {entry.asset} — {entry.dailyBias.toUpperCase()}
                          </option>
                        ))}
                      </select>
                      {draft.bias_entry_id && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => (dirty ? setConfirmation("bias") : openBias())}
                        >
                          Mở bias
                        </Button>
                      )}
                    </div>
                    {biasQuery.isLoading ? (
                      <p role="status" className="text-[11px] text-muted-foreground">
                        Đang tải bias…
                      </p>
                    ) : biasQuery.isError ? (
                      <p role="alert" className="text-[11px] text-destructive">
                        Không tải được bias.{" "}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => void biasQuery.refetch()}
                        >
                          Thử lại
                        </button>
                      </p>
                    ) : !matchingBias.length ? (
                      <p className="text-[11px] text-muted-foreground">
                        Chưa có bias cho {draft.symbol || "symbol này"} trong ngày giao dịch này.
                      </p>
                    ) : null}
                  </div>
                </section>
                <section className="space-y-4 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">02 · Kế hoạch & lý do miss</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["planned_entry", "planned_sl", "planned_tp"] as const).map((key, i) => (
                      <div key={key} className="space-y-1.5">
                        {label(`miss-${key}`, ["Entry dự kiến", "Stop loss", "Take profit"][i])}
                        <input
                          id={`miss-${key}`}
                          type="number"
                          step="any"
                          value={draft[key] ?? ""}
                          onChange={(e) =>
                            update({ [key]: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className={`${inputClass} h-11 md:h-10`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {label("miss-reason", "Lý do chính", true)}
                    <select
                      id="miss-reason"
                      value={draft.reason}
                      onChange={(e) => update({ reason: e.target.value })}
                      className={`${inputClass} h-11 md:h-10`}
                    >
                      {MISS_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </section>
                <section className="space-y-4 border-t border-border pt-5">
                  <h3 className="text-sm font-semibold">03 · Phân tích & bài học</h3>
                  <div className="space-y-1.5">
                    {label("miss-analysis", "Điều gì đã xảy ra?", true)}
                    <textarea
                      id="miss-analysis"
                      required
                      rows={5}
                      value={draft.analysis}
                      onChange={(e) => update({ analysis: e.target.value })}
                      className={inputClass}
                      placeholder="Bối cảnh, điều kiện setup và điều khiến bạn không thực hiện lệnh…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    {label("miss-lesson", "Lần sau tôi sẽ làm gì?")}
                    <textarea
                      id="miss-lesson"
                      rows={3}
                      value={draft.lesson}
                      onChange={(e) => update({ lesson: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </section>
              </div>
              <div className="min-w-0 space-y-5">
                {(
                  [
                    ["before_img", "Chart setup *"],
                    ["after_img", "Diễn biến sau · Tùy chọn"],
                    ...(symbols.find((symbol) => symbol.name === draft.symbol)?.isForex
                      ? [
                          ["monthly_img", "Monthly"],
                          ["weekly_img", "Weekly"],
                          ["daily_img", "Daily"],
                          ["h4_img", "H4"],
                          ["h1_img", "H1"],
                          ["m15_img", "M15"],
                        ]
                      : [
                          ["h1_img", "H1 Structure"],
                          ["m15_img", "M15 Context"],
                          ["m5_img", "M5 Execution"],
                        ]),
                  ] as [MissedTradeImageKey, string][]
                ).map(([key, title], index) => (
                  <div key={key} className="space-y-2">
                    {index === 2 && (
                      <h3 className="border-t border-border pt-5 text-sm font-semibold">
                        Phân tích đa khung thời gian · Tùy chọn
                      </h3>
                    )}
                    <p className="text-xs font-medium">{title}</p>
                    <PasteSlot
                      label={title}
                      image={draft[key] || undefined}
                      pendingImage={files[key]}
                      disabled={busy}
                      focused={focusedImage === key}
                      onFocus={() => setFocusedImage(key)}
                      onChange={(path) =>
                        update({ [key]: path || (key === "before_img" ? "" : null) })
                      }
                      onPendingImageChange={(image) => {
                        setFiles((prev) => ({ ...prev, [key]: image }));
                        setDirty(true);
                      }}
                      className="h-48 sm:h-64"
                      showChartActions
                      showPasteTarget
                    />
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground">
                  Ảnh tối đa 15 MB · Chỉ tải lên khi lưu.
                </p>
                <div className="space-y-2 rounded-xl border border-border p-4">
                  {label("miss-r", "R giả định · Tùy chọn")}
                  <input
                    id="miss-r"
                    type="number"
                    step="any"
                    value={draft.hypothetical_r ?? ""}
                    onChange={(e) =>
                      update({
                        hypothetical_r: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className={`${inputClass} h-11 md:h-10`}
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Chỉ phục vụ review, không cộng vào hiệu suất thực tế.
                  </p>
                </div>
              </div>
            </fieldset>
            <div className="sticky bottom-0 space-y-3 border-t border-border bg-card p-4 sm:px-6">
              {busy && saveStage && (
                <p role="status" className="text-xs text-muted-foreground">
                  {saveStage}
                </p>
              )}
              {error && (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                {onDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setConfirmation("delete")}
                    className="text-destructive"
                  >
                    Xóa
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">* Bắt buộc</span>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={close}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Đang lưu…" : "Lưu trade miss"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(v) => {
          if (!v && !busy) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === "delete" ? "Xóa trade bị miss?" : "Bỏ thay đổi chưa lưu?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === "delete"
                ? "Bản ghi và các chart của trade miss này sẽ bị xóa."
                : "Nội dung bạn vừa nhập chưa được lưu vào nhật ký."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (confirmation === "delete") void remove();
                else {
                  setConfirmation(null);
                  if (confirmation === "bias") openBias();
                  else onClose();
                }
              }}
            >
              {confirmation === "delete"
                ? "Xóa trade"
                : confirmation === "bias"
                  ? "Bỏ thay đổi và mở bias"
                  : "Bỏ thay đổi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
