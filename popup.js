console.log("Popup script loaded");

let isScrapingActive = false;

document.getElementById("scrapeButton").addEventListener("click", async () => {
  console.log("Download button clicked");
  
  try {
    if (!isScrapingActive) {
      document.getElementById("output").textContent = "Extracting is starting. Please, wait...";
      document.getElementById("scrapeButton").textContent = "Stop Scraping";
      document.getElementById("scrapeButton").classList.add("stop");
      isScrapingActive = true;
      chrome.runtime.sendMessage({ action: "startScraping" });
    } else {
      document.getElementById("output").textContent = "Stopping the extract...";
      document.getElementById("scrapeButton").textContent = "Extract Data";
      document.getElementById("scrapeButton").classList.remove("stop");
      isScrapingActive = false;
      chrome.runtime.sendMessage({ action: "stopScraping" });
    }
  } catch (error) {
    console.error("Error to starting/stopping the extraction:", error);
    document.getElementById("output").textContent = "Error starting/stopping extraction. Make sure you are on a Facebook Marketplace page.";
    document.getElementById("scrapeButton").textContent = "Extract Data";
    document.getElementById("scrapeButton").classList.remove("stop");
    isScrapingActive = false;
  }
});

document.getElementById("downloadButton").addEventListener("click", () => {
  console.log("Download button clicked");
  chrome.runtime.sendMessage({ action: "downloadData" });
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

  if (products.length > 5) {
    const moreInfo = document.createElement("p");
    moreInfo.textContent = `... y ${products.length - 5} More products. Download the data to see all.`;
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
      document.getElementById("downloadButton").style.display = "block";
    }
    document.getElementById("scrapeButton").textContent = "Extract Data";
    document.getElementById("scrapeButton").classList.remove("stop");
    isScrapingActive = false;
  }
});

// Check if there is data extracted when opening the popup
chrome.storage.local.get("scrapedData", (result) => {
  if (result.scrapedData && result.scrapedData.length > 0) {
    displayProductData(result.scrapedData);
    document.getElementById("downloadButton").style.display = "block";
  }
});