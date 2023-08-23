const envVariables = {
  CHROME_EXTENSION_FRONT_URL: 'http://localhost:3000/?vehicle',
};

const getConversation = () => {
  setInterval(() => {
    const elements = document.querySelectorAll('div[role="none"][dir="auto"]');
    const messages = [];
  
    elements.forEach((element) => {
      const classList = element.classList;
      const messageText = element.innerText;
      let messageType = "";
  
      if (classList.contains("x14ctfv")) {
        messageType = "sent";
      } else if (classList.contains("xzsf02u")) {
        messageType = "received";
      }
  
      if (messageType) {
        messages.push({ type: messageType, text: messageText });
      }
    });

    console.log('messages every 30 second::', messages);
  
    chrome.storage.local.get(["senderTab"]).then((result) => {
      const tabId = result.senderTab;
      chrome.runtime.sendMessage({
        type: "activateAndExecuteScript",
        tabId,
        conversation: messages,
      });
    });
  }, 30000);

};

function performOperationsInTab() {
  chrome.storage.local.get(["initialMessage"], function (result) {
    const modalButton = document.querySelector('div[aria-label="Message"][role="button"]');
    if (modalButton) {
      modalButton.click();
      setTimeout(() => {
        const textarea = document.querySelector('textarea[id^=":"]');
        const spans = document.getElementsByTagName("span");
        let firstSpan = null;

        Array.from(spans).forEach(function (span) {
          var spanText = span.textContent;

          if (spanText.includes("Is this still available")) {
            firstSpan = span;
          }
        });

        if (firstSpan) {
          firstSpan.parentElement.parentElement.click();
          setTimeout(() => {
            const modalTextArea = document.querySelector('textarea[id^=":"]');

            function simulateTyping(element, textToType) {
              return new Promise((resolve) => {
                element.focus();
                element.value = textToType;

                const inputEvent = new Event("input", { bubbles: true });
                element.dispatchEvent(inputEvent);

                const changeEvent = new Event("change", { bubbles: true });
                element.dispatchEvent(changeEvent);

                resolve();
              });
            }

            if (modalTextArea) {
              const textToType =
                result.initialMessage ||
                "Is this still available, I'm interested?";
              modalTextArea.value = textToType;

              simulateTyping(modalTextArea, textToType).then(() => {
                const ariaLabel = "Send Message";
                const myButton = document.querySelector(
                  `[aria-label="${ariaLabel}"]`
                );
                myButton.click();
                chrome.storage.local.get(["senderTab"]).then((result) => {
                  const tabId = result.senderTab;
                  const text = modalTextArea.value;
                  chrome.runtime.sendMessage({
                    type: "activateAndExecuteScript",
                    tabId,
                    conversation: [{ text, type: "sent" }],
                    facebookContact: "",
                  });
                });
              });
            }
          }, 1000);
        }
      }, 1000);
    } else {
      setTimeout(() => {
        const sendAgain = document.querySelector(
          'div[aria-label="Message Again"]'
        );
        sendAgain.click();
        setTimeout(() => {
          const focusedElement = document.querySelector(
            'div[aria-label="Message"]'
          );
          focusedElement.focus();
          const textToType = result.initialMessage || "I'm following up this";
          if (
            focusedElement.isContentEditable ||
            focusedElement.tagName === "INPUT" ||
            focusedElement.tagName === "TEXTAREA"
          ) {
            var inputEvent = new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertText",
              data: textToType,
            });

            focusedElement.dispatchEvent(inputEvent);
          }

          setTimeout(() => {
            const sendButton = document.querySelector(
              'div[aria-label="Press Enter to send"]'
            );
            if (sendButton) {
              sendButton.click();
            }

            chrome.storage.local.get(["senderTab"]).then((result) => {
              const tabId = result.senderTab;
              chrome.runtime.sendMessage({
                type: "activateAndExecuteScript",
                tabId,
                conversation: [
                  {
                    type: "sent",
                    text: textToType,
                  },
                ],
              });
            });
          }, 1000);
        }, 3000);
      }, 2000);
    }
  });
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.url.startsWith(envVariables.CHROME_EXTENSION_FRONT_URL)) {
      const data = decodeURIComponent(
        details.url.substring(details.url.indexOf("=") + 1)
      );
      const dataArray = data.split("&");
      const vehicle = dataArray[0]?.replace("vehicle=", "");
      const user = dataArray[1]?.replace("user=", "");
      const message = dataArray[2]?.replace("message=", "");
      const url = dataArray[3]?.replace("url=", "");

      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTabId = tabs[0].id;
        chrome.storage.local.set({ senderTab: currentTabId });
      });

      let tabFound = false;
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.url === url) {
            chrome.tabs.update(tab.id, { active: false }, () => {
              chrome.storage.local.set({
                initialMessage: message,
                vehicle,
                user,
                receiverTab: tab.id
              });

              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: performOperationsInTab,
              });

              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: getConversation,
              });
            });
            tabFound = true;
            break;
          }
        }

        if (!tabFound) {
          chrome.tabs.create({ url, active: false }, (tab) => {
            chrome.storage.local.set({
              initialMessage: message,
              vehicle,
              user
            });

            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
              if (changeInfo.status === "complete" && tabId === tab.id) {
                chrome.storage.local.set({ receiverTab: tabId });

                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  function: performOperationsInTab,
                });

                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  function: getConversation,
                });

                chrome.tabs.onUpdated.removeListener(listener);
              }
            });
          });
        }
      });
    }
  },
  { urls: ["<all_urls>"] }
);


function sendResponseToOrigin(conversation, vehicleId, userId) {
  const button = document.getElementsByClassName(
    "facebook-message-loading-button"
  )[0];
  button.setAttribute("data-conversation", JSON.stringify(conversation));
  button.setAttribute("data-vehicle-id", JSON.stringify(vehicleId));
  button.setAttribute("data-user-id", JSON.stringify(userId));
  button.click();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "activateAndExecuteScript") {
    const tabId = message.tabId;
    const conversation = message.conversation;

    chrome.storage.local.get(['vehicle', 'user']).then((result) => {
      const vehicleId = result.vehicle;
      const userId = result.user;
      chrome.tabs.update(tabId, { }, () => {
        chrome.scripting.executeScript({
          target: { tabId },
          function: sendResponseToOrigin,
          args: [conversation, vehicleId, userId],
        });
      });
    });
  }
  if (message.type === "getCurrentConversation") {
    const tabId = message.tabId;
    chrome.scripting.executeScript({
      target: { tabId },
      function: getConversation,
    });
  }
});
