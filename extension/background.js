chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FORWARD_TO_JOURNAL") {
    console.log("Forwarding to journal:", message.data);

    // Search for all possible journal tabs
    chrome.tabs.query({}, (tabs) => {
      const journalTabs = tabs.filter(
        (t) =>
          t.url &&
          (t.url.includes("trading-journal-3di.pages.dev") ||
            t.url.includes("localhost:8080") ||
            t.url.includes("127.0.0.1")),
      );

      if (journalTabs.length > 0) {
        journalTabs.forEach((tab) => {
          console.log("Injecting SYNC into tab:", tab.url);
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (data) => {
              // MATCH THE FORMAT EXPECTED BY __root.tsx
              window.postMessage(
                {
                  source: "JOURNAL_EXTENSION",
                  payload: data,
                },
                "*",
              );
            },
            args: [message.data],
          });
        });
      } else {
        console.error("No journal tabs found to receive data!");
      }
    });
  }
});
