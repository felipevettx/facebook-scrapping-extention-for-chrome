console.log("Background script loaded");

// Verificar si está logueado en VETTX
function checkIfLoggedIn() {
  chrome.tabs.query({}, (tabs) => {
    const vettxTab = tabs.find((tab) => tab.url && tab.url.includes("vettx.com"));

    if (vettxTab) {
      chrome.scripting.executeScript({
        target: { tabId: vettxTab.id },
        func: () => localStorage.getItem("ba") !== null,
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error("Error ejecutando script:", chrome.runtime.lastError);
          chrome.storage.local.set({ vettxLoggedIn: false });
        } else if (results && results[0]?.result) {
          console.log("Usuario logueado en VETTX.");
          chrome.storage.local.set({ vettxLoggedIn: true });
        } else {
          console.log("Usuario no logueado en VETTX.");
          chrome.storage.local.set({ vettxLoggedIn: false });
        }
      });
    } else {
      console.log("No se encontró una pestaña de VETTX abierta.");
      chrome.storage.local.set({ vettxLoggedIn: false });
    }
  });
}

// Listener para manejar mensajes del popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkLogin") {
    console.log("Verificando login en VETTX...");
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

  return true; // Permite respuestas asíncronas
});

let scrapedData = [];
let isScrapingActive = false;
let activeTabId = null;

// Función para iniciar scraping
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

// Función para detener scraping
function stopScraping() {
  isScrapingActive = false;
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { action: "stopScrape" });
  }
}
