document.addEventListener("DOMContentLoaded", function () {
  const myButton = document.getElementById("openVettxAgain");

  myButton.addEventListener("click", function () {
    chrome.storage.local.get(["envVariables"]).then((result) => {
      const envVariables = result.envVariables;
      chrome.tabs.create({ url: envVariables.CHROME_EXTENSION_FRONT_URL });
      window.close();
    });
  });
});
