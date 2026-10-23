import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import type { Trade } from "@/lib/trades";
import type { MissedTrade } from "@/lib/missed-trades";
import {
  dayDate,
  shiftTimelinePeriod,
  timelineDay,
  timelinePerformance,
  timelinePeriod,
  TIMELINE_ZONE,
} from "@/lib/trade-timeline";
import { formatSigned, notesExcerpt } from "@/lib/trade-log";
import { getChartUrl } from "@/lib/journal";
import { Button } from "@/components/ui/button";
import { TradeImageThumb } from "./TradeImageThumb";

type Item =
  | { kind: "taken"; id: string; time: string; trade: Trade }
  | { kind: "miss"; id: string; time: string; trade: MissedTrade };
const dayLabel = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", ...options }).format(dayDate(day));
const clock = (time: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: TIMELINE_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
const tone = (n: number) =>
  n > 0 ? "text-primary" : n < 0 ? "text-destructive" : "text-muted-foreground";
const control = "rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted";

export function TradeTimelineView({
  trades,
  missed,
  playbookName,
  onOpen,
  onOpenMissed,
}: {
  trades: Trade[];
  missed: MissedTrade[];
  playbookName: (id?: string) => string | undefined;
  onOpen: (trade: Trade) => void;
  onOpenMissed: (trade: MissedTrade) => void;
}) {
  const today = timelineDay(new Date());
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [kind, setKind] = useState<"all" | "taken" | "miss">("all");
  const [showEmpty, setShowEmpty] = useState(true);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const period = timelinePeriod(anchor, mode);
  const items = useMemo<Item[]>(
    () =>
      [
        ...trades.map((trade) => ({
          kind: "taken" as const,
          id: trade.id,
          time: trade.entryTime,
          trade,
        })),
        ...missed.map((trade) => ({
          kind: "miss" as const,
          id: trade.id,
          time: trade.setup_time,
          trade,
        })),
      ].sort((a, b) => +new Date(a.time) - +new Date(b.time)),
    [trades, missed],
  );
  const inPeriod = items.filter((i) => {
    const d = timelineDay(i.time);
    return d >= period.start && d <= period.end;
  });
  const visible = inPeriod.filter((i) => kind === "all" || i.kind === kind);
  const actual = inPeriod.flatMap((i) => (i.kind === "taken" ? [i.trade] : []));
  const performance = timelinePerformance(actual);
  const calendar = timelinePeriod(anchor, "month");
  const jump = (day: string) => {
    setSelected(day);
    if (day < period.start || day > period.end) setAnchor(day);
    setOpenDays((prev) => ({ ...prev, [day]: true }));
    // Wait for a newly selected period to render before scrolling.
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .getElementById(`timeline-${day}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      ),
    );
  };
  const changeMode = (next: "week" | "month") => {
    setMode(next);
    setShowEmpty(next === "week");
    setOpenDays({});
  };
  const shift = (delta: number) => {
    setAnchor(shiftTimelinePeriod(anchor, mode, delta));
    setOpenDays({});
  };
  const setAll = (open: boolean) =>
    setOpenDays(Object.fromEntries(period.days.map((d) => [d, open])));

  return (
    <section className="space-y-5" aria-label="Timeline giao dịch">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              type="button"
              key={v}
              aria-pressed={mode === v}
              onClick={() => changeMode(v)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${mode === v ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              {v === "week" ? "Tuần" : "Tháng"}
            </button>
          ))}
        </div>
        <div className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto">
          <button type="button" className={control} onClick={() => shift(-1)} aria-label="Kỳ trước">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-0 flex-1 whitespace-nowrap text-center text-xs font-semibold sm:flex-none sm:min-w-44">
            {mode === "week"
              ? `${dayLabel(period.start, { day: "2-digit", month: "2-digit" })} – ${dayLabel(period.end, { day: "2-digit", month: "2-digit", year: "numeric" })}`
              : dayLabel(anchor, { month: "long", year: "numeric" })}
          </span>
          <button type="button" className={control} onClick={() => shift(1)} aria-label="Kỳ sau">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <button
          type="button"
          className={control}
          onClick={() => {
            setAnchor(today);
            setSelected(today);
            setOpenDays({});
          }}
        >
          Hiện tại
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 border-b border-border" aria-label="Loại bản ghi">
          {(
            [
              { id: "all", label: "Tất cả" },
              { id: "taken", label: "Đã vào lệnh" },
              { id: "miss", label: "Bị miss" },
            ] as const
          ).map((f) => (
            <button
              type="button"
              aria-pressed={kind === f.id}
              key={f.id}
              onClick={() => setKind(f.id)}
              className={`border-b-2 py-3 text-xs font-semibold ${kind === f.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={(e) => setShowEmpty(e.target.checked)}
              className="accent-primary"
            />
            Ngày trống
          </label>
          <button type="button" onClick={() => setAll(true)}>
            Mở tất cả ngày
          </button>
          <button type="button" onClick={() => setAll(false)}>
            Thu gọn
          </button>
        </div>
      </div>
      {mode === "week" && (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {period.days.map((day) => (
            <button
              type="button"
              key={day}
              onClick={() => jump(day)}
              aria-pressed={selected === day}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-3 ${selected === day ? "border-primary bg-primary/10" : "border-border bg-card"}`}
            >
              <span className="text-[9px] text-muted-foreground sm:text-xs">
                {dayLabel(day, { weekday: "short" })}
              </span>
              <span className="text-base font-semibold">{dayDate(day).getUTCDate()}</span>
              <DayDots items={items.filter((i) => timelineDay(i.time) === day)} />
            </button>
          ))}
        </div>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_252px]">
        <aside className="order-first rounded-xl border border-border bg-card p-4 xl:sticky xl:top-6 xl:order-last xl:p-5">
          <h3 className="text-sm font-semibold">Tổng kết {mode === "week" ? "tuần" : "tháng"}</h3>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs xl:grid-cols-1">
            <Metric label="Đã vào lệnh" value={`${actual.length} trade`} />
            <Metric label="Bị miss" value={`${inPeriod.length - actual.length} setup`} />
            <Metric
              label="R thực tế"
              value={performance.known ? `${formatSigned(performance.r, 1)}R` : "—"}
              className={tone(performance.r)}
            />
            <Metric
              label="Win rate"
              value={performance.winRate === null ? "—" : `${performance.winRate.toFixed(0)}%`}
            />
          </dl>
          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
            Chỉ lệnh đã đóng được tính vào hiệu suất. R chưa xác định được bỏ qua. Tổng kết không
            đổi khi lọc loại bản ghi.
          </p>
          <div className="mt-5 hidden border-t border-border pt-5 xl:block">
            <h3 className="text-xs font-semibold">
              {dayLabel(anchor, { month: "long", year: "numeric" })}
            </h3>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                <span key={d} className="text-center text-[9px] text-muted-foreground">
                  {d}
                </span>
              ))}
              {Array.from({ length: (dayDate(calendar.start).getUTCDay() + 6) % 7 }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {calendar.days.map((day) => (
                <button
                  type="button"
                  key={day}
                  aria-label={`Xem ngày ${day}`}
                  onClick={() => jump(day)}
                  className={`flex h-9 flex-col items-center justify-center gap-1 rounded text-[11px] ${selected === day ? "ring-1 ring-primary" : ""} ${items.some((i) => timelineDay(i.time) === day) ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  {dayDate(day).getUTCDate()}
                  <DayDots items={items.filter((i) => timelineDay(i.time) === day)} />
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-3 text-[10px] text-muted-foreground">
              <span>● Đã vào</span>
              <span className="text-warning">● Bị miss</span>
            </div>
          </div>
        </aside>
        <div className="min-w-0">
          <p className="mb-5 text-[11px] text-muted-foreground">
            UTC+7 · Bấm ngày để mở; bấm trade để xem phân tích.
          </p>
          {!visible.length && (
            <p
              role="status"
              className="mb-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground"
            >
              Chưa có bản ghi trong kỳ hoặc bộ lọc này. Chọn kỳ khác hoặc thêm trade.
            </p>
          )}
          <div className="relative before:absolute before:bottom-5 before:left-1 before:top-5 before:w-px before:bg-border sm:before:left-3">
            {period.days.map((day) => {
              const rows = visible.filter((i) => timelineDay(i.time) === day);
              if (!showEmpty && !rows.length && selected !== day) return null;
              const p = timelinePerformance(
                rows.flatMap((i) => (i.kind === "taken" ? [i.trade] : [])),
              );
              return (
                <details
                  id={`timeline-${day}`}
                  key={day}
                  open={openDays[day] ?? (rows.length > 0 && (mode === "week" || selected === day))}
                  onToggle={(e) => {
                    const isOpen = e.currentTarget.open;
                    setOpenDays((prev) =>
                      prev[day] === isOpen ? prev : { ...prev, [day]: isOpen },
                    );
                  }}
                  className="relative mb-3 scroll-mt-6 pl-7 before:absolute before:left-0 before:top-5 before:size-2.5 before:rounded-full before:border-2 before:border-primary before:bg-card sm:pl-10 sm:before:left-2"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 [&::-webkit-details-marker]:hidden">
                    <div>
                      <h3 className="text-sm font-semibold capitalize">
                        {dayLabel(day, { weekday: "long" })}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {dayLabel(day, { day: "2-digit", month: "2-digit" })}
                        </span>
                      </h3>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {rows.length
                          ? `${rows.filter((i) => i.kind === "taken").length} đã vào · ${rows.filter((i) => i.kind === "miss").length} bị miss`
                          : "Chưa có bản ghi"}
                      </p>
                    </div>
                    <span className={`whitespace-nowrap text-xs font-semibold ${tone(p.r)}`}>
                      {p.known ? `${formatSigned(p.r, 1)}R` : "—"}{" "}
                      <span className="ml-2 text-muted-foreground">⌄</span>
                    </span>
                  </summary>
                  <div className="space-y-3 pb-4">
                    {!rows.length ? (
                      <p className="rounded-lg border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
                        Chưa có bản ghi cho ngày này trong bộ lọc đã chọn.
                      </p>
                    ) : (
                      rows.map((item) => (
                        <TimelineEvent
                          key={`${item.kind}-${item.id}`}
                          item={item}
                          playbookName={playbookName}
                          onEdit={() =>
                            item.kind === "taken" ? onOpen(item.trade) : onOpenMissed(item.trade)
                          }
                        />
                      ))
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
function DayDots({ items }: { items: Item[] }) {
  return (
    <span className="flex h-1 gap-1">
      {items.some((i) => i.kind === "taken") && <i className="size-1 rounded-full bg-primary" />}
      {items.some((i) => i.kind === "miss") && <i className="size-1 rounded-full bg-warning" />}
    </span>
  );
}
function Metric({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-semibold ${className}`}>{value}</dd>
    </div>
  );
}
function TimelineEvent({
  item,
  playbookName,
  onEdit,
}: {
  item: Item;
  playbookName: (id?: string) => string | undefined;
  onEdit: () => void;
}) {
  const isMiss = item.kind === "miss";
  const t = item.trade;
  const actual = item.kind === "taken" ? item.trade : null;
  const miss = item.kind === "miss" ? item.trade : null;
  const before = actual?.beforeImg ?? miss?.before_img;
  const after = actual?.afterImg ?? miss?.after_img;
  const status = actual
    ? actual.status === "Not Started"
      ? "Draft"
      : actual.status === "Opened"
        ? "Đang mở"
        : "Đã đóng"
    : miss?.reason;
  return (
    <details className="overflow-hidden rounded-xl border border-border bg-card">
      <summary className="grid cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_64px] items-center gap-2 p-3 sm:grid-cols-[44px_76px_minmax(0,1fr)_88px] sm:gap-4 sm:p-4 [&::-webkit-details-marker]:hidden">
        <span className="text-[10px] tabular-nums text-muted-foreground sm:text-xs">
          {clock(item.time)}
        </span>
        <div className="hidden h-12 overflow-hidden rounded bg-muted sm:block">
          {before ? (
            <img
              src={getChartUrl(before)}
              alt={`Chart ${t.symbol}`}
              className="size-full object-cover"
            />
          ) : (
            <CalendarDays className="mx-auto mt-3 size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <b className="text-xs sm:text-sm">{t.symbol}</b>
            <span
              className={`text-[9px] font-semibold ${t.side === "buy" ? "text-primary" : "text-destructive"}`}
            >
              {t.side.toUpperCase()}
            </span>
            <span
              className={`rounded border px-1.5 py-0.5 text-[9px] ${isMiss ? "border-dashed border-warning/50 text-warning" : "border-border text-primary"}`}
            >
              {isMiss ? "Bị miss" : "Đã vào"}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
            {playbookName(actual?.setupId ?? miss?.setup_id ?? undefined) ?? "Chưa gắn setup"} ·{" "}
            {status}
          </p>
        </div>
        <div
          className={`text-right text-xs font-semibold sm:text-base ${actual ? tone(actual.actualRr) : "text-muted-foreground"}`}
        >
          {actual?.status === "Closed" ? `${formatSigned(actual.actualRr, 1)}R` : "—"}
          <span className="mt-1 block text-[9px] font-normal text-muted-foreground">
            {isMiss
              ? "Xem lý do ↓"
              : actual?.status === "Closed"
                ? "R thực tế ↓"
                : "Xem chi tiết ↓"}
          </span>
        </div>
      </summary>
      <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2 sm:p-5">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold">
              {isMiss ? "Vì sao tôi bỏ lỡ?" : "Nhận xét thực hiện"}
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
              {miss?.analysis || notesExcerpt(actual?.notes, 1500) || "Chưa có phân tích."}
            </p>
          </div>
          {miss && (
            <>
              <div>
                <h4 className="text-xs font-semibold">Bài học</h4>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {miss.lesson || "Chưa có bài học."}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Entry {miss.planned_entry ?? "—"} · SL {miss.planned_sl ?? "—"} · TP{" "}
                {miss.planned_tp ?? "—"}
                {miss.hypothetical_r !== null
                  ? ` · R giả định ${formatSigned(miss.hypothetical_r, 1)}R (không tính hiệu suất)`
                  : ""}
              </p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-3" />
            Chỉnh sửa phân tích
          </Button>
        </div>
        <div className="space-y-3">
          {before && (
            <img
              src={getChartUrl(before)}
              alt={`Chart setup ${t.symbol}`}
              className="max-h-72 w-full rounded-lg border border-border object-contain"
            />
          )}
          <div className="flex flex-wrap items-start gap-3">
            <TradeImageThumb
              path={before ?? undefined}
              label="Chart trước setup"
              pair={{ path: after ?? undefined, label: "Diễn biến sau" }}
            />
            {after && <TradeImageThumb path={after} label="Diễn biến sau" />}
          </div>
        </div>
      </div>
    </details>
  );
}
