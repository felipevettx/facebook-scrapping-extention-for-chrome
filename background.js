console.log("Background script cargado");

let scrapedData = [];

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Mensaje recibido en background script:", message);
  
  if (message.action === "scrapeComplete") {
    console.log(`Datos recibidos del content script: ${message.payload.length} productos`);
    scrapedData = message.payload;
    
    // Store the data in local storage
    browser.storage.local.set({ scrapedData: scrapedData });
    
    // Notify the popup that new data is available
    browser.runtime.sendMessage({ action: "updatePopup", data: scrapedData });
  } else if (message.action === "scrapeError") {
    console.error("Error durante la extracción:", message.error);
    browser.runtime.sendMessage({ action: "updatePopup", error: message.error });
  } else if (message.action === "downloadData") {
    if (!scrapedData || scrapedData.length === 0) {
      console.log("No hay datos para descargar");
      return;
    }
    
    const jsonString = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    browser.downloads.download({
      url: url,
      filename: "facebook_marketplace_data.json",
      saveAs: true
    });
    
    // Clean up the object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  
  return true; // Indicates that the response will be sent asynchronously
});

