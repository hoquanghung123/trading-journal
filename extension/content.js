function getSymbol() {
  return (
    document.querySelector('[data-name="legend-item-symbol-name"]')?.innerText ||
    document.querySelector(".title-W_9_V67a")?.innerText ||
    document.title.split(" ")[0].split(":").pop() ||
    "UNKNOWN"
  );
}

/** Do not uppercase first: `1m` is minutes, `1M` is monthly. */
function parseTimeframe(raw) {
  const compact = String(raw || "")
    .trim()
    .replace(/\s+/g, "");
  if (!compact) return "D";
  if (/^(1)?M$/.test(compact) || /^1MO$/i.test(compact) || /^MONTH/i.test(compact)) return "M";
  if (/^(1)?W$/i.test(compact) || /^WEEK/i.test(compact)) return "W";
  if (/^(1)?D$/i.test(compact) || /^DAY/i.test(compact)) return "D";
  if (/^(4H|H4|240|4HOUR)$/i.test(compact)) return "H4";
  return compact;
}

function readIntervalLabel() {
  const selectors = [
    '[data-qa-id="title-wrapper legend-source-interval"] button',
    "#header-toolbar-intervals button",
    '[data-name="legend-source-item"] [class*="interval"]',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.innerText?.trim();
    if (text && text.length < 12) return text;
  }
  return "";
}

function getTimeframe() {
  return parseTimeframe(readIntervalLabel()) || "D";
}

const IDLE_BTN_STYLE =
  "background:#8CC63F; color:white; border:none; border-radius:3px; padding:6px 2px; cursor:pointer; font-weight:bold; font-size:9px; width:22px; height:65px; transition:all 0.2s; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 8px rgba(0,0,0,0.4); text-transform: uppercase; opacity: 0.9;";

let syncing = false;
let restoreTimer = 0;

function parentEl() {
  return document.getElementById("journal-sync-parent");
}

function setStrip(html, title) {
  const mainBtn = parentEl();
  if (!mainBtn) return;
  mainBtn.innerHTML = html;
  mainBtn.title = title || "";
}

function restoreIdle(delayMs) {
  clearTimeout(restoreTimer);
  const mainBtn = parentEl();
  if (!delayMs) {
    if (mainBtn) createButton(mainBtn);
    return;
  }
  restoreTimer = setTimeout(() => {
    const el = parentEl();
    if (el) createButton(el);
  }, delayMs);
}

function showBusy(tf) {
  setStrip(
    `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
    <span style="font-size:10px; color:#8CC63F; font-weight:bold; margin-bottom:2px;">${tf}</span>
    <span style="font-size:7px; color:white; writing-mode:vertical-rl; opacity:0.8;">SYNC...</span>
  </div>`,
    `Đang sync ${tf}`,
  );
}

function showDone() {
  setStrip(
    `<span style="color:#8CC63F; font-size:9px; writing-mode: vertical-rl;">DONE</span>`,
    "Đã gửi vào Journal",
  );
  restoreIdle(2000);
}

function showFail(reason) {
  setStrip(
    `<span style="color:#f87171; font-size:8px; writing-mode: vertical-rl; letter-spacing:1px;">FAIL</span>`,
    reason || "Sync thất bại",
  );
  restoreIdle(3500);
}

function findCopyLinkButton() {
  const nodes = document.querySelectorAll("span, div, button, li, [role='menuitem']");
  return Array.from(nodes).find((el) => {
    if (el.children.length > 2) return false;
    const txt = el.innerText?.toLowerCase().trim() || "";
    if (txt.length > 40) return false;
    return (
      (txt.includes("copy") || txt.includes("sao chép")) &&
      (txt.includes("link") || txt.includes("liên kết"))
    );
  });
}

function waitFor(predicate, { tries, intervalMs }) {
  return new Promise((resolve, reject) => {
    let n = 0;
    let done = false;
    const tick = async () => {
      if (done) return;
      n++;
      try {
        const found = await predicate();
        if (found && !done) {
          done = true;
          clearInterval(id);
          resolve(found);
          return;
        }
      } catch {
        /* keep polling */
      }
      if (n >= tries && !done) {
        done = true;
        clearInterval(id);
        reject(new Error("timeout"));
      }
    };
    const id = setInterval(tick, intervalMs);
    tick();
  });
}

function realClick(el) {
  const opts = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    pointerId: 1,
    pointerType: "mouse",
  };
  el.dispatchEvent(new PointerEvent("pointerdown", opts));
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new PointerEvent("pointerup", opts));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.dispatchEvent(new MouseEvent("click", opts));
  if (typeof el.click === "function") el.click();
}

