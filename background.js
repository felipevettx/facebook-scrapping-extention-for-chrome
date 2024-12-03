console.log("Background script cargado");

let scrapedData = [];
let isScrapingActive = false;
let activeTabId = null;

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Mensaje recibido en background script:", message);
  
  if (message.action === "scrapeComplete") {
    console.log(`Datos recibidos del content script: ${message.payload.length} productos`);
    scrapedData = message.payload;
    isScrapingActive = false;
    
    await browser.storage.local.set({ scrapedData: scrapedData });
    browser.runtime.sendMessage({ action: "updatePopup", data: scrapedData });
  } else if (message.action === "scrapeError") {
    console.error("Error durante la extracción:", message.error);
    isScrapingActive = false;
    browser.runtime.sendMessage({ action: "updatePopup", error: message.error });
  } else if (message.action === "downloadData") {
    if (!scrapedData || scrapedData.length === 0) {
      console.log("No hay datos para descargar");
      return;
    }
    
    const jsonString = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    await browser.downloads.download({
      url: url,
      filename: "facebook_marketplace_data.json",
      saveAs: true
    });
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (message.action === "startScraping") {
    isScrapingActive = true;
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        activeTabId = tab.id;
        await browser.tabs.sendMessage(activeTabId, { action: "scrape" });
      } else {
        throw new Error("No active tab found");
      }
    } catch (error) {
      console.error("Error al iniciar scraping:", error);
      isScrapingActive = false;
      browser.runtime.sendMessage({ 
        action: "updatePopup", 
        error: "Error al iniciar la extracción: " + error.message 
      });
    }
  } else if (message.action === "stopScraping") {
    isScrapingActive = false;
    if (activeTabId) {
      try {
        await browser.tabs.sendMessage(activeTabId, { action: "stopScrape" });
      } catch (error) {
        console.error("Error al detener scraping:", error);
      }
    }
  }
  
  return true;
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url.includes('facebook.com/marketplace')) {
    activeTabId = tabId;
  }
});