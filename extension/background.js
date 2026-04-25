chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FORWARD_TO_JOURNAL") {
    console.log("Forwarding to journal:", message.data);
    
    // Search for the journal tab in both Production and Localhost
    chrome.tabs.query({}, (tabs) => {
      const journalTab = tabs.find(t => 
        t.url && (
          t.url.includes("trading-journal-3di.pages.dev") || 
          t.url.includes("localhost:8080")
        )
      );

      if (journalTab) {
        console.log("Found journal tab, injecting script...");
        // Use direct execution to bypass any listener issues
        chrome.scripting.executeScript({
          target: { tabId: journalTab.id },
          func: (data) => {
            console.log("Injected script receiving data:", data);
            window.postMessage({ type: "SYNC_TRADE_IMAGE", data: data }, "*");
          },
          args: [message.data]
        });
      } else {
        console.error("Journal tab not found!");
      }
    });
  }
});
