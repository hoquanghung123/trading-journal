// Tiny pub/sub for cross-page navigation (Bias Expect <-> Trade Log)

type Listener = (entryId: string, asset?: string) => void;
const listeners = new Set<Listener>();

export function onBiasFocus(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function focusBiasEntry(entryId: string, asset?: string) {
  listeners.forEach((fn) => fn(entryId, asset));
}

// Page navigation bus
export type PageId =
  | "dashboard"
  | "bias"
  | "trades"
  | "psychology"
  | "playbook"
  | "daily"
  | "review";
type PageListener = (p: PageId) => void;
const pageListeners = new Set<PageListener>();

export function onPageChange(fn: PageListener): () => void {
  pageListeners.add(fn);
  return () => {
    pageListeners.delete(fn);
  };
}

export function navigateToPage(p: PageId) {
  pageListeners.forEach((fn) => fn(p));
}

// Daily View Navigation
type DailyListener = (date: string) => void;
const dailyListeners = new Set<DailyListener>();

export function onDailyFocus(fn: DailyListener): () => void {
  dailyListeners.add(fn);
  return () => {
    dailyListeners.delete(fn);
  };
}

export function focusDailyView(dateString: string) {
  dailyListeners.forEach((fn) => fn(dateString));
}

// Playbook Navigation
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

// Celebration Navigation
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
