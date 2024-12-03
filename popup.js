console.log("Popup script cargado");

let isScrapingActive = false;

document.getElementById("scrapeButton").addEventListener("click", async () => {
  console.log("Botón de extracción clickeado");
  
  try {
    if (!isScrapingActive) {
      document.getElementById("output").textContent = "Extracción iniciada. Por favor, espere...";
      document.getElementById("scrapeButton").textContent = "Stop Scraping";
      document.getElementById("scrapeButton").classList.add("stop");
      isScrapingActive = true;
      await browser.runtime.sendMessage({ action: "startScraping" });
    } else {
      document.getElementById("output").textContent = "Deteniendo la extracción...";
      document.getElementById("scrapeButton").textContent = "Extract Data";
      document.getElementById("scrapeButton").classList.remove("stop");
      isScrapingActive = false;
      await browser.runtime.sendMessage({ action: "stopScraping" });
    }
  } catch (error) {
    console.error("Error al iniciar/detener la extracción:", error);
    document.getElementById("output").textContent = "Error al iniciar/detener la extracción. Asegúrese de estar en una página de Facebook Marketplace.";
    document.getElementById("scrapeButton").textContent = "Extract Data";
    document.getElementById("scrapeButton").classList.remove("stop");
    isScrapingActive = false;
  }
});

document.getElementById("downloadButton").addEventListener("click", () => {
  console.log("Botón de descarga clickeado");
  browser.runtime.sendMessage({ action: "downloadData" });
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
    moreInfo.textContent = `... y ${products.length - 5} productos más. Descargue los datos para ver todos.`;
    outputElement.appendChild(moreInfo);
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Mensaje recibido en popup:", message);
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

// Verificar si hay datos extraídos al abrir el popup
browser.storage.local.get("scrapedData", (result) => {
  if (result.scrapedData && result.scrapedData.length > 0) {
    displayProductData(result.scrapedData);
    document.getElementById("downloadButton").style.display = "block";
  }
});