function pressCopyLinkShortcut() {
  const opts = {
    key: "s",
    code: "KeyS",
    keyCode: 83,
    which: 83,
    altKey: true,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  for (const type of ["keydown", "keyup"]) {
    document.dispatchEvent(new KeyboardEvent(type, opts));
    window.dispatchEvent(new KeyboardEvent(type, opts));
  }
}

function hookClipboardCapture() {
  const captured = { url: "" };
  const onPageClip = (e) => {
    const text = e.data?.text;
    if (e.data?.source !== "JOURNAL_TV_CLIP" || typeof text !== "string") return;
    if (!text.includes("tradingview.com/x/")) return;
    captured.url = text;
  };
  window.addEventListener("message", onPageClip);
  return {
    captured,
    restore() {
      window.removeEventListener("message", onPageClip);
    },
  };
}

function forwardToJournal(data) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "FORWARD_TO_JOURNAL", data }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "Không phản hồi" });
      });
    } catch (err) {
      resolve({ ok: false, error: err?.message || "Gửi message lỗi" });
    }
  });
}

async function syncToJournal() {
  if (syncing) return;
  syncing = true;

  const symbol = getSymbol().replace(/\s/g, "");
  const targetTf = getTimeframe();
  const cameraBtn =
    document.querySelector('[data-name="save-screenshot"]') ||
    document.querySelector("#header-toolbar-screenshot");

  if (!cameraBtn) {
    showFail("Không tìm thấy nút Camera");
    syncing = false;
    return;
  }

  showBusy(targetTf);

  let oldClip = "";
  try {
    oldClip = await navigator.clipboard.readText();
  } catch {
    oldClip = "";
  }

  try {
    await new Promise((r) => setTimeout(r, 300));
    cameraBtn.click();

    let copyLinkBtn;
    try {
      copyLinkBtn = await waitFor(findCopyLinkButton, { tries: 50, intervalMs: 50 });
    } catch {
      showFail("Không tìm thấy Copy link");
      return;
    }

    const clipHook = hookClipboardCapture();
    realClick(copyLinkBtn);
    pressCopyLinkShortcut();
    window.focus();

    let snapshotUrl = "";
    try {
      snapshotUrl = await waitFor(
        () => {
          if (clipHook.captured.url) return clipHook.captured.url;
          return navigator.clipboard
            .readText()
            .then((text) =>
              text.includes("tradingview.com/x/") && text !== oldClip ? text : null,
            )
            .catch(() => null);
        },
        { tries: 60, intervalMs: 300 },
      );
    } catch {
      showFail("Clipboard không có link /x/");
      return;
    } finally {
      clipHook.restore();
    }

    const result = await forwardToJournal({
      url: snapshotUrl,
      asset: symbol,
      timeframe: targetTf,
    });

    if (result?.ok) {
      showDone();
    } else {
      showFail(result?.error || "Journal không nhận");
    }
  } catch (err) {
    showFail(err?.message || "Sync lỗi");
  } finally {
    syncing = false;
  }
}

function createButton(container) {
  container.innerHTML = "";
  container.title = "Sync chart vào Journal (Copy link)";
  const b = document.createElement("button");
  b.innerHTML =
    '<span style="writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 1px;">SYNC</span>';
  b.style.cssText = IDLE_BTN_STYLE;
  b.onmouseover = () => {
    b.style.background = "#7ab337";
    b.style.opacity = "1";
  };
  b.onmouseout = () => {
    b.style.background = "#8CC63F";
    b.style.opacity = "0.9";
  };
  b.onclick = (e) => {
    e.stopPropagation();
    syncToJournal();
  };
  container.appendChild(b);
}

function injectButton() {
  if (document.getElementById("journal-sync-parent") || !document.body) return;
  const parent = document.createElement("div");
  parent.id = "journal-sync-parent";
  parent.style.cssText =
    "position: fixed; right: 0; top: 120px; display: flex; flex-direction: column; align-items: center; background: rgba(0, 0, 0, 0.7); padding: 4px 2px; border-radius: 6px 0 0 6px; z-index: 1000000; border: 1px solid rgba(140, 198, 63, 0.3); border-right: none; backdrop-filter: blur(5px); transition: opacity 0.3s;";
  createButton(parent);
  document.body.appendChild(parent);
}

setInterval(injectButton, 3000);
injectButton();
