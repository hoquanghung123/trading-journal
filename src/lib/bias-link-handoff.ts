const storageKey = "lms-bias-link-handoff";
type Handoff = { code: string; expiresAt: number };
let cachedHandoff: Handoff | null = null;

/** Capture before login; remove the one-time token from the address bar. */
export function readBiasLinkHandoff(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const incoming = params.get("lms_connect");
  let handoff: Handoff | null = null;
  if (incoming !== null) {
    params.delete("lms_connect");
    const fragment = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${fragment ? `#${fragment}` : ""}`);
    if (/^[A-Za-z0-9]{24}$/.test(incoming)) {
      handoff = { code: incoming, expiresAt: Date.now() + 10 * 60 * 1000 };
      cachedHandoff = handoff;
      try { window.sessionStorage.setItem(storageKey, JSON.stringify(handoff)); } catch { /* Same-tab login can still use the returned token. */ }
    }
  } else {
    try { handoff = JSON.parse(window.sessionStorage.getItem(storageKey) || "null") || cachedHandoff; } catch { handoff = cachedHandoff; }
  }
  if (handoff && /^[A-Za-z0-9]{24}$/.test(handoff.code) && handoff.expiresAt > Date.now()) return handoff.code;
  clearBiasLinkHandoff();
  return null;
}

export function clearBiasLinkHandoff() {
  cachedHandoff = null;
  try { window.sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
}
