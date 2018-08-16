
(function() {

  'use strict';

  /******************************************************************************/

  var messaging = vAPI.messaging;
  var notifData = {};
  var walletInfoStore = null;
  var walletIsUnlocked = false;
  var role = null;

  //handle url parameters
  var params = new URLSearchParams(window.location.search);
  if (params.has("role")) {
    role = params.get("role");
    if (role === "personalSign") {
      if (params.has("msgid")) {
        notifData.msgId = parseInt(params.get("msgid"));
      }
      if (params.has("origin")) {
        notifData.origin = params.get("origin");
      }
    }
  }

  var getMessageFromId = function(cb) {
    var onMsgReceived = function(msg) {
      if (!msg) {
        console.error("no message received");
      }
      notifData.message = msg;
      cb(msg);
    };
    messaging.send('notification', { what: 'getMessageFromId', msgId: notifData.msgId }, onMsgReceived);
  };

  var getLastUnapprovedMessage = function(cb) {
    var onMsgsReceived = function(msgObj) {
      if (!msgObj) {
        console.error("no message object received");
      }
      var msg = Object.keys(msgObj).reduce(function(lastMsg, msgId) {
        if (lastMsg) {
          if (lastMsg.time < msgObj[msgId].time) {
            return msgObj[msgId];
          } else {
            return lastMsg;
          }
        } else {
          return msgObj[msgId];
        }
      },null);
      notifData.message = msg;
      cb(msg);
    };
    messaging.send('notification', { what: 'getUnapprovedMsgs' }, onMsgsReceived);
  };

  /******************************************************************************/

  var showOverlay = function(overlayId, params) {
    var overlaysContainer = uDom.nodeFromId("overlays");
    var overlay = uDom.nodeFromId(overlayId);
    if (overlayId === "unlockOverlay") {
      if (params && params.currentPanel) {
        var currentImportPanel = uDom.nodeFromId(params.currentPanel);
        currentImportPanel.style.setProperty("display", "block");
      } else {
        var startOverlayPanel = uDom.nodeFromId("passwordOverlayPanel");
        startOverlayPanel.style.setProperty("display", "block");
      }
    }
    if (overlay) {
      overlaysContainer.style.setProperty("display", "block");
      overlay.style.setProperty("display", "block");
      return true;
    } else {
      console.error("overlay not found");
      return false;
    }
  };

  var hideOverlay = function(overlayId) {
    var overlaysContainer = uDom.nodeFromId("overlays");
    var overlaysList = uDom.nodesFromClass("overlayWindow");
    var errorFields = [];
    if (overlayId === "unlockOverlay" || overlayId === "all") {
      uDom.nodeFromId("wallet-password").value = "";
      uDom.nodeFromId("wallet-privkey").value = "";
      uDom.nodeFromId("passwordOverlayPanel").style.setProperty("display", "none");
      uDom.nodeFromId("privKeyOverlayPanel").style.setProperty("display", "none");
      errorFields.push(uDom.nodeFromId("unlock-overlay-password-error"));
      errorFields.push(uDom.nodeFromId("unlock-overlay-privkey-error"));
    }
    if (errorFields.length > 0) {
      for (var j = 0; j < errorFields.length; j++) {
        errorFields[j].textContent = "";
        errorFields[j].parentElement.classList.remove("has-danger");
      }
    }
    for (var i = 0; i < overlaysList.length; i++) {
      overlaysList[i].style.setProperty("display", "none");
    }
    overlaysContainer.style.setProperty("display", "none");
  };

  /******************************************************************************/

  var displayMessage = function() {
    if (!notifData.message) {
      console.error("no message to display");
      return;
    }
    var messageContainer = uDom.nodeFromId("message-field");
    messageContainer.value = notifData.message.msgParams.data;
  };

  var initPersonalSign = function() {
    if (notifData.msgId) {
      getMessageFromId(displayMessage);
    } else {
      getLastUnapprovedMessage(displayMessage);
    }
  };

  var closeNotif = function() {
    chrome.tabs.getCurrent(function(tabInfos){
      var tabId = tabInfos.id;
      messaging.send(
          'notification',
          { what: 'closeTab', tabId: tabId }
      );
    });
  };

  var unlockAndProceed = function(credentials, unlockMechanism) {
    var onSignInfoReceived = function(response) {
      if (!response || typeof response !== "object") {
        var textContent = vAPI.i18n('signError');
        var errorField = uDom.nodeFromId("sign-error");
        if (unlockMechanism) {
          if (unlockMechanism === "password") {
            textContent = vAPI.i18n('passwordMismatchError');
            errorField = uDom.nodeFromId("unlock-overlay-password-error");
          } else { //privkey
            textContent = vAPI.i18n('privKeyOrPassphraseError');
            errorField = uDom.nodeFromId("unlock-overlay-privkey-error");
          }
        }
        errorField.textContent = textContent;
        errorField.parentElement.classList.add("has-danger");
        return console.log("error signing message");
      }
      closeNotif();
    };
    messaging.send(
        'notification',
        { what: 'signPersonalMessage', msgId: notifData.msgId, password: credentials.password , privKey: credentials.privkey },
        onSignInfoReceived
    );
};

  var unlockWithPasswordFromOverlay = function(ev) {
    ev.preventDefault();
    var passwordField = uDom.nodeFromId("wallet-password");
    var errorField = uDom.nodeFromId("unlock-overlay-password-error");
    var password = passwordField.value;
    if (password === "") {
      errorField.textContent = vAPI.i18n('noPasswordError');
      errorField.parentElement.classList.add("has-danger");
      return;
    } else {
      errorField.textContent = "";
      errorField.parentElement.classList.remove("has-danger");
    }
    unlockAndProceed({password: password}, "password");
  };

  var unlockWithPrivKeyFromOverlay = function(ev) {
    ev.preventDefault();
    var privKeyField = uDom.nodeFromId("wallet-privkey");
    var errorField = uDom.nodeFromId("unlock-overlay-privkey-error");
    var privKey = privKeyField.value;
    if (privKey === "") {
      errorField.textContent = vAPI.i18n('noSeedOrPrivKeyError');
      errorField.parentElement.classList.add("has-danger");
      return;
    } else {
      errorField.textContent = "";
      errorField.parentElement.classList.remove("has-danger");
    }
    unlockAndProceed({privKey: privKey}, "privKey");
  };

  var onSignMessage = function(ev) {
    ev.preventDefault();
    if (!walletIsUnlocked) {
      if (walletInfoStore.onlyAddress) {
        showOverlay("unlockOverlay",{currentPanel: "privKeyOverlayPanel"});
      } else {
        showOverlay("unlockOverlay",{currentPanel: "passwordOverlayPanel"});
      }
    } else {
      var errorField = uDom.nodeFromId("sign-error");
      errorField.textContent = "";
      errorField.parentElement.classList.remove("has-danger");
      unlockAndProceed({});
    }
  }

  var onRejectMessage = function(ev) {
    ev.preventDefault();
    messaging.send(
        'notification',
        { what: 'rejectPersonalMessage', msgId: notifData.msgId }
    );
    closeNotif();
  }

  var renderWallet = function() {
    var addressDisplay = "No wallet available!";
    if (walletInfoStore.hasWallet && walletInfoStore.walletAddress) {
      addressDisplay = `${walletInfoStore.walletAddress.slice(0, 26)}...${walletInfoStore.walletAddress.slice(-4)}`;
    }
    var addressStack = uDom.nodeFromId("address-stack");
    addressStack.textContent = addressDisplay;
  };

  var onReadWalletInfo = function(walletInfo) {
      walletInfoStore = walletInfo;
      if (walletInfo && walletInfo.isUnlocked === true) {
          walletIsUnlocked = true;
          // onUnlockWallet();
      } else {
          // renderPage();
      }
      renderWallet();
  };

  var initNotif = function() {
    messaging.send('dashboard', { what: 'getWalletInfo' }, onReadWalletInfo);
  };

  var initSpecific = function() {
    var title = uDom.nodeFromId("notificationTitle");
    var subtitle = uDom.nodeFromId("notificationSubtitle");
    switch (role) {
      case "personalSign":
        title.textContent = "Sign Message";
        subtitle.innerHTML = "The site <b>"+
        notifData.origin.replace(/https?:\/\//,"")+
        "</b> has asked for a signature";
        initPersonalSign();
        break;
    }
  };

  console.log(role, notifData);
  initNotif();
  initSpecific();

  uDom('#sign-message-button').on('click', onSignMessage);
  uDom('#cancel-sign-message-button').on('click', onRejectMessage);


  uDom('#unlock-password-button-overlay').on('click', unlockWithPasswordFromOverlay);
  uDom('#cancel-password-button-overlay').on('click', function(ev){ev.preventDefault();hideOverlay("unlockOverlay");});
  uDom('#unlock-privkey-button-overlay').on('click', unlockWithPrivKeyFromOverlay);
  uDom('#cancel-privkey-button-overlay').on('click', function(ev){ev.preventDefault();hideOverlay("unlockOverlay");});

  uDom('.overlayClose').on('click', function(){hideOverlay("all");});


})();
