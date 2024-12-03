console.log("Content script Loaded");

let isScrapingActive = false;
let totalProductsScraped = 0;
const MAX_PRODUCTS = 1000;
const SCROLL_INTERVAL = 1000; // intervalo del scroll
const SCROLL_DISTANCE = 300; // maneja el desplazamiento en px 
const LOAD_DELAY = 3000; // Aumentado a 3 segundos
const MAX_RETRIES = 5; // Número máximo de reintentos

function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);
  if (message.action === "scrape") {
    isScrapingActive = true;
    scrapeMarketplace();
  } else if (message.action === "stopScrape") {
    isScrapingActive = false;
    console.log("Scraping stopped");
  }
});

function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkElement() {
      if (!isScrapingActive) {
        reject(new Error("Scraping stopped by the User"));
        return;
      }

      for (let selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Items found: ${selector}, count: ${elements.length}`);
          resolve(elements);
          return;
        }
      }
      
      if (Date.now() - startTime > timeout) {
        console.log(`Timed out. Selectors tested: ${selectors.join(', ')}`);
        reject(new Error(`Items ${selectors.join(', ')} not found after ${timeout}ms`));
      } else {
        setTimeout(checkElement, 500);
      }
    }
    
    checkElement();
  });
}

function extractProductData(productElement) {
  console.log("Extracting product data:", productElement);

  const productId = productElement.href.split("/item/")[1]?.split("/")[0] || "ID not available";
  
  return {
    id: productId,
    link: productElement.href,
  };
}

function scrollPage() {
  return new Promise((resolve) => {
    let totalHeight = 0;
    let timer = setInterval(() => {
      if (!isScrapingActive) {
        clearInterval(timer);
        resolve();
        return;
      }

      let scrollHeight = document.documentElement.scrollHeight;
      window.scrollBy(0, SCROLL_DISTANCE);
      totalHeight += SCROLL_DISTANCE;

      if(totalHeight >= scrollHeight){
        clearInterval(timer);
        setTimeout(resolve, LOAD_DELAY);
      }
    }, SCROLL_INTERVAL);
  });
}

async function scrapeMarketplace() {
  console.log("Waiting for page to load completely...");
  await waitForPageLoad();
  console.log("Page loaded. Starting data extraction from the Marketplace...");
  totalProductsScraped = 0;
  let allProducts = [];
  let retryCount = 0;

  try {
    while (isScrapingActive && totalProductsScraped < MAX_PRODUCTS) {
      await scrollPage();
      await new Promise(resolve => setTimeout(resolve, LOAD_DELAY));
      console.log("Page scrolled and waiting for new products to load");

      if (!isScrapingActive) {
        throw new Error("Scraping stopped by the user");
      }

      try {
        const productElements = await waitForElement([
          'a[href^="/marketplace/item/"]'
        ]);

        console.log(`Found ${productElements.length} product items`);

        if (productElements.length === 0) {
          if (retryCount >= MAX_RETRIES) {
            console.log("Max retries reached. Stopping scrape.");
            break;
          }
          retryCount++;
          console.log(`No products found. Retry ${retryCount}/${MAX_RETRIES}`);
          continue;
        }

        retryCount = 0; // Reset retry count on successful find

        const newProducts = Array.from(productElements)
          .map(extractProductData)
          .filter(product => !allProducts.some(p => p.id === product.id));

        console.log(`New unique products found: ${newProducts.length}`);

        if (newProducts.length === 0) {
          if (retryCount >= MAX_RETRIES) {
            console.log("Max retries reached. Stopping scrape.");
            break;
          }
          retryCount++;
          console.log(`No new products found. Retry ${retryCount}/${MAX_RETRIES}`);
          continue;
        }

        allProducts = [...allProducts, ...newProducts];
        totalProductsScraped = allProducts.length;

        console.log(`Total products scraped: ${totalProductsScraped}`);

        // Send partial results to background script
        chrome.runtime.sendMessage({ 
          action: "scrapePartialComplete", 
          payload: allProducts 
        });

        if (totalProductsScraped >= MAX_PRODUCTS) {
          console.log(`Reached maximum number of products (${MAX_PRODUCTS}). Stopping scrape.`);
          break;
        }
      } catch (error) {
        console.error("Error during product extraction:", error);
        if (retryCount >= MAX_RETRIES) {
          console.log("Max retries reached. Stopping scrape.");
          break;
        }
        retryCount++;
        console.log(`Error occurred. Retry ${retryCount}/${MAX_RETRIES}`);
      }
    }

    console.log(`Data extracted from ${totalProductsScraped} products`);
    if (allProducts.length > 0) {
      console.log("Sample data extracted:", allProducts[0]);
    }

    // Send final results to background script
    chrome.runtime.sendMessage({ action: "scrapeComplete", payload: allProducts });
  } catch (error) {
    console.error("Fatal error during extraction:", error);
    chrome.runtime.sendMessage({ action: "scrapeError", error: error.message });
  }
}

