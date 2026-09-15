// Pub/sub for cross-page navigation + URL sync (?page=&date=)

export const PAGE_IDS = [
  "dashboard",
  "bias",
  "trades",
  "psychology",
  "playbook",
  "daily",
  "review",
  "progress",
  "account",
] as const;

export type PageId = (typeof PAGE_IDS)[number];

export const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "Stats",
  bias: "Bias Expect",
  trades: "Trade Log",
  psychology: "Psychology",
  playbook: "Playbook",
  daily: "Daily",
  review: "Review",
  progress: "Progress",
  account: "Account",
};

function isPageId(v: string | null | undefined): v is PageId {
  return !!v && (PAGE_IDS as readonly string[]).includes(v);
}

export function parseNavFromUrl(): { page: PageId; date?: string } {
  if (typeof window === "undefined") return { page: "bias" };
  const params = new URLSearchParams(window.location.search);
  const pageParam = params.get("page");
  const date = params.get("date") || undefined;
  if (isPageId(pageParam)) return { page: pageParam, date };
  try {
    const stored = localStorage.getItem("terminal-active-page");
    if (isPageId(stored)) return { page: stored, date };
  } catch {
    /* ignore */
  }
  return { page: "bias", date };
}

function writeUrl(page: PageId, date?: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("page", page);
  if (page === "daily" && date) url.searchParams.set("date", date);
  else url.searchParams.delete("date");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.pushState({ page, date }, "", next);
  }
  document.title = `${PAGE_TITLES[page]} · Chartmate`;
}

type BiasListener = (entryId: string, asset?: string) => void;
const biasListeners = new Set<BiasListener>();

export function onBiasFocus(fn: BiasListener): () => void {
  biasListeners.add(fn);
  return () => {
    biasListeners.delete(fn);
  };
}

export function focusBiasEntry(entryId: string, asset?: string) {
  biasListeners.forEach((fn) => fn(entryId, asset));
}

type PageListener = (p: PageId) => void;
const pageListeners = new Set<PageListener>();

export function onPageChange(fn: PageListener): () => void {
  pageListeners.add(fn);
  return () => {
    pageListeners.delete(fn);
  };
}

export function navigateToPage(p: PageId, extra?: { date?: string }) {
  writeUrl(p, extra?.date);
  pageListeners.forEach((fn) => fn(p));
  if (extra?.date) {
    dailyListeners.forEach((fn) => fn(extra.date!));
  }
}

type DailyListener = (date: string) => void;
const dailyListeners = new Set<DailyListener>();

export function onDailyFocus(fn: DailyListener): () => void {
  dailyListeners.add(fn);
  return () => {
    dailyListeners.delete(fn);
  };
}

export function focusDailyView(dateString: string) {
  writeUrl("daily", dateString);
  pageListeners.forEach((fn) => fn("daily"));
  dailyListeners.forEach((fn) => fn(dateString));
}

type PlaybookListener = (id: string) => void;
const playbookListeners = new Set<PlaybookListener>();

export function onPlaybookFocus(fn: PlaybookListener): () => void {
  playbookListeners.add(fn);
  return () => {
    playbookListeners.delete(fn);
  };
}

export function focusPlaybookModel(id: string) {
  playbookListeners.forEach((fn) => fn(id));
}

type CelebrationListener = (streak: number) => void;
const celebrationListeners = new Set<CelebrationListener>();

export function onShowCelebration(fn: CelebrationListener): () => void {
  celebrationListeners.add(fn);
  return () => {
    celebrationListeners.delete(fn);
  };
}

export function triggerCelebration(streak: number) {
  celebrationListeners.forEach((fn) => fn(streak));
}

type NewTradeListener = () => void;
const newTradeListeners = new Set<NewTradeListener>();

export function onRequestNewTrade(fn: NewTradeListener): () => void {
  newTradeListeners.add(fn);
  return () => {
    newTradeListeners.delete(fn);
  };
}

export function requestNewTrade() {
  navigateToPage("trades");
  newTradeListeners.forEach((fn) => fn());
}
