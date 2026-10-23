import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { computeOutcome, type Trade, type TradeOutcomeReview as Review } from "@/lib/trades";

const BE_TRIGGERS = [
  "Đạt mức R theo kế hoạch",
  "Giá phá cấu trúc theo hướng có lợi",
  "Giá retest và xác nhận vùng entry",
  "Đã chốt lời một phần",
  "Giá đến vùng thanh khoản / cản quan trọng",
  "Sắp có tin tức quan trọng",
  "Sắp hết phiên / hết thời gian giữ lệnh",
  "Dời sớm khi chưa đủ điều kiện",
  "Không có quy tắc dời SL rõ ràng",
];
const PSYCHOLOGICAL_REASONS = [
  "Bình tĩnh, thực hiện đúng kế hoạch",
  "Muốn bảo vệ vốn",
  "Sợ mất phần lời đang có",
  "Lo lắng sau chuỗi thua",
  "Muốn gỡ khoản lỗ trước đó",
  "Thiếu tự tin vào setup",
  "Nóng vội, không muốn chờ thêm",
  "Bị ảnh hưởng bởi ý kiến bên ngoài",
  "Mệt mỏi / mất tập trung",
];
const EXECUTION_ERRORS = [
  "Không có lỗi thực thi",
  "Vào lệnh quá sớm, chưa đủ xác nhận",
  "Vào lệnh trễ / đuổi giá / FOMO",
  "Bỏ qua điều kiện trong checklist",
  "Giao dịch ngược bias / sai bối cảnh",
  "Đặt SL sai vị trí",
  "Nới SL sau khi vào lệnh",
  "Sai khối lượng / vượt mức risk",
  "Thoát tay trước điều kiện vô hiệu",
  "Giao dịch ngoài phiên / giờ cho phép",
  "Bỏ qua quy tắc giao dịch khi có tin",
  "Overtrade / vào lại khi chưa có setup mới",
  "Vào nhầm lệnh / thao tác sai",
];
const AFTER_EXIT_RESULTS = [
  "Chạm TP trước SL gốc",
  "Chạm SL gốc trước TP",
  "Chưa chạm TP hoặc SL gốc khi kết thúc quan sát",
  "Không xác định được thứ tự chạm TP / SL",
  "Chưa theo dõi",
];
const SELECT_CLASS =
  "min-h-12 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type MultiKey = "beTrigger" | "psychologicalReason" | "executionErrors";

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
  const update = (patch: Partial<Review>) =>
    onUpdate({
      experimentalArgs: {
        ...trade.experimentalArgs,
        outcomeReview: { ...review, ...patch },
      },
    });
  const choices = (key: MultiKey, title: string, options: string[]) => {
    const saved = review[key];
    const selected = Array.isArray(saved) ? saved : saved ? [saved] : [];
    const legacy = selected.filter((value) => !options.includes(value));
    return (
      <fieldset className="min-w-0 space-y-3">
        <legend className="text-sm font-medium">
          {title} <span className="font-normal text-muted-foreground">· Chọn nhiều</span>
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...options, ...legacy].map((option, index) => (
            <Label
              key={option}
              htmlFor={`${id}-${key}-${index}`}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm font-normal leading-5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox
                id={`${id}-${key}-${index}`}
                className="mt-0.5 shadow-none"
                checked={selected.includes(option)}
                onCheckedChange={(checked) => {
                  let next = checked
                    ? [...selected, option]
                    : selected.filter((value) => value !== option);
                  if (key === "executionErrors" && checked) {
                    next =
                      option === EXECUTION_ERRORS[0]
                        ? [option]
                        : next.filter((value) => value !== EXECUTION_ERRORS[0]);
                  }
                  update({ [key]: next });
                }}
              />
              <span className="min-w-0 break-words">
                {option}
                {legacy.includes(option) && (
                  <span className="text-muted-foreground"> (đã lưu trước đây)</span>
                )}
              </span>
            </Label>
          ))}
        </div>
      </fieldset>
    );
  };

  return (
    <section className="space-y-6 rounded-xl border border-border p-4 sm:p-6">
      <div className="space-y-1">
        <h3 className="text-sm font-bold">
          {isBE ? "Breakeven · Quyết định dời SL" : "Trade lỗ · Nguyên nhân và khả năng kiểm soát"}
        </h3>
        <p className="text-xs text-muted-foreground">
          Chọn các mục phù hợp. Có thể bỏ chọn hoặc để trống khi chưa có dữ liệu.
        </p>
      </div>
      {isBE
        ? choices("beTrigger", "Điều kiện kích hoạt", BE_TRIGGERS)
        : choices("executionErrors", "Lỗi thực thi", EXECUTION_ERRORS)}
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
            const value = event.target.valueAsNumber;
            if (event.target.value === "") update({ mfeBeforeExitR: undefined });
            else if (Number.isFinite(value) && value >= 0) update({ mfeBeforeExitR: value });
          }}
          placeholder="Ví dụ: 1.2"
          className="h-12 rounded-xl bg-muted/30"
          aria-describedby={`${id}-mfe-help`}
        />
        <p id={`${id}-mfe-help`} className="text-xs text-muted-foreground">
          Nhập mức lời chưa chốt lớn nhất khi còn giữ lệnh, tính theo R của rủi ro ban đầu. Nhập 0
          nếu chưa từng có lời; để trống nếu chưa có dữ liệu.
        </p>
      </div>
      {isBE && (
        <div className="space-y-2">
          <Label htmlFor={`${id}-after-exit`}>Kết quả sau exit · Chọn một</Label>
          <select
            id={`${id}-after-exit`}
            value={review.afterExitResult ?? ""}
            onChange={(event) => update({ afterExitResult: event.target.value })}
            className={SELECT_CLASS}
            aria-describedby={`${id}-after-exit-help`}
          >
            <option value="">Chưa ghi nhận</option>
            {AFTER_EXIT_RESULTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            {review.afterExitResult && !AFTER_EXIT_RESULTS.includes(review.afterExitResult) && (
              <option value={review.afterExitResult}>
                {review.afterExitResult} (đã lưu trước đây)
              </option>
            )}
          </select>
          <p id={`${id}-after-exit-help`} className="text-xs text-muted-foreground">
            Đánh giá trong thời hạn hiệu lực setup theo playbook; nếu chưa có, dùng hết phiên giao
            dịch của lệnh.
          </p>
        </div>
      )}
      {isBE && choices("psychologicalReason", "Lý do tâm lý", PSYCHOLOGICAL_REASONS)}
    </section>
  );
}
