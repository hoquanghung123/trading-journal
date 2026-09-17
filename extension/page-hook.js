(function () {
  if (window.__JOURNAL_TV_CLIP_HOOK__) return;
  window.__JOURNAL_TV_CLIP_HOOK__ = true;

  function emit(text, via) {
    window.postMessage({ source: "JOURNAL_TV_CLIP", text: String(text || ""), via }, "*");
  }

  const origWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async function (text) {
    emit(text, "writeText");
    return origWriteText(text);
  };

  const origWrite = navigator.clipboard.write.bind(navigator.clipboard);
  navigator.clipboard.write = async function (items) {
    try {
      for (const item of items) {
        if (item.types && item.types.includes("text/plain")) {
          const blob = await item.getType("text/plain");
          emit(await blob.text(), "write");
        }
      }
    } catch {
      /* ignore */
    }
    return origWrite(items);
  };

  document.addEventListener(
    "copy",
    (e) => {
      const text = e.clipboardData?.getData("text/plain") || e.clipboardData?.getData("text") || "";
      if (text) emit(text, "copy-event");
    },
    true,
  );
})();
