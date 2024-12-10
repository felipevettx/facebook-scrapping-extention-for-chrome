console.log("Background script loaded");
//auth in vettx
let vettxTabId = null
function checkVettxLogin(retries = 3) {
  console.log("Checking vettx login...");
  chrome.tabs.query({ url: ["*://*.vettx.com/*", "*://vettx.com/*"] }, (tabs) => {
    console.log("Vettx tabs found:", tabs.length);
    if (tabs.length > 0) {
      vettxTabId = tabs[0].id;
      sendCheckLoginMessage(retries);
    } else {
      console.log('No open Vettx tab was found');
      chrome.storage.local.set({ vettxLoggedIn: false });
    }
  });
}

function sendCheckLoginMessage(retriesLeft) {
  chrome.tabs.sendMessage(vettxTabId, { action: "checkVettxLogin" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError);
      if (retriesLeft > 0) {
        console.log(`Retrying... (${retriesLeft} attempts left)`);
        setTimeout(() => sendCheckLoginMessage(retriesLeft - 1), 1000);
      } else {
        console.log("Max retries reached. Unable to check vettx login.");
        chrome.storage.local.set({ vettxLoggedIn: false });
      }
      return;
    }
    if (response && response.isLoggedIn) {
      console.log('User logged into Vettx');
      chrome.storage.local.set({ vettxLoggedIn: true });
    } else {
      console.log('User not logged into Vettx');
      chrome.storage.local.set({ vettxLoggedIn: false });
    }
  });
}

// Listen for when the content script is ready.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "contentScriptReady" && sender.tab.url.includes('vettx.com')) {
    console.log("Vettx content script is ready");
    vettxTabId = sender.tab.id;
    checkVettxLogin();
  }
});

// Check the Vettx login status when a tab is updated.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url.includes('facebook.com')) {
      console.log("Facebook tab updated, checking vettx login");
      checkVettxLogin();
    } else if (tab.url.includes('vettx.com')) {
      console.log("Vettx tab updated, checking login");
      vettxTabId = tabId;
      //Wait to ensure the content script has loaded.
      setTimeout(checkVettxLogin, 1000);
    }
  }
});

// Check the Vettx login status periodically
setInterval(checkVettxLogin, 60000);


let scrapedData = [];
let isScrapingActive = false;
let activeTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background script:", message);

  if (message.action === "scrapeComplete" || message.action === "scrapePartialComplete") {
    console.log(`Data received from content script: ${message.payload.length} products`);
    
    // Combine new data with existing data
    scrapedData = [...scrapedData, ...message.payload.filter(product => 
      !scrapedData.some(p => p.id === product.id)
    )];

    chrome.storage.local.set({ scrapedData: scrapedData });
    chrome.runtime.sendMessage({ action: "updatePopup", data: scrapedData });

    // Show a detailed summary in the console.
    console.log("Scraped data summary:");
    console.log(`Total products scraped: ${scrapedData.length}`);
    console.log("Sample product:");
    console.log(JSON.stringify(scrapedData[0], null, 2));
    console.log("Full JSON data:");
    console.log(JSON.stringify(scrapedData, null, 2));

    if (message.action === "scrapeComplete") {
      isScrapingActive = false;
      console.log("Scraping completed. Final count of products scraped:", scrapedData.length);
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: "stopScrape" });
      }
    }
  } else if (message.action === "scrapeError") {
    console.error("Error during the extraction:", message.error);
    isScrapingActive = false;
    chrome.runtime.sendMessage({ action: "updatePopup", error: message.error });
  } else if (message.action === "startScraping") {
    isScrapingActive = true;
    scrapedData = []; // Reset scraped data when starting a new scrape
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


