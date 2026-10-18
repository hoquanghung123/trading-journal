import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  fetchMt5Connections,
  fetchMt5Inbox,
  manageMt5,
  mt5Endpoint,
  mt5Keys,
  type Mt5Connection,
  type Mt5Pending,
} from "@/lib/mt5";
import { nyDateTime, type BrokerData } from "@/lib/mt5/protocol";
import { tradesQueryKey } from "@/lib/trades";

const card = "rounded-xl border border-border bg-card p-4 space-y-3";
export function Mt5Details({ data: b }: { data: BrokerData }) {
  const fields: [string, unknown][] = [
    ["MT5", `${b.sourceSymbol} · ${b.accountLogin} · ${b.server}`],
    ["Vị thế", `${b.positionKey} · ${b.side.toUpperCase()} · ${b.volume} lots`],
    ["Mở (New York)", nyDateTime(b.entryTime)],
    ["Đóng (New York)", b.exitTime ? nyDateTime(b.exitTime) : "Đang mở"],
    ["Entry / Exit", `${b.entryPrice} / ${b.exitPrice ?? "—"}`],
    ["SL / TP ban đầu", `${b.initialSl ?? "—"} / ${b.initialTp ?? "—"}`],
    ["SL / TP cuối", `${b.finalSl ?? "—"} / ${b.finalTp ?? "—"}`],
    ["Gross P&L", `${b.grossPnl} ${b.currency}`],
    ["Commission / Swap / Fee", `${b.commission} / ${b.swap} / ${b.brokerFee}`],
    ["Net P&L", `${b.netPnl.toFixed(2)} ${b.currency}`],
    [
      "Giờ broker gốc",
      `${new Date(b.brokerEntryTime * 1000).toISOString().replace("T", " ").slice(0, 19)} (UTC${b.entryOffsetMinutes >= 0 ? "+" : ""}${b.entryOffsetMinutes / 60})`,
    ],
  ];
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      {fields.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="break-words font-medium">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
function PendingTrade({ item, connection }: { item: Mt5Pending; connection?: Mt5Connection }) {
  const qc = useQueryClient();
  const [symbol, setSymbol] = useState(connection?.mappings[item.payload.sourceSymbol] ?? "");
  const [remember, setRemember] = useState(true);
  useEffect(
    () => setSymbol(connection?.mappings[item.payload.sourceSymbol] ?? ""),
    [connection?.mappings, item.payload.sourceSymbol],
  );
  const mutation = useMutation({
    mutationFn: (decision: string) =>
      manageMt5({
        action: "review",
        id: item.id,
        revision: item.revision,
        decision,
        symbol: symbol.trim(),
        remember,
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: mt5Keys.inbox }),
        qc.invalidateQueries({ queryKey: mt5Keys.connections }),
        qc.invalidateQueries({ queryKey: tradesQueryKey }),
        qc.invalidateQueries({ queryKey: ["symbols"] }),
      ]);
      toast.success("Đã xử lý trong journal. MT5 không bị thay đổi.");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: mt5Keys.inbox });
    },
  });
  return (
    <article className={card}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">
          {item.payload.status === "Closed" ? "Vị thế MT5 đã đóng" : "Vị thế MT5 mới"} — chờ duyệt
        </h3>
        <span className="text-xs text-muted-foreground">{connection?.name}</span>
      </div>
      <Mt5Details data={item.payload} />
      <div className="space-y-2">
        <Label htmlFor={"symbol-" + item.id}>Symbol trong journal</Label>
        <Input
          id={"symbol-" + item.id}
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Chọn/nhập symbol, ví dụ NQ1!"
          maxLength={50}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Nhớ ánh xạ {item.payload.sourceSymbol} cho lần sau
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!symbol.trim() || mutation.isPending || !!connection?.revoked_at}
          onClick={() => mutation.mutate("approve")}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Xác nhận nhập
        </Button>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("ignore")}
        >
          Bỏ qua
        </Button>
      </div>
      {connection?.revoked_at && (
        <p className="text-sm text-destructive">Kết nối đã thu hồi. Chỉ có thể bỏ qua.</p>
      )}
    </article>
  );
}
export function Mt5Notifications() {
  const [open, setOpen] = useState(false);
  const seen = useRef(new Set<string>());
  const [page, setPage] = useState(0);
  const inbox = useQuery({
    queryKey: [...mt5Keys.inbox, page],
    queryFn: () => fetchMt5Inbox(page),
    refetchInterval: 10000,
    retry: 1,
    gcTime: 0,
  });
  const connections = useQuery({
    queryKey: mt5Keys.connections,
    queryFn: fetchMt5Connections,
    refetchInterval: 10000,
    retry: 1,
    gcTime: 0,
  });
  useEffect(() => {
    const fresh = (inbox.data?.items ?? []).filter(
      (item) => !seen.current.has(`${item.id}:${item.revision}`),
    );
    for (const item of fresh) seen.current.add(`${item.id}:${item.revision}`);
    if (fresh.length) {
      const item = fresh[0];
      toast.info(
        fresh.length === 1
          ? `${item.payload.status === "Closed" ? "Vị thế MT5 đã đóng" : "Vị thế MT5 mới"}: ${item.payload.sourceSymbol} — chờ bạn duyệt`
          : `Có ${inbox.data?.total} giao dịch MT5 chờ duyệt`,
        { action: { label: "Xem", onClick: () => setOpen(true) } },
      );
    }
    if (page > 0 && inbox.data && page * 25 >= inbox.data.total) setPage(0);
  }, [inbox.data, page]);
  if (!connections.data?.length && !inbox.data?.total) return null;
  return (
    <>
      <div className="border-b border-border bg-card px-4 py-2 flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs text-muted-foreground">MT5 chỉ đọc · New York</span>
        <Button
          variant={inbox.data?.total ? "default" : "outline"}
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Bell className="mr-2 h-4 w-4" />
          Chờ duyệt MT5 ({inbox.data?.total ?? 0})
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Giao dịch MT5 chờ duyệt</DialogTitle>
            <DialogDescription>
              Chỉ Xác nhận nhập mới cập nhật Trade Log. Không thao tác giao dịch trên MT5. Giờ hiển
              thị America/New_York (EST/EDT).
            </DialogDescription>
          </DialogHeader>
          {inbox.isLoading ? (
            <p>Đang tải…</p>
          ) : inbox.error ? (
            <p role="alert">
              Không tải được dữ liệu.{" "}
              <Button variant="outline" onClick={() => inbox.refetch()}>
                Thử lại
              </Button>
            </p>
          ) : !inbox.data?.total ? (
            <p className="py-6 text-muted-foreground">Không có giao dịch chờ duyệt.</p>
          ) : (
            inbox.data.items.map((item) => (
              <PendingTrade
                key={`${item.id}:${item.revision}`}
                item={item}
                connection={connections.data?.find((c) => c.id === item.connection_id)}
              />
            ))
          )}
          {(inbox.data?.total ?? 0) > 25 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                disabled={page === 0 || inbox.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <span className="text-xs">
                Trang {page + 1} / {Math.ceil((inbox.data?.total ?? 0) / 25)}
              </span>
              <Button
                variant="outline"
                disabled={(page + 1) * 25 >= (inbox.data?.total ?? 0) || inbox.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Tiếp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function ConnectionCard({ c }: { c: Mt5Connection }) {
  const qc = useQueryClient();
  const [mappings, setMappings] = useState(JSON.stringify(c.mappings, null, 2));
  const [rules, setRules] = useState(JSON.stringify(c.offset_rules, null, 2));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [revoke, setRevoke] = useState(false);
  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => manageMt5({ ...body, id: c.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mt5Keys.connections });
      toast.success("Đã cập nhật kết nối");
      setRevoke(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const online = c.last_seen_at && Date.now() - Date.parse(c.last_seen_at) < 45000;
  const submitConfig = () => {
    try {
      mutation.mutate({
        action: "configure",
        mappings: JSON.parse(mappings),
        offsetRules: JSON.parse(rules),
      });
    } catch {
      toast.error("JSON không hợp lệ");
    }
  };
  return (
    <article className={card}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{c.name}</h3>
        <span className="text-xs">
          {c.revoked_at ? "Đã thu hồi" : online ? "Đang kết nối" : "Chưa kết nối / offline"}
        </span>
      </div>
      <p className="text-sm break-words">
        {c.account_login} · {c.server}
      </p>
      <p className="text-xs text-muted-foreground">
        Lần nhận gần nhất: {c.last_seen_at ? nyDateTime(c.last_seen_at) + " NY" : "Chưa có"}
      </p>
      {c.last_error && (
        <p role="alert" className="text-sm text-destructive break-words">
          {c.last_error}
        </p>
      )}
      {!c.revoked_at && (
        <>
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-medium">
              Ánh xạ symbol và giờ broker
            </summary>
            <Label htmlFor={"map-" + c.id}>Ánh xạ MT5 → journal (JSON)</Label>
            <Textarea
              id={"map-" + c.id}
              value={mappings}
              onChange={(e) => setMappings(e.target.value)}
              rows={7}
            />
            <Label htmlFor={"rules-" + c.id}>Quy tắc giờ server (JSON, mốc theo giờ broker)</Label>
            <Textarea
              id={"rules-" + c.id}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Thêm từng giai đoạn GMT+2/GMT+3 theo lịch server đã xác minh. Không dùng offset hiện
              tại cho toàn bộ lịch sử. Lưu sẽ yêu cầu EA quét lại; dữ liệu thay đổi cần duyệt lại.
            </p>
            <Button variant="outline" disabled={mutation.isPending} onClick={submitConfig}>
              Lưu cấu hình
            </Button>
          </details>
          <div className="space-y-3 border-t border-border pt-3">
            <p className="text-sm font-medium">Nhập lịch sử theo ngày New York</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={"from-" + c.id}>Từ ngày</Label>
                <Input
                  id={"from-" + c.id}
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={"to-" + c.id}>Đến hết ngày</Label>
                <Input
                  id={"to-" + c.id}
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Lịch sử cũng vào Chờ duyệt. Kiểm tra các trade đã nhập tay để tránh trùng.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!from || !to || mutation.isPending}
                onClick={() => mutation.mutate({ action: "history", from, to })}
              >
                Yêu cầu nhập khoảng ngày
              </Button>
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ action: "live" })}
              >
                Từ lúc kết nối
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.history_from && c.history_to
                ? `Khoảng lịch sử: ${nyDateTime(c.history_from)} → ${nyDateTime(c.history_to)} (mốc cuối không bao gồm)`
                : `Từ lúc kết nối: ${nyDateTime(c.created_at)} NY`}
            </p>
          </div>
          {revoke ? (
            <div className="space-y-2">
              <p className="text-sm">Thu hồi sẽ ngừng nhận dữ liệu từ EA này.</p>
              <Button
                variant="destructive"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ action: "revoke" })}
              >
                Xác nhận thu hồi
              </Button>
              <Button variant="ghost" onClick={() => setRevoke(false)}>
                Hủy
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setRevoke(true)}>
              Thu hồi khóa kết nối
            </Button>
          )}
        </>
      )}
    </article>
  );
}
export function Mt5Settings() {
  const qc = useQueryClient();
  const [name, setName] = useState("Pepperstone");
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [rules, setRules] = useState("");
  const [verified, setVerified] = useState(false);
  const [token, setToken] = useState("");
  const connections = useQuery({
    queryKey: mt5Keys.connections,
    queryFn: fetchMt5Connections,
    refetchInterval: 10000,
    retry: 1,
    gcTime: 0,
  });
  const mutation = useMutation({
    mutationFn: () =>
      manageMt5({
        action: "create",
        name,
        accountLogin: login.trim(),
        server: server.trim(),
        offsetRules: JSON.parse(rules),
      }),
    onSuccess: (data) => {
      setToken(data.token);
      qc.invalidateQueries({ queryKey: mt5Keys.connections });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className={card}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Kết nối MT5 Pepperstone</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Chỉ đọc · Mở/đóng đều chờ duyệt · America/New_York. Giữ Position Sizer bật, tắt Allow Algo
        Trading riêng của EA đồng bộ trên chart khác.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <a className="underline" href="/mt5/JournalReadOnly.ex5" download>
          Tải EA .ex5
        </a>
        <a className="underline" href="/mt5/JournalReadOnly.mq5" download>
          Tải mã EA .mq5
        </a>
        <a className="underline" href="/mt5/README.md" target="_blank" rel="noreferrer">
          Hướng dẫn macOS
        </a>
      </div>
      {connections.error ? (
        <p role="alert" className="text-sm text-destructive">
          Chưa tải được tích hợp MT5. Kiểm tra migration và Edge Functions đã triển khai.{" "}
          <Button variant="ghost" onClick={() => connections.refetch()}>
            Thử lại
          </Button>
        </p>
      ) : connections.isLoading ? (
        <p>Đang tải…</p>
      ) : (
        connections.data?.map((c) => <ConnectionCard key={c.id} c={c} />)
      )}
      <details className="space-y-3">
        <summary className="cursor-pointer font-medium">Thêm kết nối chỉ đọc</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="mt5-name">Tên kết nối</Label>
            <Input
              id="mt5-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="mt5-login">Số tài khoản MT5</Label>
            <Input
              id="mt5-login"
              inputMode="numeric"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="mt5-server">Server chính xác trong MT5</Label>
            <Input
              id="mt5-server"
              placeholder="Tên server hiển thị trong MT5"
              value={server}
              onChange={(e) => setServer(e.target.value)}
            />
          </div>
        </div>
        <Label htmlFor="mt5-rules">Quy tắc giờ broker đã xác minh (JSON)</Label>
        <Textarea
          id="mt5-rules"
          rows={4}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder={'[{"from":"2026-01-01T00:00:00","offsetMinutes":120}]'}
        />
        <p className="text-xs text-muted-foreground">
          Đây là ví dụ định dạng, không phải lịch giờ Pepperstone được xác nhận. 120 = UTC+2, 180 =
          UTC+3. Cần đủ giai đoạn cho ngày mở và đóng; thiếu sẽ ngừng nhập và báo lỗi.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />
          Tôi đã xác minh giờ server và sẽ tắt Allow Algo Trading riêng của EA đồng bộ.
        </label>
        <Button
          disabled={
            !verified ||
            !rules ||
            !login.trim() ||
            !server.trim() ||
            !name.trim() ||
            mutation.isPending
          }
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Đang tạo…" : "Tạo khóa kết nối"}
        </Button>
      </details>
      {token && (
        <div className="rounded-lg border border-primary p-3 space-y-2">
          <p className="text-sm font-medium">
            Khóa chỉ hiển thị lần này. Dán vào input SyncKey của EA, không chia sẻ.
          </p>
          <Input aria-label="Khóa kết nối MT5" readOnly value={token} />
          <Button variant="outline" onClick={() => setToken("")}>
            Đã lưu, ẩn khóa
          </Button>
        </div>
      )}
      <Label htmlFor="mt5-endpoint">Endpoint cho EA</Label>
      <Input id="mt5-endpoint" readOnly value={mt5Endpoint()} />
    </section>
  );
}
