console.log("Background script loaded");
//auth in vettx
function checkVettxLogin() {
  console.log("Checking vettx login...");
  chrome.tabs.query({ url: ["*://*.vettx.com/*", "*://vettx.com/*"] }, (tabs) => {
    console.log("Vettx tabs found:", tabs.length);
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "checkVettxLogin" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message:", chrome.runtime.lastError);
          return;
        }
        if (response && response.isLoggedIn) {
          console.log('Usuario logueado en vettx');
          chrome.storage.local.set({ vettxLoggedIn: true });
        } else {
          console.log('Usuario no logueado en vettx');
          chrome.storage.local.set({ vettxLoggedIn: false });
        }
      });
    } else {
      console.log('No se encontró una pestaña abierta de vettx');
      chrome.storage.local.set({ vettxLoggedIn: false });
    }
  });
}

// Verificar el login de vettx cuando se actualiza una pestaña
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url.includes('facebook.com')) {
      console.log("Facebook tab updated, checking vettx login");
      checkVettxLogin();
    } else if (tab.url.includes('vettx.com')) {
      console.log("Vettx tab updated, checking login");
      checkVettxLogin();
    }
  }
});

// Verificar el login de vettx periódicamente
setInterval(checkVettxLogin, 60000); // Verifica cada minuto

// acá acaba la logica de auth vettx 
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

    // Mostrar un resumen detallado en la consola
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



