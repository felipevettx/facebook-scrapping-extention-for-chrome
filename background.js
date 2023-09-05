const envVariables = {
  CHROME_EXTENSION_FRONT_URL: "http://localhost:3000/",
  MESSENGER_MARKETPLACE: "https://www.messenger.com/marketplace/",
  // Dev url CHROME_EXTENSION_FRONT_URL: 'https://app-dev.vettx.com/?vehicle',
};

const checkNewMessages = async () => {
  console.log('checking new messages');
  const newMessages = document.querySelectorAll('[aria-label^="Mark as read"]');
  const newMessagesReferences = [];

  newMessages.forEach((element) => {
    newMessagesReferences.push(
      element.closest('a[role="link"].x1i10hfl.x1qjc9v5.xjqpnuy.xa49m3k')
    );
  });

  let currentConversations = [];
  let index = 0;

  const intervalId = setInterval(() => {
    if (index >= newMessagesReferences.length) {
      clearInterval(intervalId);
      chrome.storage.local.get(["senderTab"]).then((result) => {
        const tabId = result.senderTab;

        chrome.runtime.sendMessage({
          type: "saveAllConversations",
          tabId,
          conversation: currentConversations,
        });
      });
      return;
    }

    const el = newMessagesReferences[index];

    if (!el.href.startsWith("https://www.facebook.com/marketplace/item")) {
      el.click();
    }

    setTimeout(() => {
      const facebookLinkElement = document.querySelector(
        'a[role="link"].x1i10hfl.x1qjc9v5.xjqpnuy.xa49m3k[href^="https://www.facebook.com/marketplace/item"]'
      );

      let facebookConversation = {};
      let mpID = null;
      const title = el.querySelector(
        "span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft"
      );

      if (title) {
        const parts = title.innerText.split(" · ");
        facebookConversation = { ...facebookConversation, title: parts[1] };
      }

      if (facebookLinkElement) {
        const hrefFacebook = facebookLinkElement.getAttribute("href");
        const match = hrefFacebook.match(/\/item\/(\d+)\//);

        if (match) {
          mpID = match[1];
          facebookConversation = { ...facebookConversation, facebookId: mpID };
        }
      }

      const hrefMessenger = el.getAttribute("href");
      const matchMessenger = hrefMessenger.match(/\/t\/(\d+)\//);
      let msID = null;

      if (matchMessenger) {
        msID = matchMessenger[1];
        facebookConversation = { ...facebookConversation, messengerId: msID };
      }

      const currentMessages = document.querySelectorAll(
        'div[role="none"][dir="auto"]'
      );
      const messages = [];

      currentMessages.forEach((element) => {
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

      facebookConversation.messages = messages;
      currentConversations.push(facebookConversation);
      index++;
    }, 2600);
  }, 2600);
};

const checkAllMessages = async () => {
  const elements = document.querySelectorAll(
    'a[role="link"].x1i10hfl.x1qjc9v5.xjqpnuy.xa49m3k'
  );

  let currentConversations = [];
  let index = 0;

  const intervalId = setInterval(() => {
    if (index >= 10) {
      clearInterval(intervalId);
      chrome.storage.local.get(["senderTab"]).then((result) => {
        const tabId = result.senderTab;
        chrome.runtime.sendMessage({
          type: "saveAllConversations",
          tabId,
          conversation: currentConversations,
        });
      });
      return;
    }

    const el = elements[index];

    if (!el.href.startsWith("https://www.facebook.com/marketplace/item")) {
      el.click();
    }

    setTimeout(() => {
      const facebookLinkElement = document.querySelector(
        'a[role="link"].x1i10hfl.x1qjc9v5.xjqpnuy.xa49m3k[href^="https://www.facebook.com/marketplace/item"]'
      );

      let facebookConversation = {};
      let mpID = null;
      const title = el.querySelector(
        "span.x1lliihq.x193iq5w.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft"
      );

      if (title) {
        const parts = title.innerText.split(" · ");
        facebookConversation = { ...facebookConversation, title: parts[1] };
      }

      if (facebookLinkElement) {
        const hrefFacebook = facebookLinkElement.getAttribute("href");
        const match = hrefFacebook.match(/\/item\/(\d+)\//);

        if (match) {
          mpID = match[1];
          facebookConversation = { ...facebookConversation, facebookId: mpID };
        }
      }

      const hrefMessenger = el.getAttribute("href");
      const matchMessenger = hrefMessenger.match(/\/t\/(\d+)\//);
      let msID = null;

      if (matchMessenger) {
        msID = matchMessenger[1];
        facebookConversation = { ...facebookConversation, messengerId: msID };
      }

      const currentMessages = document.querySelectorAll(
        'div[role="none"][dir="auto"]'
      );
      const messages = [];

      currentMessages.forEach((element) => {
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

      facebookConversation.messages = messages;
      currentConversations.push(facebookConversation);
      index++;
    }, 2000);
  }, 2000);

  chrome.storage.local.get(["messengerTabId"]).then((result) => {
    const messengerTabId = result.messengerTabId;

    chrome.scripting.executeScript({
      target: { tabId: messengerTabId },
      function: checkNewMessages,
    });
  });
};

function openMessenger() {
  const modalButton = document.querySelector(
    'div[aria-label="Message"][role="button"]'
  );
  if (modalButton) {
    modalButton.click();
  } else {
    setTimeout(() => {
      const sendAgain = document.querySelector(
        'div[aria-label^="Message Again"]'
      );
      sendAgain.click();
    }, 2600);
  }
}

const sendMessageToMessenger = (messageId, message) => {
  function simulateClearAndType(element, textToType) {
    element.focus();

    const content = element.textContent;
    const contentLength = content.length;
    if (contentLength > 0) {
      element.value = textToType;
      //TODO define how to erase the existing value
    } else {
      setTimeout(() => {
        const inputEvent = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: textToType,
        });
        element.dispatchEvent(inputEvent);
      }, 100);
    }
  }

  const elements = document.querySelectorAll(
    'a[role="link"].x1i10hfl.x1qjc9v5.xjqpnuy.xa49m3k'
  );

  let selectedElement = null;

  elements.forEach((element) => {
    const href = element.getAttribute("href");
    if (href && href.includes(messageId)) {
      selectedElement = element;
      element.click();
    }
  });

  setTimeout(() => {
    if (selectedElement) {
      const focusedElement = document.querySelector(
        'div[aria-label="Message"]'
      );
      const textToType = message || "I'm following up this";

      simulateClearAndType(focusedElement, textToType);

      setTimeout(() => {
        const sendButton = document.querySelector(
          'div[aria-label="Press Enter to send"]'
        );
        if (sendButton) {
          sendButton.click();

          const facebookLinkElement = document.querySelector(
            'a[role="link"].x1i10hfl.x1qjc9v5.xjqpnuy.xa49m3k[href^="https://www.facebook.com/marketplace/item"]'
          );

          let mpID = null;

          if (facebookLinkElement) {
            const hrefFacebook = facebookLinkElement.getAttribute("href");
            const match = hrefFacebook.match(/\/item\/(\d+)\//);

            if (match) {
              mpID = match[1];
            }
          }

          chrome.storage.local.get(["senderTab"]).then((result) => {
            const tabId = result.senderTab;
            chrome.runtime.sendMessage({
              type: "saveSentMessengerMessage",
              tabId,
              messengerId: messageId,
              facebookId: mpID,
              conversation: [
                {
                  text: textToType,
                  type: "sent",
                  messengerId: messageId,
                  facebookId: mpID,
                },
              ],
            });
          });
        }
      }, 1300);
    } else {
      console.log("No messages");
    }
  }, 1300);
};

function sendFacebookMessage(message, tabInfo) {
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

  function simulateClearAndType(element, textToType) {
    element.focus();

    const content = element.textContent;
    const contentLength = content.length;
    if (contentLength > 0) {
      for (let i = 0; i < contentLength; i++) {
        const event = new KeyboardEvent("keydown", { key: "Backspace" });
        element.dispatchEvent(event);
      }
    } else {
      setTimeout(() => {
        const inputEvent = new InputEvent("input", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: textToType,
        });
        element.dispatchEvent(inputEvent);
      }, 100);
    }
  }

  if (modalTextArea) {
    const textToType = message || "Is this still available, I'm interested?";
    modalTextArea.value = textToType;

    simulateTyping(modalTextArea, textToType).then(() => {
      const ariaLabel = "Send Message";
      const myButton = document.querySelector(`[aria-label^="${ariaLabel}"]`);
      myButton.click();

      chrome.storage.local.get(["senderTab"]).then((result) => {
        const tabId = result.senderTab;
        chrome.runtime.sendMessage({
          type: "saveSendMessages",
          tabId,
          tabInfo,
          conversation: [{ text: textToType, type: "sent" }],
        });
      });
    });
  } else {
    const focusedElement = document.querySelector('div[aria-label="Message"]');
    const textToType = message || "I'm following up this";

    if (
      focusedElement.isContentEditable ||
      focusedElement.tagName === "INPUT" ||
      focusedElement.tagName === "TEXTAREA"
    ) {
      simulateClearAndType(focusedElement, textToType);
    }

    setTimeout(() => {
      const sendButton = document.querySelector(
        'div[aria-label="Press Enter to send"]'
      );
      if (sendButton) {
        sendButton.click();

        chrome.storage.local.get(["senderTab"]).then((result) => {
          const tabId = result.senderTab;
          chrome.runtime.sendMessage({
            type: "saveSendMessages",
            tabId,
            tabInfo,
            conversation: [{ text: textToType, type: "sent" }],
          });
        });
      }
    }, 1300);
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (
      details.url.startsWith(
        `${envVariables.CHROME_EXTENSION_FRONT_URL}?marketplace`
      )
    ) {
      const url = decodeURIComponent(
        details.url.substring(details.url.indexOf("=") + 1)
      );
      const match = url.match(/\/item\/(\d+)\//);
      let marketplaceID = null;

      if (match) {
        marketplaceID = match[1];
      }

      chrome.tabs.query({}, function (tabs) {
        for (const tab of tabs) {
          if (tab.url.startsWith(envVariables.CHROME_EXTENSION_FRONT_URL)) {
            chrome.storage.local.set({ senderTab: tab.id });
          }
        }
      });

      let tabFound = false;
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.url === url) {
            chrome.tabs.update(tab.id, { active: false }, () => {
              const storageData = {};
              storageData[`facebookMarketPlaceTab${marketplaceID}`] = {
                id: tab.id,
                url,
                marketplaceID,
              };

              chrome.storage.local.set(storageData);

              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: openMessenger,
              });
            });
            tabFound = true;
            break;
          } else if (
            tab.url.startsWith(envVariables.CHROME_EXTENSION_FRONT_URL)
          ) {
            chrome.storage.local.set({ senderTab: tab.id });
          }
        }

        if (!tabFound) {
          chrome.tabs.create({ url, active: false }, (tab) => {
            const storageData = {};
            storageData[`facebookMarketPlaceTab${marketplaceID}`] = {
              id: tab.id,
              url,
              marketplaceID,
            };
            chrome.storage.local.set(storageData);

            chrome.tabs.onUpdated.addListener(function listener(
              tabId,
              changeInfo
            ) {
              if (changeInfo.status === "complete" && tabId === tab.id) {
                setTimeout(() => {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: openMessenger,
                  });
                }, 1300);

                chrome.tabs.onUpdated.removeListener(listener);
              }
            });
          });
        }
      });
    } else if (
      details.url.startsWith(
        `${envVariables.CHROME_EXTENSION_FRONT_URL}?vehicle`
      )
    ) {
      const data = decodeURIComponent(
        details.url.substring(details.url.indexOf("=") + 1)
      );
      const dataArray = data.split("&");
      const vehicle = dataArray[0]?.replace("vehicle=", "");
      const user = dataArray[1]?.replace("user=", "");
      const seller = dataArray[2]?.replace("seller=", "");
      const message = dataArray[3]?.replace("message=", "");
      const url = dataArray[4]?.replace("url=", "");

      const match = url.match(/\/item\/(\d+)\//);
      let marketplaceID = null;

      if (match) {
        marketplaceID = match[1];
      }

      chrome.tabs.query({ currentWindow: true }, function (tabs) {
        for (const tab of tabs) {
          if (tab.url.startsWith(url)) {
            chrome.tabs.update(tab.id, { active: false }, () => {
              chrome.storage.local.set({
                message: message,
                vehicle: vehicle,
                seller: seller,
                user: user,
              });

              chrome.storage.local
                .get([`facebookMarketPlaceTab${marketplaceID}`])
                .then((result) => {
                  const tabInfo =
                    result[`facebookMarketPlaceTab${marketplaceID}`];
                  const tabId = tabInfo.id;
                  if (tabId) {
                    chrome.scripting.executeScript({
                      target: { tabId },
                      function: sendFacebookMessage,
                      args: [message, tabInfo],
                    });
                  }
                });
            });
          }
        }
      });
    } else if (
      details.url.startsWith(
        `${envVariables.CHROME_EXTENSION_FRONT_URL}?messageId`
      )
    ) {
      const data = decodeURIComponent(
        details.url.substring(details.url.indexOf("=") + 1)
      );
      const dataArray = data.split("&");
      const messageId = dataArray[0]?.replace("messageId=", "");
      const message = dataArray[1]?.replace("message=", "");

      chrome.tabs.query({}, function (tabs) {
        for (const tab of tabs) {
          if (tab.url.startsWith(envVariables.MESSENGER_MARKETPLACE)) {
            chrome.tabs.update(tab.id, { active: false }, () => {
              chrome.storage.local.set({
                message: message,
                messageId: messageId,
              });

              const currentId = tab.id;
              chrome.scripting.executeScript({
                target: { tabId: currentId },
                function: sendMessageToMessenger,
                args: [messageId, message],
              });
            });
          }
        }
      });
    } else if (
      details.url.startsWith(
        `${envVariables.CHROME_EXTENSION_FRONT_URL}?closeFacebookURL`
      )
    ) {
      const data = decodeURIComponent(
        details.url.substring(details.url.indexOf("=") + 1)
      );
      const dataArray = data.split("&");
      const url = dataArray[0]?.replace("closeFacebookURL=", "");

      chrome.tabs.query({}, function (tabs) {
        for (const tab of tabs) {
          if (tab.url.startsWith(url)) {
            chrome.tabs.remove(tab.id);
          }
        }
      });
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onInstalled.addListener(function () {
  let tabFound = false;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.url.startsWith(envVariables.CHROME_EXTENSION_FRONT_URL)) {
        chrome.storage.local.set({ senderTab: tab.id });
      }
      if (tab.url.startsWith(envVariables.MESSENGER_MARKETPLACE)) {
        chrome.storage.local.set({ messengerTabId: tab.id });
        tabFound = true;
      }
    }

    if (!tabFound) {
      chrome.tabs.create(
        { url: envVariables.MESSENGER_MARKETPLACE, active: false },
        (tab) => {
          chrome.storage.local.set({
            messengerTabId: tab.id,
          });

          chrome.tabs.onUpdated.addListener(function listener(
            tabId,
            changeInfo
          ) {
            if (changeInfo.status === "complete" && tabId === tab.id) {
              chrome.tabs.onUpdated.removeListener(listener);
            }
          });
        }
      );
    }
  });
});

