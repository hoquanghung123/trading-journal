chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "FORWARD_TO_JOURNAL") return undefined;
  window.postMessage(
    {
      source: "JOURNAL_EXTENSION",
      payload: message.data,
    },
    "*",
  );
  sendResponse({ ok: true });
  return true;
});
