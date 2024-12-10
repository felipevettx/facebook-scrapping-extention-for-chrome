console.log("Popup script loaded");

let isScrapingActive = false;
let isLoggedInFacebook = false;
let isLoggedInVettx = false;

document.addEventListener("DOMContentLoaded", () => {
  // Verificar login en VETTX
  chrome.runtime.sendMessage({ action: "checkLogin" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error comunicando con el background script:", chrome.runtime.lastError);
      notifyUser("Error verifying VETTX login.");
      return;
    }
    console.log(response.status);

    // Actualizar estado de login desde chrome.storage.local
    chrome.storage.local.get(["vettxLoggedIn"], (result) => {
      isLoggedInVettx = result.vettxLoggedIn || false;
      updateButtonState();
    });
  });

  // Verificar login en Facebook
  chrome.cookies.get({ url: "https://www.facebook.com", name: "c_user" }, (cookie) => {
    if (cookie) {
      console.log("Usuario logueado en Facebook. ID:", cookie.value);
      isLoggedInFacebook = true;
    } else {
      console.log("Usuario no logueado en Facebook.");
      notifyUser("You must be logged into Facebook to use the extension.");
    }
    updateButtonState();
  });

  // Restaurar estado del scraping al abrir el popup
  chrome.storage.local.get(["isScrapingActive"], (result) => {
    isScrapingActive = result.isScrapingActive || false;
    updateButtonState();
  });
});

// Actualizar estado del botón
function updateButtonState() {
  const scrapeButton = document.getElementById("scrapeButton");
  if (isLoggedInFacebook && isLoggedInVettx) {
    enableScrapeButton();
  } else {
    disableScrapeButton();
  }

  if (isScrapingActive) {
    // Si el scraping está activo, cambiar el texto del botón y agregar la clase 'stop'
    scrapeButton.textContent = "Stop Scraping";
    scrapeButton.classList.add("stop");
  } else {
    // Si no está activo, dejar el texto como "Extract Data" y remover la clase 'stop'
    scrapeButton.textContent = "Extract Data";
    scrapeButton.classList.remove("stop");
  }
}

// Habilitar botón
function enableScrapeButton() {
  const scrapeButton = document.getElementById("scrapeButton");
  scrapeButton.disabled = false;
  scrapeButton.style.opacity = "1";
  scrapeButton.title = "";
}

// Deshabilitar botón
function disableScrapeButton() {
  const scrapeButton = document.getElementById("scrapeButton");
  scrapeButton.disabled = true;
  scrapeButton.style.opacity = "0.6";
  scrapeButton.title = "Please, login to Facebook and VETTX to use the extension";
}

// Mostrar notificaciones al usuario
function notifyUser(message) {
  console.log(message);
  const outputElement = document.getElementById("output");
  outputElement.textContent = message;
}

// Lógica del botón de scraping
document.getElementById("scrapeButton").addEventListener("click", () => {
  const scrapeButton = document.getElementById("scrapeButton");

  if (!isScrapingActive) {
    document.getElementById("output").textContent = "Starting extraction. Please wait...";
    isScrapingActive = true;
    scrapeButton.textContent = "Stop Scraping";
    scrapeButton.classList.add("stop"); // Agregar la clase 'stop' cuando comienza el scraping
    chrome.runtime.sendMessage({ action: "startScraping" });
    
    // Guardar estado de scraping
    chrome.storage.local.set({ isScrapingActive: true });
  } else {
    document.getElementById("output").textContent = "Stopping extraction...";
    isScrapingActive = false;
    scrapeButton.textContent = "Extract Data";
    scrapeButton.classList.remove("stop"); // Remover la clase 'stop' cuando se detiene el scraping
    chrome.runtime.sendMessage({ action: "stopScraping" });

    // Guardar estado de scraping
    chrome.storage.local.set({ isScrapingActive: false });
  }
});
