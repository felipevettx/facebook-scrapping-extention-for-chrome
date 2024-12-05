console.log("Popup script loaded");

let isScrapingActive = false;

document.getElementById("scrapeButton").addEventListener("click", async () => {
  console.log("Scrape button clicked");
  
  try {
    if (!isScrapingActive) {
      document.getElementById("output").textContent = "Extracting is starting. Please, wait...";
      document.getElementById("scrapeButton").textContent = "Stop Scraping";
      document.getElementById("scrapeButton").classList.add("stop");
      isScrapingActive = true;
      chrome.runtime.sendMessage({ action: "startScraping" });
    } else {
      document.getElementById("output").textContent = "Stopping the extraction...";
      document.getElementById("scrapeButton").textContent = "Extract Data";
      document.getElementById("scrapeButton").classList.remove("stop");
      isScrapingActive = false;
      chrome.runtime.sendMessage({ action: "stopScraping" });
    }
  } catch (error) {
    console.error("Error starting/stopping the extraction:", error);
    document.getElementById("output").textContent = "Error starting/stopping extraction. Make sure you are on a Facebook Marketplace page.";
    document.getElementById("scrapeButton").textContent = "Extract Data";
    document.getElementById("scrapeButton").classList.remove("stop");
    isScrapingActive = false;
  }
});

function displayProductData(products) {
  const outputElement = document.getElementById("output");
  outputElement.innerHTML = "";

  const productList = document.createElement("ul");
  productList.style.listStyleType = "none";
  productList.style.padding = "0";

  products.slice(0, 5).forEach(product => {
    const listItem = document.createElement("li");
    listItem.style.marginBottom = "10px";
    listItem.style.borderBottom = "1px solid #ccc";
    listItem.style.paddingBottom = "10px";

    listItem.innerHTML = `
      <strong>ID:</strong> ${product.id}<br>
      <a href="${product.link}" target="_blank">Ver en Facebook</a>
    `;

    productList.appendChild(listItem);
  });

  outputElement.appendChild(productList);

  const totalInfo = document.createElement("p");
  totalInfo.textContent = `Total products scraped: ${products.length}`;
  outputElement.appendChild(totalInfo);

  if (products.length > 5) {
    const moreInfo = document.createElement("p");
    moreInfo.textContent = `... and ${products.length - 5} more products. Check the console for full data.`;
    outputElement.appendChild(moreInfo);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in popup:", message);
  if (message.action === "updatePopup") {
    if (message.error) {
      document.getElementById("output").textContent = `Error: ${message.error}`;
    } else {
      displayProductData(message.data);
    }
    if (message.action !== "scrapePartialComplete") {
      document.getElementById("scrapeButton").textContent = "Extract Data";
      document.getElementById("scrapeButton").classList.remove("stop");
      isScrapingActive = false;
    }
  }
});

// Check if there is data extracted when opening the popup
chrome.storage.local.get("scrapedData", (result) => {
  if (result.scrapedData && result.scrapedData.length > 0) {
    displayProductData(result.scrapedData);
  }
});
