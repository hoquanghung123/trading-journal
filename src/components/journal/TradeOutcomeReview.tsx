import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeOutcome, type Trade, type TradeOutcomeReview as Review } from "@/lib/trades";

export function TradeOutcomeReview({
  trade,
  onUpdate,
}: {
  trade: Trade;
  onUpdate: (patch: Partial<Trade>) => void;
}) {
  const id = useId();
  const outcome = computeOutcome(trade.actualRr, trade.maxRr, trade.netPnl).label;
  const review: Review = trade.experimentalArgs?.outcomeReview ?? {};
  if (trade.status !== "Closed" || outcome === "Win") return null;

  const isBE = outcome === "BE";
  const update = (patch: Partial<Review>) => {
    onUpdate({
      experimentalArgs: {
        ...trade.experimentalArgs,
        outcomeReview: { ...review, ...patch },
      },
    });
  };
  const textField = (
    key: "beTrigger" | "afterExitResult" | "psychologicalReason" | "executionErrors",
    label: string,
    placeholder: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Textarea
        id={`${id}-${key}`}
        value={review[key] ?? ""}
        onChange={(event) => update({ [key]: event.target.value })}
        placeholder={placeholder}
        className="min-h-24 rounded-xl bg-muted/30 shadow-none"
      />
    </div>
  );

  return (
    <section className="space-y-4 rounded-xl border border-border p-4 sm:p-6">
      <div className="space-y-1">
        <h3 className="text-sm font-bold">
          {isBE ? "Breakeven · Quyết định dời SL" : "Trade lỗ · Nguyên nhân và khả năng kiểm soát"}
        </h3>
        <p className="text-xs text-muted-foreground">
          Các trường đều tùy chọn. Chưa có dữ liệu thì để trống.
        </p>
      </div>
      {isBE &&
        textField(
          "beTrigger",
          "Điều kiện kích hoạt",
          "Ví dụ: giá đạt +1R và có cấu trúc xác nhận; dời SL theo quy tắc nào?",
        )}
      {!isBE &&
        textField(
          "executionErrors",
          "Lỗi thực thi",
          "Ví dụ: vào sớm, đuổi giá, nới SL, sai khối lượng. Nếu làm đúng kế hoạch, ghi: Không có lỗi thực thi.",
        )}
      <div className="space-y-2">
        <Label htmlFor={`${id}-mfe`}>{isBE ? "MFE trước exit (R)" : "MFE trước khi lỗ (R)"}</Label>
        <Input
          id={`${id}-mfe`}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={review.mfeBeforeExitR ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            const value = event.target.valueAsNumber;
            if (raw === "") update({ mfeBeforeExitR: undefined });
            else if (Number.isFinite(value) && value >= 0) update({ mfeBeforeExitR: value });
          }}
          placeholder="Ví dụ: 1.2"
          aria-describedby={`${id}-mfe-help`}
          className="h-12 rounded-xl bg-muted/30"
        />
        <p id={`${id}-mfe-help`} className="text-xs text-muted-foreground">
          Mức lời chưa chốt lớn nhất khi còn giữ lệnh, tính theo rủi ro ban đầu. Nhập 0 nếu lệnh
          chưa từng có lời.
        </p>
      </div>
      {isBE &&
        textField(
          "afterExitResult",
          "Kết quả sau exit",
          "Ví dụ: chạm TP trước SL gốc / chạm SL gốc trước / chưa chạm / chưa theo dõi. Ghi rõ mốc kết thúc quan sát, ví dụ hết phiên NY.",
        )}
      {isBE &&
        textField(
          "psychologicalReason",
          "Lý do tâm lý",
          "Ví dụ: bảo vệ vốn theo kế hoạch, sợ mất phần lời, lo sau chuỗi thua, muốn gỡ lệnh trước.",
        )}
    </section>
  );
}
