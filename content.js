console.log("Content script Loaded");

let isScrapingActive = false;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in content script:", message);
  if (message.action === "scrape") {
    isScrapingActive = true;
    scrapeMarketplace();
  } else if (message.action === "stopScrape") {
    isScrapingActive = false;
    console.log("Scrapping stopped");
  }
});

function waitForElement(selectors, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function checkElement() {
      if (!isScrapingActive) {
        reject(new Error("Scrapping stopped by the User"));
        return;
      }

      for (let selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Item founded: ${selector}`);
          resolve(elements);
          return;
        }
      }
      
      if (Date.now() - startTime > timeout) {
        console.log(`Timed out. Selectors tested: ${selectors.join(', ')}`);
        reject(new Error(`Items ${selectors.join(', ')} Don't founded of ${timeout}ms`));
      } else {
        setTimeout(checkElement, 500);
      }
    }
    
    checkElement();
  });
}

function extractProductData(productElement) {
  console.log("Extracting product data:", productElement);

  const productId = productElement.href.split("/item/")[1]?.split("/")[0] || "ID don't available";
  
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
  console.log("Starting data extraction from the Marketplace...");

  try {
    await scrollPage();
    console.log("Page scrolled completely");

    if (!isScrapingActive) {
      throw new Error("Scraping is stop by the user");
    }

    const productElements = await waitForElement([
      'a[href^="/marketplace/item/"]'
    ]);

    console.log(`Founded ${productElements.length} product Items`);

    if (productElements.length === 0) {
      throw new Error("Don't found products on the page");
    }

    const products = Array.from(productElements).map(extractProductData);

    console.log(`Data was extracted from ${products.length} products`);
    console.log("Data extracted:", products[0]);

    //Send data to background script
    browser.runtime.sendMessage({ action: "scrapeComplete", payload: products });
  } catch (error) {
    console.error("Error during extraction:", error);
    browser.runtime.sendMessage({ action: "scrapeError", error: error.message });
  }
}