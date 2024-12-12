console.log("Background script loaded");

//check if the VETTX and Facebook page is open
const urlPage = {
  facebook:
    "https://www.facebook.com/marketplace/105496622817769/cars?minPrice=5000&maxPrice=26000&maxMileage=130000&maxYear=2021&minYear=2014&sortBy=creation_time_descend&exact=true&topLevelVehicleType=car_truck",
  vettx: "https://app.vettx.com/dashboard",
};
function openTabs(url, options = {}) {
  chrome.tabs.query({}, (tabs) => {
    const targetTab = tabs.find((tab) => tab.url && tab.url.includes(url));

    if (targetTab) {
      console.log(`Page found: ${targetTab.url}. Activating...`);
      chrome.tabs.update(targetTab.id, { active: true });
    } else {
      console.log(`Page not found, opening new tab: ${url}`);
      if (options.newWindow) {
        chrome.windows.create({ url: url });
      } else {
        chrome.tabs.create({ url: url });
      }
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openMultipleTabs") {
    const urls = message.urls.map((key) => urlPage[key]).filter(Boolean);
    if (urls.length > 0) {
      urls.forEach((url) => openTabs(url));
      sendResponse({ message: "Opening all specified tabs." });
    } else {
      sendResponse({ message: "No valid URLs found to open" });
    }
  }
});
// logic for open facebook and VETTX tabs when the user make click on the extension icon:
// chrome.action.onClicked.addListener((tab) => {
//   console.log("Extension icon clicked. Opening Facebook and VETTX.");

//   // Set a timeout to open the tabs after 6 seconds
//   setTimeout(() => {
//     const urls = Object.values(urlPage); // Get all the URLs in the `urlPage` object

//     // Open all specified pages after the delay
//     urls.forEach((url) => openTabs(url));
//   }, 2000); // 6000 milliseconds = 6 seconds
// });

// function openTabs(url) {
//   chrome.tabs.create({ url });
// }
chrome.action.onClicked.addListener(() => {
  console.log("Icono de la extensión clickeado.");

  chrome.tabs.create({ url: "https://www.facebook.com/marketplace/105496622817769/cars?minPrice=5000&maxPrice=26000&maxMileage=130000&maxYear=2021&minYear=2014&sortBy=creation_time_descend&exact=true&topLevelVehicleType=car_truck" });
  chrome.tabs.create({ url: "https://app.vettx.com/dashboard" });
});
// Check if logged into VETTX
function checkIfLoggedIn() {
  chrome.tabs.query({}, (tabs) => {
    const vettxTab = tabs.find(
      (tab) => tab.url && tab.url.includes("vettx.com")
    );

    if (vettxTab) {
      chrome.scripting.executeScript(
        {
          target: { tabId: vettxTab.id },
          func: () => localStorage.getItem("ba") !== null,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error("Error executing script:", chrome.runtime.lastError);
            chrome.storage.local.set({ vettxLoggedIn: false });
          } else if (results && results[0]?.result) {
            console.log("User logged into VETTX.");
            chrome.storage.local.set({ vettxLoggedIn: true });
          } else {
            console.log("User not logged into VETTX.");
            chrome.storage.local.set({ vettxLoggedIn: false });
          }
        }
      );
    } else {
      console.log("No open VETTX tab found.");
      chrome.storage.local.set({ vettxLoggedIn: false });
    }
  });
}

// Listener to handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkLogin") {
    console.log("Verifying login in VETTX...");
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

  return true;
});

let scrapedData = [];
let isScrapingActive = false;
let activeTabId = null;

// Function to start scraping
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

// Function to stop scraping
function stopScraping() {
  isScrapingActive = false;
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { action: "stopScrape" });
  }
}
