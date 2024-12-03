console.log("Content script cargado");

let isScrapingActive = false;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Mensaje recibido en content script:", message);
  if (message.action === "scrape") {
    isScrapingActive = true;
    scrapeMarketplace();
  } else if (message.action === "stopScrape") {
    isScrapingActive = false;
    console.log("Scraping detenido");
  }
});

function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkElement() {
      if (!isScrapingActive) {
        reject(new Error("Scraping detenido por el usuario"));
        return;
      }

      for (let selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Elemento encontrado: ${selector}`);
          resolve(elements);
          return;
        }
      }
      
      if (Date.now() - startTime > timeout) {
        console.log(`Tiempo de espera agotado. Selectores probados: ${selectors.join(', ')}`);
        reject(new Error(`Elementos ${selectors.join(', ')} no encontrados después de ${timeout}ms`));
      } else {
        setTimeout(checkElement, 500);
      }
    }
    
    checkElement();
  });
}

function extractProductData(productElement) {
  console.log("Extrayendo datos de producto:", productElement);

  const productId = productElement.href.split("/item/")[1]?.split("/")[0] || "ID no disponible";
  
  return {
    id: productId,
    link: productElement.href,
  };
}

function scrollPage() {
  return new Promise((resolve) => {
    let totalHeight = 0;
    let distance = 300;
    let timer = setInterval(() => {
      if (!isScrapingActive) {
        clearInterval(timer);
        resolve();
        return;
      }

      let scrollHeight = document.documentElement.scrollHeight;
      window.scrollBy(0, distance);
      totalHeight += distance;

      if(totalHeight >= scrollHeight){
        clearInterval(timer);
        resolve();
      }
    }, 200);
  });
}

async function scrapeMarketplace() {
  console.log("Iniciando extracción de datos del Marketplace...");

  try {
    await scrollPage();
    console.log("Página desplazada completamente");

    if (!isScrapingActive) {
      throw new Error("Scraping detenido por el usuario");
    }

    const productElements = await waitForElement([
      'a[href^="/marketplace/item/"]'
    ]);

    console.log(`Encontrados ${productElements.length} elementos de producto`);

    if (productElements.length === 0) {
      throw new Error("No se encontraron productos en la página");
    }

    const products = Array.from(productElements).map(extractProductData);

    console.log(`Se extrajeron datos de ${products.length} productos`);
    console.log("Muestra de datos extraídos:", products[0]);

    // Enviar los datos al background script
    browser.runtime.sendMessage({ action: "scrapeComplete", payload: products });
  } catch (error) {
    console.error("Error durante la extracción:", error);
    browser.runtime.sendMessage({ action: "scrapeError", error: error.message });
  }
}