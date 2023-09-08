document.addEventListener("DOMContentLoaded", function () {
  const toggleSwitch = document.getElementById("toggleVettxSwitch");

  toggleSwitch.addEventListener("change", function () {
    const newState = this.checked;
    if(newState) {
        chrome.runtime.sendMessage({ message: "enable-vettx-extension"});
    } else {
        chrome.runtime.sendMessage({ message: "disable-vettx-extension" });
    }
  });
});
