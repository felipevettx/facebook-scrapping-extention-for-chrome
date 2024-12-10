console.log("Background script loaded");

// Check if logged into VETTX
function checkIfLoggedIn() {
  chrome.tabs.query({}, (tabs) => {
    const vettxTab = tabs.find((tab) => tab.url && tab.url.includes("vettx.com"));

    if (vettxTab) {
      chrome.scripting.executeScript({
        target: { tabId: vettxTab.id },
        func: () => localStorage.getItem("ba") !== null,
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Error executing script:", chrome.runtime.lastError);
          chrome.storage.local.set({ vettxLoggedIn: false });
        } else if (results && results[0]?.result) {
          console.log("User logged into VETTX.");
          chrome.storage.local.set({ vettxLoggedIn: true });
        } else {
          console.log("User not logged into VETTX.");
          chrome.storage.local.set({ vettxLoggedIn: false });
        }
      });
    } else {
      console.log("No open VETTX tab found.");
      chrome.storage.local.set({ vettxLoggedIn: false });
    }
  });
}

// Listener to handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkLogin") {
    console.log("Verifying login in VETTX...");
    checkIfLoggedIn();
    sendResponse({ status: "Checking login status" });
  }

  if (message.action === "startScraping") {
    startScraping();
    sendResponse({ status: "Scraping started" });
  }

  if (message.action === "stopScraping") {
    stopScraping();
    sendResponse({ status: "Scraping stopped" });
  }

  return true; 
});

let scrapedData = [];
let isScrapingActive = false;
let activeTabId = null;

// Function to start scraping
function startScraping() {
  isScrapingActive = true;
  scrapedData = [];
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      activeTabId = tabs[0].id;
      chrome.tabs.sendMessage(activeTabId, { action: "scrape" });
    } else {
      console.error("No active tab found");
      isScrapingActive = false;
    }
  });
}

// Function to stop scraping
function stopScraping() {
  isScrapingActive = false;
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { action: "stopScrape" });
  }
}
