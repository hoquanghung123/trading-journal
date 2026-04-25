// Silent bridge - Robust version
function setupBridge() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SYNC_TO_JOURNAL") {
      // Forward to the React app via postMessage
      window.postMessage({
        source: 'JOURNAL_EXTENSION',
        payload: message.data
      }, "*");
      
      if (sendResponse) sendResponse({ success: true });
    }
    return true;
  });
  console.log("Journal Bridge Initialized Silently");
}

// Ensure we don't fail if document.body is missing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBridge);
} else {
  setupBridge();
}
