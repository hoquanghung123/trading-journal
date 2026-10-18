import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMissedTrades,
  missedTradesQueryKey,
  saveMissedTrade,
  deleteMissedTrade,
  type MissedTrade,
} from "@/lib/missed-trades";
import { timelineDay } from "@/lib/trade-timeline";
import { MissedTradeModal } from "@/components/journal/MissedTradeModal";
import { Button } from "@/components/ui/button";

export function MissedTradeReview({ start, end }: { start?: string; end?: string }) {
  const queryClient = useQueryClient();
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: missedTradesQueryKey, queryFn: fetchMissedTrades });
  const [editing, setEditing] = useState<MissedTrade | null>(null);
  const trades = data.filter((t) => {
    const day = timelineDay(t.setup_time);
    return (!start || day >= start) && (!end || day <= end);
  });
  const reasons = trades.reduce<Record<string, number>>(
    (acc, t) => ({ ...acc, [t.reason]: (acc[t.reason] ?? 0) + 1 }),
    {},
  );
  const save = async (t: MissedTrade) => {
    await saveMissedTrade(t);
    queryClient.setQueryData<MissedTrade[]>(missedTradesQueryKey, (old) => [
      t,
      ...(old ?? []).filter((row) => row.id !== t.id),
    ]);
    void queryClient.invalidateQueries({ queryKey: missedTradesQueryKey });
  };
  const remove = async (t: MissedTrade) => {
    await deleteMissedTrade(t);
    queryClient.setQueryData<MissedTrade[]>(missedTradesQueryKey, (old) =>
      (old ?? []).filter((row) => row.id !== t.id),
    );
    void queryClient.invalidateQueries({ queryKey: missedTradesQueryKey });
  };
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div>
        <h3 className="text-base font-semibold">
          Cơ hội bị miss{" "}
          <span className="ml-2 text-sm text-muted-foreground">{trades.length} setup</span>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Phân tích nguyên nhân bỏ lỡ. Không cộng kết quả giả định vào hiệu suất.
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Đang tải trade miss…</p>
      ) : error ? (
        <p role="alert" className="text-xs text-destructive">
          Không tải được trade miss.{" "}
          <button type="button" onClick={() => void refetch()} className="underline">
            Thử lại
          </button>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {Object.entries(reasons).map(([reason, count]) => (
              <span key={reason} className="rounded-lg border border-border px-3 py-1.5 text-xs">
                {reason} · {count}/{trades.length}
              </span>
            ))}
          </div>
          {!trades.length && (
            <p className="rounded-xl border border-dashed border-border p-5 text-xs text-muted-foreground">
              Chưa ghi nhận trade miss trong kỳ này.
            </p>
          )}
          {trades.map((t) => (
            <details key={t.id} className="rounded-xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold">
                {t.symbol}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {t.side.toUpperCase()} · {timelineDay(t.setup_time)} · {t.reason}
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {t.analysis}
                </p>
                {t.lesson && (
                  <div>
                    <h4 className="text-xs font-semibold">Bài học</h4>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {t.lesson}
                    </p>
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                  Xem / sửa phân tích
                </Button>
              </div>
            </details>
          ))}
        </>
      )}
      <MissedTradeModal
        trade={editing}
        onClose={() => setEditing(null)}
        onSave={save}
        onDelete={remove}
      />
    </section>
  );
}
