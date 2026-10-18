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
import { MISS_REASONS, type MissedTrade } from "@/lib/missed-trades";
import { deleteChartImage, getChartUrl, uploadChartImage } from "@/lib/journal";
import { toast } from "sonner";
import { timelineDay } from "@/lib/trade-timeline";
import { useSymbols } from "@/lib/symbols";

const inputClass =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 md:text-sm";
const numberKeys = ["planned_entry", "planned_sl", "planned_tp", "hypothetical_r"] as const;
function localTime(iso: string) {
  return `${timelineDay(iso)}T${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso))}`;
}
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
  const [files, setFiles] = useState<{ before_img?: File; after_img?: File }>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"discard" | "delete" | null>(null);
  const [error, setError] = useState("");
  const { models } = usePlaybook();
  const {
    data: symbols = [],
    isLoading: symbolsLoading,
    error: symbolsError,
    refetch: retrySymbols,
  } = useSymbols();
  useEffect(() => {
    setDraft(trade ? { ...trade } : null);
    setFiles({});
    setDirty(false);
    setError("");
    setConfirmation(null);
  }, [trade]);
  if (!draft) return null;
  const update = (patch: Partial<MissedTrade>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
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
    const uploaded: string[] = [];
    try {
      for (const key of ["before_img", "after_img"] as const) {
        if (files[key]) {
          const path = await uploadChartImage(files[key]!);
          uploaded.push(path);
          next[key] = path;
        }
      }
      await onSave(next);
      // Only remove replaced files once the database points to their replacements.
      const replaced = [trade?.before_img, trade?.after_img].filter(
        (p): p is string => !!p && p !== next.before_img && p !== next.after_img,
      );
      await Promise.allSettled(replaced.map(deleteChartImage));
      toast.success("Đã lưu trade bị miss");
      onClose();
    } catch (e) {
      await Promise.allSettled(uploaded.map(deleteChartImage));
      setError(e instanceof Error ? e.message : "Không lưu được. Nội dung vẫn được giữ lại.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(draft);
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
                      {label("miss-time", "Thời điểm setup · UTC+7", true)}
                      <input
                        id="miss-time"
                        type="datetime-local"
                        required
                        value={localTime(draft.setup_time)}
                        onChange={(e) => {
                          if (e.target.value)
                            update({
                              setup_time: new Date(`${e.target.value}:00+07:00`).toISOString(),
                            });
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
                {(["before_img", "after_img"] as const).map((key, i) => (
                  <ChartField
                    key={key}
                    id={`miss-${key}`}
                    label={i === 0 ? "Chart setup *" : "Diễn biến sau · Tùy chọn"}
                    path={draft[key]}
                    file={files[key]}
                    onChange={(file) => {
                      setFiles((prev) => ({ ...prev, [key]: file }));
                      setDirty(true);
                    }}
                  />
                ))}
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
                  onClose();
                }
              }}
            >
              {confirmation === "delete" ? "Xóa trade" : "Bỏ thay đổi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function ChartField({
  id,
  label,
  path,
  file,
  onChange,
}: {
  id: string;
  label: string;
  path: string | null;
  file?: File;
  onChange: (f: File | undefined) => void;
}) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview(path ? getChartUrl(path) : "");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [path, file]);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-medium">
        {label}
      </label>
      {preview && (
        <img
          src={preview}
          alt={label}
          className="max-h-64 w-full rounded-lg border border-border object-contain"
        />
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        className="block w-full min-w-0 text-xs file:mr-2 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-foreground"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && (!f.type.startsWith("image/") || f.size > 15 * 1024 * 1024)) {
            toast.error("Chọn ảnh nhỏ hơn 15 MB.");
            e.target.value = "";
            return;
          }
          onChange(f);
        }}
      />
      <p className="text-[10px] text-muted-foreground">Ảnh tối đa 15 MB · Chỉ tải lên khi lưu.</p>
    </div>
  );
}
