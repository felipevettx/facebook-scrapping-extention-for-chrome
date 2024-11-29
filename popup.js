console.log("Popup script cargado");

document.getElementById("scrapeButton").addEventListener("click", async () => {
  console.log("Botón de extracción clickeado");
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  
  try {
    document.getElementById("output").textContent = "Extracción iniciada. Por favor, espere...";
    document.getElementById("scrapeButton").disabled = true;
    await browser.tabs.sendMessage(tab.id, { action: "scrape" });
  } catch (error) {
    console.error("Error al iniciar la extracción:", error);
    document.getElementById("output").textContent = "Error al iniciar la extracción. Asegúrese de estar en una página de Facebook Marketplace.";
    document.getElementById("scrapeButton").disabled = false;
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
      <strong>Título:</strong> ${product.title}<br>
      <strong>Precio:</strong> ${product.price}<br>
      <strong>Ubicación:</strong> ${product.location}<br>
      <strong>Descripción:</strong> ${product.description}<br>
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
    document.getElementById("scrapeButton").disabled = false;
  }
});

// Verificar si hay datos extraídos al abrir el popup
browser.storage.local.get("scrapedData", (result) => {
  if (result.scrapedData && result.scrapedData.length > 0) {
    displayProductData(result.scrapedData);
    document.getElementById("downloadButton").style.display = "block";
  }
});

