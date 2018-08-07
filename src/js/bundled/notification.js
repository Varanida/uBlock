
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
        console.log("no message received");
      }
      notifData.message = msg;
      cb(msg);
    }
    messaging.send('notification', { what: 'getMessageFromId', msgId: notifData.msgId }, onMsgReceived);
  }

  var getLastUnapprovedMessage = function(cb) {
    var onMsgsReceived = function(msgObj) {
      if (!msgObj) {
        console.log("no message object received");
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
  }

  var displayMessage = function() {
    if (!notifData.message) {
      console.log("no message to display");
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

})();
