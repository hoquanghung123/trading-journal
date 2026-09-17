function isJournalUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".pages.dev") ||
      host === "trading-journal-3di.pages.dev"
    );
  } catch {
    return false;
  }
}

function notify(message) {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),
      title: "Trading Journal Sync",
      message,
    },
    () => {
      void chrome.runtime.lastError;
    },
  );
}

function executeFallback(tabId, data) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: (payload) => {
          window.postMessage({ source: "JOURNAL_EXTENSION", payload }, "*");
        },
        args: [data],
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      },
    );
  });
}

function forwardToTab(tabId, data) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "FORWARD_TO_JOURNAL", data }, () => {
      if (!chrome.runtime.lastError) {
        resolve();
        return;
      }
      executeFallback(tabId, data).then(resolve).catch(reject);
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FORWARD_TO_JOURNAL") return undefined;

  (async () => {
    const tabs = await chrome.tabs.query({});
    const journalTabs = tabs.filter((t) => isJournalUrl(t.url));

    if (journalTabs.length === 0) {
      notify("Mở tab Journal rồi bấm SYNC lại.");
      sendResponse({ ok: false, error: "Mở tab Journal" });
      return;
    }

    const results = await Promise.allSettled(
      journalTabs.map((tab) => forwardToTab(tab.id, message.data)),
    );
    const ok = results.some((r) => r.status === "fulfilled");
    if (!ok) {
      notify("Journal không nhận được. Reload tab Journal rồi thử lại.");
      sendResponse({ ok: false, error: "Reload tab Journal" });
      return;
    }
    sendResponse({ ok: true });
  })().catch((err) => {
    sendResponse({ ok: false, error: err?.message || "Lỗi extension" });
  });

  return true;
});
