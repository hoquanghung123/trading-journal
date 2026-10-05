import test from "node:test";
import assert from "node:assert/strict";
import { readBiasLinkHandoff, clearBiasLinkHandoff } from "../src/lib/bias-link-handoff";

test("link token is removed from the URL, survives login and expires", () => {
  const originalWindow = (globalThis as any).window;
  const originalNow = Date.now;
  const code = "a".repeat(24);
  const values = new Map<string, string>();
  let now = 1000000;
  const fakeWindow = {
    location: { pathname: "/", search: "?page=bias", hash: `#lms_connect=${code}` },
    sessionStorage: {
      setItem: (key: string, value: string) => values.set(key, value),
      getItem: (key: string) => values.get(key) || null,
      removeItem: (key: string) => values.delete(key),
    },
    history: { state: null, replaceState: (_state: unknown, _title: string, url: string) => {
      assert.equal(url, "/?page=bias");
      fakeWindow.location.hash = "";
    } },
  };
  (globalThis as any).window = fakeWindow;
  Date.now = () => now;
  try {
    assert.equal(readBiasLinkHandoff(), code);
    assert.equal(fakeWindow.location.hash, "");
    assert.equal(readBiasLinkHandoff(), code);
    now += 10 * 60 * 1000;
    assert.equal(readBiasLinkHandoff(), null);
    assert.equal(values.size, 0);
    fakeWindow.location.hash = "#lms_connect=invalid";
    assert.equal(readBiasLinkHandoff(), null);
    fakeWindow.location.hash = `#lms_connect=${code}`;
    assert.equal(readBiasLinkHandoff(), code);
    clearBiasLinkHandoff();
    assert.equal(readBiasLinkHandoff(), null);
  } finally {
    clearBiasLinkHandoff();
    (globalThis as any).window = originalWindow;
    Date.now = originalNow;
  }
});
