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

function writeUrl(page: PageId, date?: string, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("page", page);
  if ((page === "daily" || page === "bias") && date) url.searchParams.set("date", date);
  else url.searchParams.delete("date");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    if (mode === "replace") window.history.replaceState({ page, date }, "", next);
    else window.history.pushState({ page, date }, "", next);
  }
  document.title = `${PAGE_TITLES[page]} · Chartmate`;
}

export type BiasFocusView = "today" | "timeline";

type BiasListener = (entryId: string, asset?: string, opts?: { view?: BiasFocusView }) => void;
const biasListeners = new Set<BiasListener>();

export function onBiasFocus(fn: BiasListener): () => void {
  biasListeners.add(fn);
  return () => {
    biasListeners.delete(fn);
  };
}

export function focusBiasEntry(
  entryId: string,
  asset?: string,
  opts?: { view?: BiasFocusView },
) {
  biasListeners.forEach((fn) => fn(entryId, asset, opts));
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
    if (p === "daily") dailyListeners.forEach((fn) => fn(extra.date!));
    if (p === "bias") biasDateListeners.forEach((fn) => fn(extra.date!));
  }
}

export function setNavUrl(page: PageId, date?: string) {
  writeUrl(page, date, "replace");
}

type BiasDateListener = (date: string) => void;
const biasDateListeners = new Set<BiasDateListener>();

export function onBiasDateFocus(fn: BiasDateListener): () => void {
  biasDateListeners.add(fn);
  return () => {
    biasDateListeners.delete(fn);
  };
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
  window.setTimeout(() => {
    newTradeListeners.forEach((fn) => fn());
  }, 80);
}

type OpenTradeListener = (id: string) => void;
const openTradeListeners = new Set<OpenTradeListener>();

export function onRequestOpenTrade(fn: OpenTradeListener): () => void {
  openTradeListeners.add(fn);
  return () => {
    openTradeListeners.delete(fn);
  };
}

export function requestOpenTrade(id: string) {
  navigateToPage("trades");
  window.setTimeout(() => {
    openTradeListeners.forEach((fn) => fn(id));
  }, 80);
}

type NewBiasListener = (asset?: string) => void;
const newBiasListeners = new Set<NewBiasListener>();

export function onRequestNewBias(fn: NewBiasListener): () => void {
  newBiasListeners.add(fn);
  return () => {
    newBiasListeners.delete(fn);
  };
}

export function requestNewBias(asset?: string) {
  navigateToPage("bias");
  window.setTimeout(() => {
    newBiasListeners.forEach((fn) => fn(asset));
  }, 80);
}

type BiasAssetListener = (asset: string) => void;
const biasAssetListeners = new Set<BiasAssetListener>();

export function onBiasAssetFocus(fn: BiasAssetListener): () => void {
  biasAssetListeners.add(fn);
  return () => {
    biasAssetListeners.delete(fn);
  };
}

export function focusBiasAsset(asset: string) {
  navigateToPage("bias");
  window.setTimeout(() => {
    biasAssetListeners.forEach((fn) => fn(asset));
  }, 80);
}
