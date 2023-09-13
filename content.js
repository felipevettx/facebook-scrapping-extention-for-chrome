document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("toggleVettxSwitch");

  chrome.storage.local.get("enableExtension", (result) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    const storedValue = result.enableExtension;

    const toggleVettxSwitch = document.getElementById("toggleVettxSwitch");
    toggleVettxSwitch.checked = storedValue;

    toggleVettxSwitch.addEventListener("change", function () {
      chrome.storage.local.set({ enableExtension: toggleVettxSwitch.checked });
    });
  });

  toggleSwitch.addEventListener("change", function () {
    const newState = this.checked;
    if (newState) {
      chrome.runtime.sendMessage({ message: "enable-vettx-extension" });
    } else {
      chrome.runtime.sendMessage({ message: "disable-vettx-extension" });
    }
  });
});
