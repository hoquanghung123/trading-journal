// Tiny pub/sub for cross-page navigation (Bias Expect <-> Trade Log)

type Listener = (entryId: string) => void;
const listeners = new Set<Listener>();

export function onBiasFocus(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function focusBiasEntry(entryId: string) {
  listeners.forEach((fn) => fn(entryId));
}

// Page navigation bus
export type PageId = "dashboard" | "bias" | "trades";
type PageListener = (p: PageId) => void;
const pageListeners = new Set<PageListener>();

export function onPageChange(fn: PageListener): () => void {
  pageListeners.add(fn);
  return () => { pageListeners.delete(fn); };
}

export function navigateToPage(p: PageId) {
  pageListeners.forEach((fn) => fn(p));
}