function sendResponseToOrigin(
  conversation,
  vehicleId,
  userId,
  seller,
  marketplaceID
) {
  const button = document.getElementsByClassName(
    "facebook-message-loading-button"
  )[0];
  if (conversation?.length > 0) {
    button.setAttribute("data-conversation", JSON.stringify(conversation));
    button.setAttribute("data-vehicle-id", JSON.stringify(vehicleId));
    button.setAttribute("data-user-id", JSON.stringify(userId));
    button.setAttribute("data-seller-name", JSON.stringify(seller));
    button.setAttribute("data-market-place-id", JSON.stringify(marketplaceID));
    button.click();
  }
}

function sendResponseFromMessenger(conversation) {
  const button = document.getElementsByClassName(
    "facebook-message-loading-button"
  )[0];
  if (conversation?.length > 0) {
    button.setAttribute(
      "data-messenger-conversation",
      JSON.stringify(conversation)
    );
    button.click();
  }
}

function sendConversations(conversation) {
  const button = document.getElementsByClassName(
    "facebook-message-loading-button"
  )[0];
  if (conversation?.length > 0) {
    button.setAttribute(
      "data-messenger-conversation",
      JSON.stringify(conversation)
    );
    button.click();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "saveSendMessages") {
    const tabId = message.tabId;
    const conversation = message.conversation;
    const tabInfo = message.tabInfo;

    chrome.storage.local.get(["vehicle", "user", "seller"]).then((result) => {
      const vehicleId = result.vehicle;
      const userId = result.user;
      const seller = result.seller;
      const marketplaceID = tabInfo.marketplaceID;

      chrome.scripting.executeScript({
        target: { tabId },
        function: sendResponseToOrigin,
        args: [conversation, vehicleId, userId, seller, marketplaceID],
      });
    });
  }
  if (message.type === "saveSentMessengerMessage") {
    const tabId = message.tabId;
    const conversation = [
      {
        messages: message.conversation,
        messengerId: message.messengerId,
        facebookId: message.facebookId,
      },
    ];
    chrome.scripting.executeScript({
      target: { tabId },
      function: sendResponseFromMessenger,
      args: [conversation],
    });
  }
  if (message.type === "saveAllConversations") {
    const tabId = message.tabId;
    const conversation = message.conversation;

    chrome.tabs.update(tabId, {}, () => {
      chrome.scripting.executeScript({
        target: { tabId },
        function: sendConversations,
        args: [conversation],
      });
    });
  }
  if (message.type === "sendFacebookMessage") {
    const tabId = message.tabId;
    chrome.storage.local.set({
      message: message.message,
      vehicle: message.vehicle,
      seller: message.seller,
      user: message.user,
    });
    chrome.scripting.executeScript({
      target: { tabId },
      function: sendFacebookMessage,
      args: [message.message, tabId],
    });
  }
  if (message.type === "checkAllMessages") {
    const tabId = message.tabId;

    chrome.scripting.executeScript({
      target: { tabId },
      function: checkNewMessages,
    });
  }
});

function performTaskOnTab() {
  chrome.storage.local.get(["messengerTabId"]).then((result) => {
    if (result.messengerTabId) {
      const messengerTabId = result.messengerTabId;
      chrome.scripting.executeScript({
        target: { tabId: messengerTabId },
        function: checkNewMessages,
      });
    }
  });
}

function performTaskPeriodically() {
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      if (tab.url.includes(envVariables.MESSENGER_MARKETPLACE)) {
        performTaskOnTab(tab.id);
      }
    });
  });
}

setInterval(performTaskPeriodically, 25000);
