console.log("Popup script loaded");

let isScrapingActive = false;
let isLoggedInFacebook = false;
let isLoggedInVettx = false;

document.addEventListener("DOMContentLoaded", () => {
  // Verify login on VETTX
  chrome.runtime.sendMessage({ action: "checkLogin" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error communicating with the background script:",
        chrome.runtime.lastError
      );
      notifyUser("Error verifying VETTX login.");
      return;
    }
    console.log(response.status);

    // Update login status from chrome.storage.local
    chrome.storage.local.get(["vettxLoggedIn"], (result) => {
      isLoggedInVettx = result.vettxLoggedIn || false;
      updateButtonState();
    });
  });

  // Verify login on Facebook
  chrome.cookies.get(
    { url: "https://www.facebook.com", name: "c_user" },
    (cookie) => {
      if (cookie) {
        console.log("User logged in to Facebook. ID:", cookie.value);
        isLoggedInFacebook = true;
      } else {
        console.log("User not logged in to Facebook.");
        notifyUser("You must be logged into Facebook to use the extension.");
      }
      updateButtonState();
    }
  );

  // Restore the state of scraping when the popup is open
  chrome.storage.local.get(["isScrapingActive"], (result) => {
    isScrapingActive = result.isScrapingActive || false;
    updateButtonState();
  });
});

function updateButtonState() {
  const scrapeButton = document.getElementById("scrapeButton");
  if (isLoggedInFacebook && isLoggedInVettx) {
    enableScrapeButton();
  } else {
    disableScrapeButton();
  }

  if (isScrapingActive) {
    scrapeButton.textContent = "Stop Scraping";
    scrapeButton.classList.add("stop");
  } else {
    scrapeButton.textContent = "Extract Data";
    scrapeButton.classList.remove("stop");
  }
}

function enableScrapeButton() {
  const scrapeButton = document.getElementById("scrapeButton");
  scrapeButton.disabled = false;
  scrapeButton.style.opacity = "1";
  scrapeButton.title = "";
}

function disableScrapeButton() {
  const scrapeButton = document.getElementById("scrapeButton");
  scrapeButton.disabled = true;
  scrapeButton.style.opacity = "0.6";
  scrapeButton.title =
    "Please, login to Facebook and VETTX to use the extension";
}

function notifyUser(message) {
  console.log(message);
  const outputElement = document.getElementById("output");
  outputElement.textContent = message;
}

document.getElementById("scrapeButton").addEventListener("click", () => {
  const scrapeButton = document.getElementById("scrapeButton");

  if (!isScrapingActive) {
    document.getElementById("output").textContent =
      "Starting extraction. Please wait...";
    isScrapingActive = true;
    scrapeButton.textContent = "Stop Scraping";
    scrapeButton.classList.add("stop");
    chrome.runtime.sendMessage({ action: "startScraping" });

    chrome.storage.local.set({ isScrapingActive: true });
  } else {
    document.getElementById("output").textContent = "Stopping extraction...";
    isScrapingActive = false;
    scrapeButton.textContent = "Extract Data";
    scrapeButton.classList.remove("stop");
    chrome.runtime.sendMessage({ action: "stopScraping" });

    chrome.storage.local.set({ isScrapingActive: false });
  }
});

document.getElementById("openTabs").addEventListener("click", () => {
  chrome.runtime.sendMessage(
    {
      action: "openMultipleTabs",
      urls: ["vettx", "facebook"],
    },
    (response) => {
      console.log(response.message);
    }
  );
});
