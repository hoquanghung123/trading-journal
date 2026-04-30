// Helper to find TradingView symbol
function getSymbol() {
  return (
    document.querySelector('[data-name="legend-item-symbol-name"]')?.innerText ||
    document.querySelector(".title-W_9_V67a")?.innerText ||
    document.title.split(" ")[0].split(":").pop() ||
    "UNKNOWN"
  );
}

// PRECISION timeframe detection
function getTimeframe() {
  const intervalEl = document.querySelector(
    '[data-qa-id="title-wrapper legend-source-interval"] button',
  );
  if (intervalEl) {
    const text = intervalEl.innerText.trim().toUpperCase();
    if (text.includes("M")) return "M";
    if (text.includes("W")) return "W";
    if (text.includes("D")) return "D";
    if (text.match(/4H|240|H4/)) return "H4";
    return text;
  }
  const intervalMenu = document.getElementById("header-toolbar-intervals-menu");
  if (intervalMenu) {
    const text = intervalMenu.innerText.trim().toUpperCase();
    if (text.includes("M")) return "M";
    if (text.includes("W")) return "W";
    if (text.includes("D")) return "D";
    if (text.match(/4H|240|H4/)) return "H4";
  }
  return "D";
}

let lastSyncedUrl = "";

async function syncToJournal() {
  const symbol = getSymbol().replace(/\s/g, "");
  const targetTf = getTimeframe();
  const cameraBtn =
    document.querySelector('[data-name="save-screenshot"]') ||
    document.querySelector("#header-toolbar-screenshot");

  if (!cameraBtn) {
    alert("Không tìm thấy nút Camera!");
    return;
  }

  const mainBtn = document.getElementById("journal-sync-parent");
  mainBtn.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
    <span style="font-size:10px; color:#8CC63F; font-weight:bold; margin-bottom:2px;">${targetTf}</span>
    <span style="font-size:7px; color:white; writing-mode:vertical-rl; opacity:0.8;">SYNC...</span>
  </div>`;

  let oldClip = "";
  try {
    oldClip = await navigator.clipboard.readText();
  } catch (e) {}

  setTimeout(() => {
    cameraBtn.click();
    let attempts = 0;
    const menuInterval = setInterval(async () => {
      const allElements = document.querySelectorAll("*");
      const copyLinkBtn = Array.from(allElements).find((el) => {
        if (el.children.length > 0) return false;
        const txt = el.innerText?.toLowerCase() || "";
        return (
          (txt.includes("copy") || txt.includes("sao chép")) &&
          (txt.includes("link") || txt.includes("liên kết"))
        );
      });

      if (copyLinkBtn) {
        clearInterval(menuInterval);
        const clickable =
          copyLinkBtn.closest("li") || copyLinkBtn.closest('[class*="item"]') || copyLinkBtn;
        clickable.click();

        let clipAttempts = 0;
        const clipInterval = setInterval(async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (text.includes("tradingview.com/x/") && text !== oldClip && text !== lastSyncedUrl) {
              clearInterval(clipInterval);
              lastSyncedUrl = text;
              chrome.runtime.sendMessage({
                type: "FORWARD_TO_JOURNAL",
                data: { url: text, asset: symbol, timeframe: targetTf },
              });
              mainBtn.innerHTML = `<span style="color:#8CC63F; font-size:9px; writing-mode: vertical-rl;">DONE</span>`;
              setTimeout(() => {
                createButton(mainBtn);
              }, 2000);
            }
          } catch (err) {}
          clipAttempts++;
          if (clipAttempts > 60) {
            clearInterval(clipInterval);
            createButton(mainBtn);
          }
        }, 300);
      }
      attempts++;
      if (attempts > 50) {
        clearInterval(menuInterval);
        createButton(mainBtn);
      }
    }, 50);
  }, 300);
}

function createButton(container) {
  container.innerHTML = "";
  const b = document.createElement("button");
  // Even more compact text
  b.innerHTML =
    '<span style="writing-mode: vertical-rl; text-orientation: mixed; letter-spacing: 1px;">SYNC</span>';
  b.style.cssText =
    "background:#8CC63F; color:white; border:none; border-radius:3px; padding:6px 2px; cursor:pointer; font-weight:bold; font-size:9px; width:22px; height:65px; transition:all 0.2s; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 8px rgba(0,0,0,0.4); text-transform: uppercase; opacity: 0.9;";
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
  if (document.getElementById("journal-sync-parent")) return;
  const parent = document.createElement("div");
  parent.id = "journal-sync-parent";
  // Positioned high up, and very slim
  parent.style.cssText =
    "position: fixed; right: 0; top: 120px; display: flex; flex-direction: column; align-items: center; background: rgba(0, 0, 0, 0.7); padding: 4px 2px; border-radius: 6px 0 0 6px; z-index: 1000000; border: 1px solid rgba(140, 198, 63, 0.3); border-right: none; backdrop-filter: blur(5px); transition: opacity 0.3s;";
  createButton(parent);
  document.body.appendChild(parent);
}

setInterval(injectButton, 3000);
injectButton();
