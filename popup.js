console.log("Popup script loaded");

let isScrapingActive = false;

//Facebook login validation.
let loginStatus = false;
chrome.cookies.get(
  { url: "https://www.facebook.com", name: "c_user" },
  (cookie) => {
    console.log("Cookie retrieved:", cookie);
    if (cookie) {
      console.log("User is login on Facebook. ID:", cookie.value);
      loginStatus = true;
      handleLoginSuccess(cookie.value);
      enableScrapeButton();
    } else {
      console.log("User not logged in");
      alert("You must be logged into Facebook");
      notfyUserTologin();
      disableScrapeButton();
    }
  }
);
// if the User is logged, enable Button:
function enableScrapeButton() {
  const scrapeButton = document.getElementById("scrapeButton");
  scrapeButton.disabled = false;
  scrapeButton.style.opacity = "1";
  scrapeButton.title = "";
}

// disabled the Button if the user is not logged:
function disableScrapeButton() {
  const scrapeButton = document.getElementById("scrapeButton");
  scrapeButton.disabled = true;
  scrapeButton.style.opacity = "0.6";
  scrapeButton.title = "Please, Login on facebook for use the extension";
}
// success case of login
function handleLoginSuccess(userId) {
  console.log("UserID:", userId);
}
//Notify the user that they need to log in..

function notfyUserTologin() {
  console.log("please log in to Facebook to use this extension");
  const outputElement = document.getElementById("output");
  outputElement.textContent = "You must be logged into Facebook to use the extension"
}
//validation if the user is logged on vettx


///////// logic for the scraping button
document.getElementById("scrapeButton").addEventListener("click", async () => {
  console.log("Scrape button clicked");

  try {
    if (!isScrapingActive) {
      document.getElementById("output").textContent =
        "Extracting is starting. Please, wait...";
      document.getElementById("scrapeButton").textContent = "Stop Scraping";
      document.getElementById("scrapeButton").classList.add("stop");
      isScrapingActive = true;
      // save the button status
      chrome.storage.local.set({ isScrapingActive: true }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error setting isScrapingActive:",
            chrome.runtime.lastError
          );
        }
      });
      chrome.runtime.sendMessage({ action: "startScraping" }, (response) => {
        if (chrome.runtime.lastError) {
          throw new Error("Background script not responding");
        }
        console.log("Start scraping response:", response);
      });
    } else {
      document.getElementById("output").textContent =
        "Stopping the extraction...";
      document.getElementById("scrapeButton").textContent = "Extract Data";
      document.getElementById("scrapeButton").classList.remove("stop");
      isScrapingActive = false;
      // safe the button status
      chrome.storage.local.set({ isScrapingActive: false }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error setting isScrapingActive:",
            chrome.runtime.lastError
          );
        }
      });
      chrome.runtime.sendMessage({ action: "stopScraping" }, (response) => {
        if (chrome.runtime.lastError) {
          throw new Error("Background script not responding");
        }
        console.log("Stop scraping response:", response);
      });
    }
  } catch (error) {
    console.error("Error starting/stopping the extraction:", error);
    document.getElementById("output").textContent =
      "Error starting/stopping extraction. Make sure you are on a Facebook Marketplace page.";
    document.getElementById("scrapeButton").textContent = "Extract Data";
    document.getElementById("scrapeButton").classList.remove("stop");
    isScrapingActive = false;
    chrome.storage.local.set({ isScrapingActive: false });
  }
});

function displayProductData(products) {
  const outputElement = document.getElementById("output");
  outputElement.innerHTML = "";

  const productList = document.createElement("ul");
  productList.style.listStyleType = "none";
  productList.style.padding = "0";

  products.slice(0, 5).forEach((product) => {
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
    moreInfo.textContent = `... and ${
      products.length - 5
    } more products. Check the console for full data.`;
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
chrome.storage.local.get(["scrapedData", "isScrapingActive"], (result) => {
  if (result.scrapedData && result.scrapedData.length > 0) {
    displayProductData(result.scrapedData);
  }
  if (result.isScrapingActive) {
    document.getElementById("scrapeButton").textContent = "Stop Scraping";
    document.getElementById("scrapeButton").classList.add("stop");
    isScrapingActive = true;
  }
});

//Logic for Vettx authentication

chrome.storage.local.get(['vettxLoggedIn'], function(result) {
  if (result.vettxLoggedIn) {
    console.log('User is logged into vettx');
    // Perform actions for logged-in user
  } else {
    console.log('User is not logged into vettx');
    // Perform actions for logged-out user
  }
});