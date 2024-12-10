console.log("Content script Loaded");
//Implementation of logic to determine if the user is logged into Vettx
// Send a message to the background script to check if the user is logged in to VETTX
chrome.runtime.sendMessage({ action: 'checkLogin' }, (response) => {
  console.log("Message sent to the background:", response.status); 
});


let isScrapingActive = false;
let totalProductsScraped = 0;

const SCROLL_INTERVAL = 1500;
const SCROLL_DISTANCE = Math.ceil(window.innerHeight * 0.7);
const LOAD_DELAY = 3000;
const MAX_RETRIES = 5;
const MAX_TIME = 280000;
function waitForPageLoad() {
  return new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      window.addEventListener("load", resolve);
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
        console.log(`Timed out. Selectors tested: ${selectors.join(", ")}`);
        reject(
          new Error(
            `Items ${selectors.join(", ")} not found after ${timeout}ms`
          )
        );
      } else {
        setTimeout(checkElement, 300); //Time interval between checks.
      }
    }

    checkElement();
  });
}

function extractProductData(productElement) {
  const link = productElement.href;
  const productId =
    link.split("/item/")[1]?.split("/")[0] || "ID not available";

  return {
    id: productId,
    link: link,
  };
}

function scrollPage() {
  return new Promise((resolve) => {
    let totalHeight = 0;
    const randomScrollInterval = SCROLL_INTERVAL + Math.random() * 500;
    let timer = setInterval(() => {
      if (!isScrapingActive) {
        console.log(
          `Scroll stopped. actual items: ${totalProductsScraped}`
        );
        clearInterval(timer);
        resolve();
        return;
      }

      let scrollHeight = document.documentElement.scrollHeight;
      window.scrollBy(0, SCROLL_DISTANCE);
      totalHeight += SCROLL_DISTANCE;

      if (totalHeight >= scrollHeight) {
        clearInterval(timer);
        setTimeout(resolve, LOAD_DELAY);
      }
    }, randomScrollInterval);
  });
}

async function scrapeMarketplace() {
  console.log("Waiting for page to load completely...");
  await waitForPageLoad();
  console.log("Page loaded. Starting data extraction from the Marketplace...");
  totalProductsScraped = 0;
  let allProducts = [];
  let retryCount = 0;
  let noNewProductsCount = 0;
  const startTime = Date.now()

  try {
    while (isScrapingActive) {
      //Logic to check if the time limit is exceeded

      if (Date.now() - startTime >= MAX_TIME){
        console.log("TIme limit reached. Stopping scrape");
        break;
      }
      await scrollPage();

      await new Promise((resolve) => setTimeout(resolve, LOAD_DELAY));
      console.log("Page scrolled and waiting for new products to load");

      if (!isScrapingActive) {
        throw new Error("Process stopped by the user");
      }

      try {
        const productElements = await waitForElement([
          'a[href^="/marketplace/item/"]',
        ]);

        console.log(`Found ${productElements.length} product items`);

        if (productElements.length === 0) {
          retryCount++;
          if (retryCount >= MAX_RETRIES) {
            console.log("Max retries reached. Stopping Process.");
            break;
          }
          console.log(`No products found. Retry ${retryCount}/${MAX_RETRIES}`);
          continue;
        }

        retryCount = 0; // Reset retry count on successful find

        const newProducts = Array.from(productElements)
          .map(extractProductData)
          .filter((product) => !allProducts.some((p) => p.id === product.id));

        console.log(`New unique products found: ${newProducts.length}`);

        if (newProducts.length === 0) {
          noNewProductsCount++;
          if (noNewProductsCount >= MAX_RETRIES) {
            console.log(
              "No new products found after multiple attempts. Stopping process."
            );
            break;
          }
          console.log(
            `No new products found. Attempt ${noNewProductsCount}/${MAX_RETRIES}`
          );
          continue;
        }

        noNewProductsCount = 0; // Reset count when new products are found
        allProducts = [...allProducts, ...newProducts];
        totalProductsScraped = allProducts.length;

        console.log(`Total products Founded: ${totalProductsScraped}`);

        // Send partial results to background script
        chrome.runtime.sendMessage({
          action: "scrapePartialComplete",
          payload: allProducts,
        });

        
      } catch (error) {
        console.error("Error during product extraction:", error);
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          console.log("Max retries reached. Stopping scrape.");
          break;
        }
        console.log(`Error occurred. Retry ${retryCount}/${MAX_RETRIES}`);
      }
    }

    console.log(
      `Data extraction completed. Total products Founded: ${totalProductsScraped}`
    );
    if (allProducts.length > 0) {
      console.log("Sample data extracted:", allProducts[0]);
    }

    // Send final results to background script
    chrome.runtime.sendMessage({
      action: "scrapeComplete",
      payload: allProducts,
    });
  } catch (error) {
    console.error("Fatal error during process:", error);
    chrome.runtime.sendMessage({ action: "scrapeError", error: error.message });
  } finally {
    isScrapingActive = false;
  }
}
