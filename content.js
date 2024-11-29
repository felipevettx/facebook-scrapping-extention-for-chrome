console.log("Content script cargado");

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Mensaje recibido en content script:", message);
  if (message.action === "scrape") {
    scrapeMarketplace();
  }
});

function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkElement() {
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

  // Extraer el ID del producto del enlace
  const productId = productElement.href.split("/item/")[1]?.split("/")[0] || "ID no disponible";
  
  // Extraer precio - usando el selector específico para el precio
  const priceElement = productElement.querySelector('span[class*="x193iq5w"][class*="xeuugli"][class*="x13faqbe"]:first-child');
  let price = priceElement ? priceElement.textContent.trim().replace('$', '').replace(',', '') : 'Precio no disponible';
  
  // Extraer título y año
  const titleElement = productElement.querySelector('span[class*="x1lliihq x6ikm8r x10wlt62 x1n2onr6"]');
  let title = 'Título no disponible';
  let year = 'Año no disponible';
  
  if (titleElement) {
    const fullTitle = titleElement.textContent.trim();
    const yearMatch = fullTitle.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      year = yearMatch[0];
      title = fullTitle.replace(year, '').trim();
    } else {
      title = fullTitle;
    }
  }

  // Extraer ubicación
  const locationElement = productElement.querySelector('span[class*="x1lliihq x6ikm8r x10wlt62 x1n2onr6 xlyipyv xuxw1ft"]');
  
  // Extraer imagen
  const imageElement = productElement.querySelector('img[class*="xt7dq6l"]');

  return {
    id: productId,
    title: title,
    year: year,
    price: price,
    location: locationElement ? locationElement.textContent.trim() : 'Ubicación no disponible',
    imageUrl: imageElement ? imageElement.src : '',
    link: productElement.href
  };
}

function scrollPage() {
  return new Promise((resolve) => {
    let totalHeight = 0;
    let distance = 300;
    let timer = setInterval(() => {
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

// Ejecutar scrapeMarketplace automáticamente cuando se carga la página
window.addEventListener('load', () => {
  console.log("Página cargada, iniciando extracción automática");
  setTimeout(scrapeMarketplace, 5000); // Esperar 5 segundos antes de iniciar la extracción
});

