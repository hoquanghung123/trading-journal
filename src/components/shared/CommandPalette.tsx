import { useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  PAGE_TITLES,
  focusBiasAsset,
  navigateToPage,
  requestNewBias,
  requestNewTrade,
  requestOpenTrade,
  type PageId,
} from "@/lib/nav-bus";
import {
  BookOpen,
  Brain,
  CalendarCheck,
  Crosshair,
  FileText,
  Flame,
  LayoutDashboard,
  Plus,
  UserCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchTrades, tradesQueryKey, computeOutcome } from "@/lib/trades";
import { fetchSymbols, symbolsQueryKey } from "@/lib/symbols";
import { format, parseISO } from "date-fns";

const PAGES: { id: PageId; icon: typeof Crosshair }[] = [
  { id: "bias", icon: Crosshair },
  { id: "trades", icon: FileText },
  { id: "playbook", icon: BookOpen },
  { id: "review", icon: CalendarCheck },
  { id: "dashboard", icon: LayoutDashboard },
  { id: "psychology", icon: Brain },
  { id: "progress", icon: Flame },
  { id: "account", icon: UserCircle },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  const { data: trades = [] } = useQuery({
    queryKey: tradesQueryKey,
    queryFn: fetchTrades,
    enabled: open,
  });
  const { data: symbols = [] } = useQuery({
    queryKey: symbolsQueryKey,
    queryFn: fetchSymbols,
    enabled: open,
  });

  const recentTrades = useMemo(
    () => [...trades].sort((a, b) => b.entryTime.localeCompare(a.entryTime)).slice(0, 40),
    [trades],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key.toLowerCase() === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        requestNewTrade();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump, add bias, or search symbol / trade…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              requestNewTrade();
            }}
          >
            <Plus className="w-4 h-4" />
            New trade
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              requestNewBias();
            }}
          >
            <Crosshair className="w-4 h-4" />
            Add bias
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Pages">
          {PAGES.map((p) => {
            const Icon = p.icon;
            return (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  setOpen(false);
                  navigateToPage(p.id);
                }}
              >
                <Icon className="w-4 h-4" />
                {PAGE_TITLES[p.id]}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {symbols.some((s) => !s.isForex) && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Symbols">
              {symbols
                .filter((s) => !s.isForex)
                .map((s) => (
                <CommandItem
                  key={s.id}
                  value={`symbol ${s.name}`}
                  onSelect={() => {
                    setOpen(false);
                    focusBiasAsset(s.name);
                  }}
                >
                  <Crosshair className="w-4 h-4" />
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {recentTrades.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Trades">
              {recentTrades.map((t) => {
                const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl, t.brokerData).label;
                const when = format(parseISO(t.entryTime), "MMM d HH:mm");
                return (
                  <CommandItem
                    key={t.id}
                    value={`trade ${t.symbol} ${t.side} ${outcome} ${t.notes ?? ""} ${when}`}
                    onSelect={() => {
                      setOpen(false);
                      requestOpenTrade(t.id);
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    {t.symbol} {t.side} · {outcome} · {when}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
