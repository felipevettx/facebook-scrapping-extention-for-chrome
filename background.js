console.log("Background script loaded");

let scrapedData = [];
let isScrapingActive = false;
let activeTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background script:", message);
  
  if (message.action === "scrapeComplete" || message.action === "scrapePartialComplete") {
    console.log(`Data received from content script: ${message.payload.length} products`);
    scrapedData = message.payload;
    
    chrome.storage.local.set({ scrapedData: scrapedData });
    chrome.runtime.sendMessage({ action: "updatePopup", data: scrapedData });
    
    if (message.action === "scrapeComplete") {
      isScrapingActive = false;
      console.log("Scraping completed. Total products:", scrapedData.length);
    }
  } else if (message.action === "scrapeError") {
    console.error("Error during the extraction:", message.error);
    isScrapingActive = false;
    chrome.runtime.sendMessage({ action: "updatePopup", error: message.error });
  } else if (message.action === "downloadData") {
    if (!scrapedData || scrapedData.length === 0) {
      console.log("There is no data to download");
      return;
    }
    
    const jsonString = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: "facebook_marketplace_data.json",
      saveAs: true
    });
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (message.action === "startScraping") {
    isScrapingActive = true;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        activeTabId = tabs[0].id;
        chrome.tabs.sendMessage(activeTabId, { action: "scrape" });
      } else {
        console.error("No active tab found");
        isScrapingActive = false;
        chrome.runtime.sendMessage({ 
          action: "updatePopup", 
          error: "Error starting extraction: No active tab found" 
        });
      }
    });
  } else if (message.action === "stopScraping") {
    isScrapingActive = false;
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: "stopScrape" });
    }
  }
  
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url.includes('facebook.com/marketplace')) {
    activeTabId = tabId;
  }
});

