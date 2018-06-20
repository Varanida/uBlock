/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2014-2018 Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

/* global punycode, uDom */

'use strict';

/******************************************************************************/

(function() {

// Mobile device?
// https://github.com/gorhill/uBlock/issues/3032
// - If at least one of the window's viewport dimension is larger than the
//   corresponding device's screen dimension, assume uBO's popup panel sits in
//   its own tab.
if (
    /[\?&]mobile=1/.test(window.location.search) ||
    window.innerWidth >= window.screen.availWidth ||
    window.innerHeight >= window.screen.availHeight
) {
    document.body.classList.add('mobile');
}

/******************************************************************************/

var messaging = vAPI.messaging;
var allScriptsLoaded = false;
var popupData = {};
var rewardCount = 0;
var dfPaneBuilt = false;
var reIP = /^\d+(?:\.\d+){1,3}$/;
var scopeToSrcHostnameMap = {
    '/': '*',
    '.': ''
};
var dfHotspots = null;
var hostnameToSortableTokenMap = {};
var allDomains = {};
var allDomainCount = 0;
var allHostnameRows = [];
var touchedDomainCount = 0;
var rowsToRecycle = uDom();
var cachedPopupHash = '';
var statsStr = vAPI.i18n('popupBlockedStats');
var dataSettingsLevelStr = vAPI.i18n('popupDataSettingsLevel');
var dataSettingsBonusStr = vAPI.i18n('popupDataSettingsBonus');
var chartData = null;
var toggleButtons = {};
var notificationInfo = null;

/******************************************************************************/

var cachePopupData = function(data) {
    popupData = {};
    scopeToSrcHostnameMap['.'] = '';
    hostnameToSortableTokenMap = {};

    if ( typeof data !== 'object' ) {
        return popupData;
    }
    popupData = data;
    scopeToSrcHostnameMap['.'] = popupData.pageHostname || '';
    var hostnameDict = popupData.hostnameDict;
    if ( typeof hostnameDict !== 'object' ) {
        return popupData;
    }
    var domain, prefix;
    for ( var hostname in hostnameDict ) {
        if ( hostnameDict.hasOwnProperty(hostname) === false ) {
            continue;
        }
        domain = hostnameDict[hostname].domain;
        prefix = hostname.slice(0, 0 - domain.length);
        // Prefix with space char for 1st-party hostnames: this ensure these
        // will come first in list.
        if ( domain === popupData.pageDomain ) {
            domain = '\u0020';
        }
        hostnameToSortableTokenMap[hostname] = domain + prefix.split('.').reverse().join('.');
    }
    return popupData;
};

/******************************************************************************/
var refreshSlide = function(state) {
  if (state) {
    uDom('#refreshSlideDown')
    .toggleClass('show', true);
  } else {
    uDom('#refreshSlideDown')
    .toggleClass('show', false);
  }
};

/******************************************************************************/

var hashFromPopupData = function(reset) {
    // It makes no sense to offer to refresh the behind-the-scene scope
    if ( popupData.pageHostname === 'behind-the-scene' ) {
        refreshSlide(false);
        return;
    }

    var hasher = [];
    hasher.push(!uDom.nodeFromId('switch').checked);
    hasher.push(uDom.nodeFromId('no-large-media').checked);
    hasher.push(uDom.nodeFromId('no-cosmetic-filtering').checked);
    hasher.push(uDom.nodeFromId('no-remote-fonts').checked);

    var hash = hasher.join('');
    if ( reset ) {
        cachedPopupHash = hash;
    }
    refreshSlide(hash !== cachedPopupHash);
};

var updatePopupData = function(newData) {
  if ( typeof newData !== 'object' ) {
      return popupData;
  }
  for ( var key in newData ) {
      if (newData[key] != null) {
        popupData[key] = newData[key];
      }
  }
  return popupData;
};

/******************************************************************************/

var formatNumber = function(count) {
    return typeof count === 'number' ? count.toLocaleString() : '';
};

// Assume everything has to be done incrementally.


/******************************************************************************/

var gotoURL = function(ev) {
    if ( this.hasAttribute('href') === false) {
        return;
    }

    ev.preventDefault();

    messaging.send(
        'popupPanel',
        {
            what: 'gotoURL',
            details: {
                url: this.getAttribute('href'),
                select: true,
                index: -1,
                shiftKey: ev.shiftKey
            }
        }
    );

    vAPI.closePopup();
};

var renderBalanceLoading = function(loading) {
  if (loading) {
    uDom.nodeFromId("balanceLoader").style.setProperty("display", "inline-block");
  } else {
    uDom.nodeFromId("balanceLoader").style.setProperty("display", "none");
  }
};

/******************************************************************************/

var gotoEtherscan = function(ev) {
    ev.preventDefault();
    if (!popupData.walletAddress) {
      return;
    }
    messaging.send(
        'popupPanel',
        {
            what: 'gotoURL',
            details: {
                url: 'https://etherscan.io/address/'+popupData.walletAddress,
                select: true,
                index: -1,
                shiftKey: ev.shiftKey
            }
        }
    );
    vAPI.closePopup();
};

var renderPopup = function() {
    var elem, text;

    if ( popupData.tabTitle ) {
        document.title = popupData.appName + ' - ' + popupData.tabTitle;
    }

    elem = document.body;
    uDom('#switch').prop("checked",
      !(popupData.pageURL === '' ||
      !popupData.netFilteringSwitch ||
      popupData.pageHostname === 'behind-the-scene')
    );
    uDom.nodeFromId('switchSpan').style.setProperty("display", "inline-block");

    var blocked = popupData.pageBlockedRequestCount,
        total = popupData.pageAllowedRequestCount + blocked;
    if ( total === 0 ) {
        text = formatNumber(0);
    } else {
        text = statsStr.replace('{{count}}', formatNumber(blocked))
                       .replace('{{percent}}', formatNumber(Math.floor(blocked * 100 / total)));
    }
    uDom.nodeFromId('page-blocked').textContent = text;

    blocked = popupData.globalBlockedRequestCount;
    total = popupData.globalAllowedRequestCount + blocked;
    var blockedStr = total === 0? "" : blocked.toString();
    var percentageBlockedStr = formatNumber(Math.floor(blocked * 100 / total));
    var numberLength = blockedStr.length + percentageBlockedStr.length;
    if ( total === 0 ) {
        text = formatNumber(0);
    } else {
        text = statsStr.replace('{{count}}', formatNumber(blocked))
                       .replace('{{percent}}', percentageBlockedStr);
    }
    if (numberLength > 6) {
      var totalFontSize = Math.round(21 - numberLength)/10;
      var totalNode = uDom.nodeFromId('total-blocked');
      totalNode.style.setProperty("font-size", totalFontSize+"rem");
      totalNode.textContent = text;
    } else {
      uDom.nodeFromId('total-blocked').textContent = text;
    }

    // https://github.com/gorhill/uBlock/issues/507
    // Convenience: open the logger with current tab automatically selected
    if ( popupData.tabId ) {
        uDom.nodeFromSelector('.btn-parameter[href^="logger-ui.html"]').setAttribute(
            'href',
            'logger-ui.html#tab_' + popupData.tabId
        );
    }

    // Extra tools

    var toggleStates = {
      noPopup: popupData.noPopups === true,
      noLargeMedia: popupData.noLargeMedia === true,
      noCosmeticFiltering: popupData.noCosmeticFiltering === true,
      noRemoteFonts: popupData.noRemoteFonts === true
    };

    for (var toggleButton in toggleButtons) {
      if (toggleButtons.hasOwnProperty(toggleButton)) {
        toggleButtons[toggleButton].prop("checked", toggleStates[toggleButton]);
      }
    }

    //fill data sharing information
    renderDataSharingInfo();

    renderTooltips();
};

/******************************************************************************/

var tooltipTargetSelectors = new Map([
    [
        '#switch',
        {
            tooltipTarget: "#switchSpan",
            state: 'checked',
            i18n: 'popupPowerSwitchInfo'
        }
    ]
]);
// https://github.com/gorhill/uBlock/issues/2889
//   Use tooltip for ARIA purpose.
//
var renderTooltips = function(selector) {
    var elem, text, tooltipElem;
    for ( var entry of tooltipTargetSelectors ) {
        if ( selector !== undefined && entry[0] !== selector ) { continue; }
        elem = uDom.nodeFromSelector(entry[0]);
        text = vAPI.i18n(
            entry[1].i18n +
            (elem[entry[1].state] === true ? '1' : '2')
        );
        tooltipElem = entry[1].tooltipTarget?
          uDom.nodeFromSelector(entry[1].tooltipTarget) :
          elem;
        tooltipElem.setAttribute('aria-label', text);
        tooltipElem.setAttribute('data-tip', text);
        if ( selector !== undefined ) {
            uDom.nodeFromId('tooltip-text').textContent =
                tooltipElem.getAttribute('data-tip');
        }
    }
};

/******************************************************************************/

var renderWallet = function(address) {
  var walletAddress = address || popupData.walletAddress;
  var abscentWalletPane = uDom.nodeFromId("abscentWallet");
  var existingWalletPane = uDom.nodeFromId("existingWallet");
  var abscentWalletAddressPane = uDom.nodeFromId('abscentWalletAddress');
  var existingWalletAddressPane = uDom.nodeFromId('existingWalletAddress');
  if (walletAddress) {
    var rewardActivated = popupData.captchaValidated;
    var rewardDiv = uDom.nodeFromId("rewardActivated");
    var captchaButtonDiv = uDom.nodeFromId("rewardDeactivated");
    if (rewardActivated) {
      captchaButtonDiv.style.setProperty("display", "none");
      rewardDiv.style.setProperty("display", "block");
      var addressInput = uDom.nodeFromId("address-field");
      addressInput.value = walletAddress;
      var totalRewardCount = popupData.totalRewardCount;
      uDom.nodeFromId('total-reward').textContent = totalRewardCount+" VAD";
    } else {
      rewardDiv.style.setProperty("display", "none");
      captchaButtonDiv.style.setProperty("display", "block");
    }
    abscentWalletPane.style.setProperty("display", "none");
    existingWalletPane.style.setProperty("display", "flex");
    abscentWalletAddressPane.style.setProperty("display", "none");
    existingWalletAddressPane.style.setProperty("display", "block");
  } else {
    abscentWalletPane.style.setProperty("display", "flex");
    existingWalletPane.style.setProperty("display", "none");
    abscentWalletAddressPane.style.setProperty("display", "block");
    existingWalletAddressPane.style.setProperty("display", "none");
  }
}

/******************************************************************************/
// OVERLAYS managment
/******************************************************************************/

var overlayState = {
  set: function(overlayId, params) {
    var memObject = JSON.stringify({
      overlayId: overlayId,
      params: params
    });
    vAPI.localStorage.setItem("popupOverlayState", memObject);
  },
  get: function() {
    var state = vAPI.localStorage.getItem("popupOverlayState");
    if (state) {
      return JSON.parse(state);
    } else {
      return null;
    }
  },
  remove: function() {
    vAPI.localStorage.removeItem("popupOverlayState");
  }
};

/******************************************************************************/

var showOverlay = function(overlayId, params) {
  var overlaysContainer = uDom.nodeFromId("overlays");
  var overlay = uDom.nodeFromId(overlayId);
  if (overlayId === "showSeedOverlay" && params) {
    var seedContainer = uDom.nodeFromId("seed-field");
    seedContainer.value = params.seed;
    seedContainer.setAttribute("data-seed", params.seed);
  } else if (overlayId === "infoOverlay" && params) {
    uDom.nodeFromId("info-overlay-title").textContent = params.title || vAPI.i18n('popupInfoOverlayDefaultTitle');
    uDom.nodeFromId("info-overlay-text").textContent = params.text || "";
    uDom.nodeFromId("info-validate-button-overlay").textContent = params.button || vAPI.i18n('popupInfoOverlayDefaultButton');
  } else if (overlayId === "importWalletOverlay") {
    if (params && params.currentPanel) {
      var importMethodPanel = uDom.nodeFromId("importMethodOverlayPanel");
      var currentImportPanel = uDom.nodeFromId(params.currentPanel);
      importMethodPanel.style.setProperty("display", "none");
      currentImportPanel.style.setProperty("display", "block");
    } else {
      var startOverlayPanel = uDom.nodeFromId("importMethodOverlayPanel");
      startOverlayPanel.style.setProperty("display", "block");
    }
  } else if (overlayId === "captchaOverlay" && params) {
    var captchaDiv = uDom.nodeFromId("captchaField");
    captchaDiv.innerHTML = "";
    captchaDiv.appendChild(document.adoptNode(createSVGdocument(params.svgCaptcha).documentElement))
  }
  if (overlay) {
    if (overlayId !== "referralInputOverlay") {
      overlayState.set(overlayId, params);
    }
    overlaysContainer.style.setProperty("display", "block");
    overlay.style.setProperty("display", "block");
    return true;
  } else {
    console.log("overlay not found");
    return false;
  }
}
var hideOverlay = function(overlayId) {
  overlayState.remove();
  var overlaysContainer = uDom.nodeFromId("overlays");
  var overlaysList = uDom.nodesFromClass("overlayWindow");
  var errorFields = [];
  if (overlayId === "createWalletOverlay" || overlayId === "all") {
    uDom.nodeFromId("create-wallet-password").value = "";
    uDom.nodeFromId("create-wallet-password-duplicate").value = "";
    errorFields.push(uDom.nodeFromId("create-wallet-overlay-error"));
  }
  if (overlayId === "showSeedOverlay" || overlayId === "all") {
    var seedContainer = uDom.nodeFromId("seed-field");
    seedContainer.value = "";
    seedContainer.removeAttribute("data-seed");
  }
  if (overlayId === "importWalletOverlay" || overlayId === "all") {
    uDom.nodeFromId("import-wallet-password").value = "";
    uDom.nodeFromId("import-wallet-password-duplicate").value = "";
    uDom.nodeFromId("import-wallet-seed").value = "";
    uDom.nodeFromId("importMethodOverlayPanel").style.setProperty("display", "block");
    uDom.nodeFromId("walletOverlayPanel").style.setProperty("display", "none");
    uDom.nodeFromId("addressOverlayPanel").style.setProperty("display", "none");
    errorFields.push(uDom.nodeFromId("import-wallet-overlay-error"));
    errorFields.push(uDom.nodeFromId("import-address-overlay-error"));
  }
  if (overlayId === "captchaOverlay") {
    uDom.nodeFromId("input-captcha").value = "";
    uDom.nodeFromId("captchaField").innerHTML = "";
    errorFields.push(uDom.nodeFromId("input-captcha-overlay-error"));
  }
  if (overlayId === "referralInputOverlay") {
    messaging.send('popupPanel', { what: 'setReferralWindowShown', shown: true });
    errorFields.push(uDom.nodeFromId("import-referral-overlay-error"));
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
}

var showWalletImport = function() {
  overlayState.set("importWalletOverlay", {currentPanel:"walletOverlayPanel"});
  var importMethodPanel = uDom.nodeFromId("importMethodOverlayPanel");
  var walletImportPanel = uDom.nodeFromId("walletOverlayPanel");
  importMethodPanel.style.setProperty("display", "none");
  walletImportPanel.style.setProperty("display", "block");
};

var showAddressImport = function() {
  overlayState.set("importWalletOverlay", {currentPanel:"addressOverlayPanel"});
  var importMethodPanel = uDom.nodeFromId("importMethodOverlayPanel");
  var addressImportPanel = uDom.nodeFromId("addressOverlayPanel");
  importMethodPanel.style.setProperty("display", "none");
  addressImportPanel.style.setProperty("display", "block");
};

var restoreOverlays = function() {
  var currentOverlayState = overlayState.get();
  if (!currentOverlayState) {
    return;
  }
  if (
    !currentOverlayState.overlayId ||
    currentOverlayState.overlayId === "referralInputOverlay"
  ) {
    overlayState.remove();
    return;
  }
  showOverlay(currentOverlayState.overlayId, currentOverlayState.params);
};

var createWalletFromOverlay = function(ev) {
  ev.preventDefault();
  var passwordField = uDom.nodeFromId("create-wallet-password");
  var passwordFieldDuplicate = uDom.nodeFromId("create-wallet-password-duplicate");
  var errorField = uDom.nodeFromId("create-wallet-overlay-error");
  var pass1 = passwordField.value;
  var pass2 = passwordFieldDuplicate.value;
  if (pass1 !== pass2) {
    errorField.textContent = vAPI.i18n('passwordMismatchError');
    errorField.parentElement.classList.add("has-danger");
    return;
  } else if (pass1.length < µConfig.minimalPasswordLength) {
    errorField.textContent = vAPI.i18n('passwordTooShortError').replace("{{minLength}}", µConfig.minimalPasswordLength);
    errorField.parentElement.classList.add("has-danger");
  } else {
    errorField.textContent = "";
    errorField.parentElement.classList.remove("has-danger");
  }
  setNewWallet(pass1);
}

var importWalletFromOverlay = function(ev) {
  ev.preventDefault();
  var passwordField = uDom.nodeFromId("import-wallet-password");
  var passwordFieldDuplicate = uDom.nodeFromId("import-wallet-password-duplicate");
  var seedField = uDom.nodeFromId("import-wallet-seed");
  var errorField = uDom.nodeFromId("import-wallet-overlay-error");
  var pass1 = passwordField.value;
  var pass2 = passwordFieldDuplicate.value;
  var seed = seedField.value;
  if (pass1 !== pass2) {
    errorField.textContent = vAPI.i18n('passwordMismatchError');
    errorField.parentElement.classList.add("has-danger");
    return;
  } else if (pass1.length < µConfig.minimalPasswordLength) {
    errorField.textContent = vAPI.i18n('passwordTooShortError').replace("{{minLength}}", µConfig.minimalPasswordLength);
    errorField.parentElement.classList.add("has-danger");
  } else if (seed === "") {
    errorField.textContent = vAPI.i18n('noSeedError');
    errorField.parentElement.classList.add("has-danger");
    return;
  } else {
    errorField.textContent = "";
    errorField.parentElement.classList.remove("has-danger");
  }
  importWallet(pass1, seed);
}

var importAddressFromOverlay = function(ev) {
  ev.preventDefault();
  var addressField = uDom.nodeFromId("import-wallet-address");
  var errorField = uDom.nodeFromId("import-address-overlay-error");
  var address = addressField.value;
  if (address === "") {
    errorField.textContent = vAPI.i18n('noAddressError');
    errorField.parentElement.classList.add("has-danger");
    return;
  } else {
    errorField.textContent = "";
    errorField.parentElement.classList.remove("has-danger");
  }
  importAddress(address);
}

var showReferralWindow = function() {
  if (popupData.referralWindowShown) {
    return; // the referral window has already been shown
  }
  showOverlay("referralInputOverlay");
}

var sendCaptchaAnswerFromOverlay = function(ev) {
  ev.preventDefault();
  var solutionField = uDom.nodeFromId("input-captcha");
  var errorField = uDom.nodeFromId("input-captcha-overlay-error");
  var solution = solutionField.value;
  if (solution.length !== 5) {
    errorField.textContent = vAPI.i18n('captchaLengthError');
    errorField.parentElement.classList.add("has-danger");
    showCaptcha();
    return;
  } else {
    errorField.textContent = "";
    errorField.parentElement.classList.remove("has-danger");
  }
  sendCaptchaAnswerAndContinue(solution);
}

var importReferralFromOverlay = function(ev) {
  ev.preventDefault();
  var addressField = uDom.nodeFromId("import-referral-address");
  var errorField = uDom.nodeFromId("import-address-overlay-error");
  var address = addressField.value;
  if (address === "") {
    errorField.textContent = vAPI.i18n('noAddressError');
    errorField.parentElement.classList.add("has-danger");
    return;
  } else {
    errorField.textContent = "";
    errorField.parentElement.classList.remove("has-danger");
  }
  importReferrer(address);
}

/******************************************************************************/
// NOTIFICATION managment
/******************************************************************************/

var hideNotification = function() {
  var notificationDiv = uDom.nodeFromId("notification-div");
  var safeTimeout = null;
  var squashListener = function() {
    if (safeTimeout) {
      clearTimeout(safeTimeout);
      safeTimeout = null;
    }
    notificationDiv.removeEventListener("transitionend", squashListener);
    notificationDiv.style.setProperty("display","none");
  };
  var slideListener = function() {
    if (safeTimeout) {
      clearTimeout(safeTimeout);
      safeTimeout = null;
    }
    notificationDiv.removeEventListener("transitionend", slideListener);
    notificationDiv.addEventListener("transitionend", squashListener, false);
    notificationDiv.classList.add("squash");
    safeTimeout = setTimeout(function() {safeTimeout = null; squashListener();}, 2000);
  };
  //slide left
  notificationDiv.addEventListener("transitionend", slideListener, false);
  notificationDiv.classList.add("slide");
  safeTimeout = setTimeout(function() {safeTimeout = null; slideListener();}, 2000);
  messaging.send('popupPanel', { what: 'setNotificationSeen', notificationId: notificationInfo.id });
};

var showNotification = function() {
  if (!notificationInfo) {
    return;
  }
  var notificationDiv = uDom.nodeFromId("notification-div");
  var notificationAlertDiv = uDom.nodeFromId("notification-alert");
  var notificationTextDiv = uDom.nodeFromId("notification-text");
  var safeTimeout = null;
  var notifListener = function() {
    // after change
    if (safeTimeout) {
      clearTimeout(safeTimeout);
      safeTimeout = null;
    }
    notificationDiv.removeEventListener("transitionend", notifListener);
    notificationDiv.classList.remove("slide");
  };
  // can be safely assigned with innerhtml because it has been sanitized in the background
  notificationTextDiv.innerHTML = notificationInfo.message;
  if (notificationInfo.link) {
    var readMoreLink = uDom("#notification-read-more");
    readMoreLink.on("click", gotoURL);
  }
  notificationDiv.classList.add("squash");
  notificationDiv.classList.add("slide");
  notificationAlertDiv.classList.add(notificationInfo.type? "alert-"+notificationInfo.type : "alert-info");
  notificationDiv.addEventListener("transitionend", notifListener, false);
  notificationDiv.classList.remove("squash");
  safeTimeout = setTimeout(function() {safeTimeout = null; notifListener();}, 2000);
};

var removeNotification = function() {
  uDom.nodeFromId("notification-div").style.setProperty("display","none");
};

var getNotification = function() {
  var onNotifInfoReceived = function(response) {
    if (!response || typeof response !== "object" || !response.message) {
      removeNotification();
      return;
    }
    notificationInfo = response;
    showNotification();
  };
  messaging.send(
      'popupPanel',
      { what: 'getLatestNotification'},
      onNotifInfoReceived
  );
};

/******************************************************************************/

var renderDataSharingInfo = function() {
  var level = popupData.dataShareLevel || 0;
  var completionLevel = popupData.dataCompletionLevel || 0;
  var bonus = µConfig.rewards.bonusPercentageForData[level];
  var text = dataSettingsLevelStr.replace('{{level}}', formatNumber(level));
  uDom.nodeFromId('dataLevelTitle').textContent = text;
  text = dataSettingsBonusStr.replace('{{bonus}}', formatNumber(bonus));
  uDom.nodeFromId('dataBonusInfo').textContent = text;
  if (completionLevel === 0) {
    uDom.nodeFromId('noDataYetInformation').textContent = vAPI.i18n('popupDataExplanation');
  } else {
    uDom.nodeFromId('noDataYetInformation').textContent = "";
  }
};

/******************************************************************************/

var onDataSliderUpdate = function(newDataShareLevel) {
  updatePopupData({dataShareLevel: newDataShareLevel});
  renderDataSharingInfo();
  messaging.send('popupPanel', { what: 'setShareLevel', newLevel: newDataShareLevel });
};

/******************************************************************************/

var renderDataSlider = function() {
  if (typeof popupData.dataShareLevel !== "number" || typeof popupData.dataCompletionLevel !== "number") {
    return;
  }
  if (!allScriptsLoaded) {
    window.addEventListener("load", function(event) { //on document ready
      DataSlider.init(popupData.dataShareLevel, popupData.dataCompletionLevel);
      DataSlider.attachListener(onDataSliderUpdate);
    });
    return;
  }
  DataSlider.init(popupData.dataShareLevel, popupData.dataCompletionLevel);
  DataSlider.attachListener(onDataSliderUpdate);
};

/******************************************************************************/

// All rendering code which need to be executed only once.

var renderOnce = function() {
    renderOnce = function(){};

    //add varanida website linking
    var varanidaMainLogo = uDom("#main-brand-logo");
    varanidaMainLogo.attr("href", µConfig.urls.front);
    varanidaMainLogo.on("click", gotoURL);

    //show referral notice if needed and attach events
    if (!popupData.referralNoticeHidden) {
      uDom.nodeFromId("referral-notice-text").textContent = vAPI.i18n("popupReferralNotice").replace("{{referral}}", µConfig.rewards.referral);
      uDom("#hide-referral-notice").on("click",function() {
        messaging.send('popupPanel', { what: 'hideReferralNotice', hide: true });
        uDom.nodeFromId("referral-notice").style.setProperty("display", "none");
      });
      uDom.nodeFromId("referral-notice").style.setProperty("display", "inline-block");
    }

    renderDataSlider();
    showReferralWindow(); // will only be executed if it hasn't already
    restoreOverlays();
    getNotification();
};

/******************************************************************************/

var renderPopupLazy = function() {
    messaging.send('popupPanel', { what: 'getPopupLazyData', tabId: popupData.tabId });
};

// var onPopupMessage = function(data) {
//     if ( !data ) { return; }
//     if ( data.tabId !== popupData.tabId ) { return; }
//
//     switch ( data.what ) {
//     case 'cosmeticallyFilteredElementCountChanged':
//         var v = data.count || '';
//         uDom.nodeFromSelector('#no-cosmetic-filtering > span.badge')
//             .textContent = typeof v === 'number' ? v.toLocaleString() : v;
//         break;
//     }
// };
//
// messaging.addChannelListener('popup', onPopupMessage);

/******************************************************************************/

var toggleNetFilteringSwitch = function(ev) {
    if ( !popupData || !popupData.pageURL ) { return; }
    if (
        popupData.pageHostname === 'behind-the-scene' &&
        !popupData.advancedUserEnabled
    ) {
        return;
    }
    var targetSwitch = ev.currentTarget;
    messaging.send(
        'popupPanel',
        {
            what: 'toggleNetFiltering',
            url: popupData.pageURL,
            scope: ev.ctrlKey || ev.metaKey ? 'page' : '',
            state: targetSwitch.checked == true,
            tabId: popupData.tabId
        }
    );
    renderTooltips('#switch');
    hashFromPopupData();
};
/******************************************************************************/

var copyAdressToClipboard = function(fieldToCopy) {
  var addressInput = uDom.nodeFromId(fieldToCopy);
  if (addressInput && addressInput.select){
    addressInput.focus();
    addressInput.select();
    document.execCommand("copy");
    addressInput.blur();
  }
};

/******************************************************************************/

var saveSeed = function() {
  var seedField = uDom.nodeFromId("seed-field");
  var seedText = seedField.getAttribute("data-seed");

  vAPI.download({
      'url': 'data:text/plain;charset=utf-8,' +
             encodeURIComponent(seedText),
      'filename': "varanida_wallet_passphrase.txt"
  });
};

/******************************************************************************/

// var gotoZap = function() {
//     messaging.send(
//         'popupPanel',
//         {
//             what: 'launchElementPicker',
//             tabId: popupData.tabId,
//             zap: true
//         }
//     );
//
//     vAPI.closePopup();
// };

/******************************************************************************/

// var gotoPick = function() {
//     messaging.send(
//         'popupPanel',
//         {
//             what: 'launchElementPicker',
//             tabId: popupData.tabId
//         }
//     );
//
//     vAPI.closePopup();
// };

var reloadTab = function(ev) {
    messaging.send(
        'popupPanel',
        {
            what: 'reloadTab',
            tabId: popupData.tabId,
            select: true,
            bypassCache: ev.ctrlKey || ev.metaKey || ev.shiftKey
        }
    );

    // Polling will take care of refreshing the popup content

    // https://github.com/chrisaljoudi/uBlock/issues/748
    // User forces a reload, assume the popup has to be updated regardless if
    // there were changes or not.
    popupData.contentLastModified = -1;

    // No need to wait to remove this.
    refreshSlide(false);
};

var toggleHostnameSwitch = function(ev) {
    var target = ev.currentTarget;
    var switchName = target.getAttribute('id');
    if ( !switchName ) { return; }
    // target.classList.toggle('on');
    messaging.send(
        'popupPanel',
        {
            what: 'toggleHostnameSwitch',
            name: switchName,
            hostname: popupData.pageHostname,
            state: target.checked == true,
            tabId: popupData.tabId
        }
    );
    // renderTooltips('#' + switchName);
    hashFromPopupData();
};

/******************************************************************************/

// Poll for changes.
//
// I couldn't find a better way to be notified of changes which can affect
// popup content, as the messaging API doesn't support firing events accurately
// from the main extension process to a specific auxiliary extension process:
//
// - broadcasting() is not an option given there could be a lot of tabs opened,
//   and maybe even many frames within these tabs, i.e. unacceptable overhead
//   regardless of whether the popup is opened or not.
//
// - Modifying the messaging API is not an option, as this would require
//   revisiting all platform-specific code to support targeted broadcasting,
//   which who knows could be not so trivial for some platforms.
//
// A well done polling is a better anyways IMO, I prefer that data is pulled
// on demand rather than forcing the main process to assume a client may need
// it and thus having to push it all the time unconditionally.

var pollForContentChange = (function() {
    var pollTimer = null;

    var pollCallback = function() {
        pollTimer = null;
        messaging.send(
            'popupPanel',
            {
                what: 'hasPopupContentChanged',
                tabId: popupData.tabId,
                contentLastModified: popupData.contentLastModified
            },
            queryCallback
        );
    };

    var queryCallback = function(response) {
        if ( response ) {
            getPopupData(popupData.tabId);
            return;
        }
        poll();
    };

    var poll = function() {
        if ( pollTimer !== null ) {
            return;
        }
        pollTimer = vAPI.setTimeout(pollCallback, 1500);
    };

    return poll;
})();

/******************************************************************************/

var getUpdatedRewardData = function() {
    renderBalanceLoading(true);
    var onDataReceived = function(response) {
        updatePopupData({totalRewardCount: response});
        renderWallet();
        renderBalanceLoading(false);
    };
    messaging.send(
        'popupPanel',
        { what: 'getUpdatedRewardCount'},
        onDataReceived
    );
};

/******************************************************************************/

var getPopupData = function(tabId) {
    var onDataReceived = function(response) {
        cachePopupData(response);
        renderOnce();
        renderPopup();
        renderWallet();
        getUpdatedRewardData();
        renderPopupLazy(); // low priority rendering
        hashFromPopupData(true);
        pollForContentChange();
    };
    messaging.send(
        'popupPanel',
        { what: 'getPopupData', tabId: tabId },
        onDataReceived
    );
};

/******************************************************************************/

var onCreateWallet = function() {
  showOverlay("createWalletOverlay");
};

/******************************************************************************/

var onImportWallet = function() {
  showOverlay("importWalletOverlay");
};

/******************************************************************************/

var setNewWallet = function(password) {
    var onWalletInfoReceived = function(response) {
      if (!response || typeof response !== "object" || !response.address) {
        var errorField = uDom.nodeFromId("create-wallet-overlay-error");
        errorField.textContent = vAPI.i18n('createWalletError');
        errorField.parentElement.classList.add("has-danger");
        return console.log("error creating wallet");
      }
      hideOverlay("createWalletOverlay");
      updatePopupData({
        hasWallet: true,
        walletAddress: response.address,
      });
      renderWallet();
      showOverlay("showSeedOverlay", {seed: response.seed});
    };
    messaging.send(
        'popupPanel',
        { what: 'setNewWallet', password: password },
        onWalletInfoReceived
    );
};

/******************************************************************************/

var importWallet = function(password, seed) {
    var onWalletInfoReceived = function(response) {
      if (!response || typeof response !== "object" || !response.address) {
        var errorField = uDom.nodeFromId("import-wallet-overlay-error");
        errorField.textContent = vAPI.i18n('importWalletError');
        errorField.parentElement.classList.add("has-danger");
        return console.log("error importing wallet");
      }
      updatePopupData({
        hasWallet: true,
        walletAddress: response.address,
      });
      renderWallet();
      hideOverlay("importWalletOverlay");
      showOverlay("showSeedOverlay", {seed: response.seed})
    };
    messaging.send(
        'popupPanel',
        { what: 'importWallet', password: password, seed: seed },
        onWalletInfoReceived
    );
};

/******************************************************************************/

  var importAddress = function(address) {
    var onWalletInfoReceived = function(response) {
      if (!response || typeof response !== "object" || !response.address) {
        var errorField = uDom.nodeFromId("import-address-overlay-error");
        errorField.textContent = vAPI.i18n('importAddressError');
        errorField.parentElement.classList.add("has-danger");
        return console.log("error importing wallet");
      }
      updatePopupData({
        hasWallet: true,
        walletAddress: response.address,
      });
      renderWallet();
      hideOverlay("importWalletOverlay");
      showCaptchaIfNotValidated();
    };
    messaging.send(
        'popupPanel',
        { what: 'importAddress', address: address },
        onWalletInfoReceived
    );
};

/******************************************************************************/

  var importReferrer = function(address) {
    var onReferralInfoReceived = function(response) {
      if (!response) {
        var errorField = uDom.nodeFromId("import-referral-overlay-error");
        errorField.textContent = vAPI.i18n('importReferralError');
        errorField.parentElement.classList.add("has-danger");
        return console.log("error importing referral");
      }
      hideOverlay("referralInputOverlay");
      showOverlay("infoOverlay", {
        title: vAPI.i18n('popupInfoOverlayReferralTitle'),
        text: vAPI.i18n('popupInfoOverlayReferralText').replace("{{referralReward}}", µConfig.rewards.referral)
      });

    };
    messaging.send(
        'popupPanel',
        { what: 'importReferrer', address: address },
        onReferralInfoReceived
    );
};

/******************************************************************************/

var closeSeedOverlay = function() {
  hideOverlay("showSeedOverlay");
  showCaptchaIfNotValidated();
};

/******************************************************************************/

var showCaptchaIfNotValidated = function() {
  showOverlay("waitingOverlay");
  var onStatusReceived = function(alreadyVerified) {
    updatePopupData({captchaValidated: alreadyVerified});
    hideOverlay("waitingOverlay");
    if (!alreadyVerified) {
      showCaptcha();
    } else {
      getUpdatedRewardData();
    }
  };
  messaging.send(
      'popupPanel',
      { what: 'getCaptchaStatus'},
      onStatusReceived
  );
};

/******************************************************************************/
  var createSVGdocument = function(svgText) {
    return new DOMParser().parseFromString(svgText,'image/svg+xml');
  };

  var showCaptcha = function() {
    var onCaptchaReceived = function(response) {
      if (!response) {
        var errorField = uDom.nodeFromId("input-captcha-overlay-error");
        errorField.textContent = vAPI.i18n('getCaptchaError');
        errorField.parentElement.classList.add("has-danger");
        return console.log("error getting captcha");
      }
      showOverlay("captchaOverlay", {
        svgCaptcha: response,
      });

    };
    messaging.send(
        'popupPanel',
        { what: 'getCaptcha'},
        onCaptchaReceived
    );
};

/******************************************************************************/

var renderCaptchaLoading = function(loading) {
  if (loading) {
    uDom(".captchaLoading").addClass("loading");
  } else {
    uDom(".captchaLoading").removeClass("loading");
  }
};

/******************************************************************************/

  var sendCaptchaAnswerAndContinue = function(solution) {
    var onResponseReceived = function(response) {
      renderCaptchaLoading(false);
      if (!response) {
        var errorField = uDom.nodeFromId("input-captcha-overlay-error");
        errorField.textContent = vAPI.i18n('wrongCaptchaError');
        errorField.parentElement.classList.add("has-danger");
        showCaptcha();
        return console.log("error wrong captcha");
      }
      updatePopupData({captchaValidated: true});
      getUpdatedRewardData();
      hideOverlay("captchaOverlay");
    };
    renderCaptchaLoading(true);
    messaging.send(
        'popupPanel',
        { what: 'sendCaptchaAnswerAndContinue', 'solution': solution},
        onResponseReceived
    );
};
/******************************************************************************/

  var getChartData = function(callback) {
    var onChartDataReceived = function(response) {
      if (!response) {
        console.log("error getting chart data");
        return callback && callback(false);
      }
      chartData = response;
      callback && callback(response)
    };
    messaging.send(
        'popupPanel',
        { what: 'getChartData'},
        onChartDataReceived
    );
};

/******************************************************************************/

var tooltipClosing = false;
var tooltipTimeBeforeShow = 500;
var tooltipTimeout = null;
var moveOutWhenDone = function() {
  var tip = uDom.nodeFromId('tooltip');
  if (tooltipClosing) {
    tip.style.left = "";
    tip.style.top = "";
    tip.style.bottom = "";
    tip.style.setProperty('right', '-1000px');
    tip.classList.remove("bs-tooltip-top");
    tip.classList.remove("bs-tooltip-bottom");
    uDom.nodeFromId('templates').appendChild(tip);
    tooltipClosing = false;
  }
  tip.removeEventListener("transitionend", moveOutWhenDone, false);
};

var onShowTooltipDelayed = function() {
    tooltipTimeout = null;
    moveOutWhenDone();
    var target = this;

    // Tooltip container
    var ttc = uDom(target).ancestors('.tooltipContainer').nodeAt(0) ||
              document.body;
    var ttcRect = ttc.getBoundingClientRect();

    // Tooltip itself
    var tip = uDom.nodeFromId('tooltip');
    var tipArrow = uDom.nodeFromId('tooltip-arrow');
    var tipText = uDom.nodeFromId('tooltip-text');
    tipText.textContent = target.getAttribute('data-tip');
    ttc.appendChild(tip);
    tip.offsetWidth;
    var tipRect = tip.getBoundingClientRect();
    // Target rect
    var targetRect = target.getBoundingClientRect();

    // Default is "over"
    var pos;
    var over = target.getAttribute('data-tip-position') !== 'under';
    if ( over ) {
        pos = ttcRect.height - targetRect.top + ttcRect.top + 1;
        tip.style.setProperty('bottom', pos + 'px');
        tip.classList.add("bs-tooltip-top");
    } else {
        pos = targetRect.bottom - ttcRect.top  + 1;
        tip.style.setProperty('top', pos + 'px');
        tip.classList.add("bs-tooltip-bottom");
    }
    var horizontalTargetCenter = (targetRect.left + targetRect.right)/2;
    var tipWidth = tipRect.width;
    var left = horizontalTargetCenter - tipWidth/2;
    var right = null;
    if (left + tipWidth > ttcRect.right) {
      left -= (left + tipWidth - ttcRect.right);
      left -= 7;
    }
    if (left < 7) {
      left = 7;
    }
    var right = ttcRect.width - (left + tipWidth);
    tip.style.setProperty('left', left + 'px');
    tip.style.setProperty('right', right + 'px');
    var arrowLeft = horizontalTargetCenter - left;
    tipArrow.style.setProperty('left', arrowLeft + 'px');
    tip.classList.add('show');
};

var onShowTooltip = function() {
  if ( popupData.tooltipsDisabled ) {
      return;
  }
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }
  tooltipTimeout = setTimeout(onShowTooltipDelayed.bind(this), tooltipTimeBeforeShow);
};

var onHideTooltip = function() {
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
  var tip = uDom.nodeFromId('tooltip');
  tooltipClosing = true;
  tip.addEventListener("transitionend", moveOutWhenDone, false);
  tip.classList.remove('show');
};

/******************************************************************************/

// Popup DOM is assumed to be loaded at this point -- because this script
// is loaded after everything else..

(function() {
    // If there's no tab id specified in the query string,
    // it will default to current tab.
    var tabId = null;

    // Extract the tab id of the page this popup is for
    var matches = window.location.search.match(/[\?&]tabId=([^&]+)/);
    if ( matches && matches.length === 2 ) {
        tabId = matches[1];
    }

    toggleButtons = {
      noPopup:             uDom('#no-popups'),
      noLargeMedia:        uDom('#no-large-media'),
      noCosmeticFiltering: uDom('#no-cosmetic-filtering'),
      noRemoteFonts:       uDom('#no-remote-fonts')
    };

    getPopupData(tabId);

    //open close dropdown (side menu)
    var dropdown = uDom.nodeFromId("m_quick_sidebar");
    var slideDropdown = function() {
      dropdown.style.right = 0;
    };

    var slideBackDropdown = function() {
      dropdown.style.right = null;
    };

    uDom('#dropdown-toggle').on("click",slideDropdown);
    uDom('#m_quick_sidebar_close').on("click",slideBackDropdown);


    //change tab
    var tabs = {
      params: uDom('#params-tab'),
      stats:  uDom('#stats-tab'),
      data:   uDom('#data-tab'),
    };
    var panes = {
      params: uDom('#params-pane'),
      stats:  uDom('#stats-pane'),
      data:  uDom('#data-pane')
    };

    var openPane = function(paneName) {
      var activePane = uDom('.tab-pane.active');
      var activeTab = uDom('.nav-link.active');
      activePane.first().removeClass("active");
      activeTab.first().removeClass("active");
      panes[paneName].addClass("active");
      tabs[paneName].addClass("active");
    };

    var drawChart = function(exp) {
      if (Dashboard.drawn) {
        return;
      }
      if (Dashboard.initiated) {
        if (chartData) {
          Dashboard.draw(chartData);
        }
      } else {
        var newExp = (exp || 100) * 2;
        console.log("chart not initiated");
        setTimeout(function() {drawChart(newExp)}, newExp);
      }
    };

    var openFunctions = {
      params: function() {openPane("params")},
      stats:  function() {
        openPane("stats");
        if (chartData) {
          drawChart();
        } else {
          getChartData(function() {
            drawChart();
          });
        }
      },
      data: function() {openPane("data")}
    };
    for (var tab in tabs) {
      if (tabs.hasOwnProperty(tab)) {
        tabs[tab].on('click', openFunctions[tab]);
      }
    }

    uDom('#switch').on('click', toggleNetFilteringSwitch);
    // uDom('#gotoZap').on('click', gotoZap);
    // uDom('#gotoPick').on('click', gotoPick);
    uDom('#address-title').on('click', gotoEtherscan);
    uDom('#refresh').on('click', reloadTab);
    uDom('.hnSwitch').on('click', toggleHostnameSwitch);
    // uDom('#saveRules').on('click', saveFirewallRules);
    // uDom('#revertRules').on('click', revertFirewallRules);
    uDom('#address-clipboard-button').on('click', function() {copyAdressToClipboard("address-field")});
    uDom('#seed-clipboard-button').on('click', function() {copyAdressToClipboard("seed-field")});
    uDom('#seed-save-button').on('click', saveSeed);

    // uDom('[data-i18n="popupAnyRulePrompt"]').on('click', toggleMinimize);

    uDom('body').on('mouseenter', '[data-tip]', onShowTooltip)
                .on('mouseleave', '[data-tip]', onHideTooltip);

    // uDom('a[href]').on('click', gotoURL);
    uDom('.btn-parameter[href]').on('click', gotoURL);
    // uDom('#settings-button').on("click",function(ev) {
    //   gotoInternal(ev,"dashboard.html");
    // });
    // uDom('#logger-button').on("click",function(ev) {
    //   gotoInternal(ev,"logger-ui.html");
    // });

    uDom('#create-wallet-button').on('click', onCreateWallet);
    uDom('#import-wallet-button').on('click', onImportWallet);

    uDom('#import-wallet-method-button-overlay').on('click', showWalletImport);
    uDom('#import-address-method-button-overlay').on('click', showAddressImport);

    uDom('#create-wallet-button-overlay').on('click', createWalletFromOverlay);
    uDom('#cancel-create-wallet-button-overlay').on('click',  function(ev){ev.preventDefault();hideOverlay("createWalletOverlay");});

    uDom('#import-wallet-button-overlay').on('click', importWalletFromOverlay);
    uDom('#cancel-import-wallet-button-overlay').on('click', function(ev){ev.preventDefault();hideOverlay("importWalletOverlay");});

    uDom('#import-address-button-overlay').on('click', importAddressFromOverlay);
    uDom('#cancel-import-address-button-overlay').on('click', function(ev){ev.preventDefault();hideOverlay("importWalletOverlay");});

    uDom('#show-seed-button-overlay').on('click', function(ev){ev.preventDefault();closeSeedOverlay();});

    uDom('#passCaptchaButton').on('click', showCaptchaIfNotValidated);
    uDom('#change-captcha').on('click', showCaptcha);
    uDom('#input-captcha-button-overlay').on('click', sendCaptchaAnswerFromOverlay);
    uDom('#no-captcha-button-overlay').on('click', function(ev){
      ev.preventDefault();
      updatePopupData({captchaValidated: false});
      getUpdatedRewardData();
      hideOverlay("captchaOverlay");
    });

    uDom('#import-referral-button-overlay').on('click', importReferralFromOverlay);
    uDom('#no-referral-button-overlay').on('click', function(ev){ev.preventDefault();hideOverlay("referralInputOverlay");});

    uDom('#info-validate-button-overlay').on('click', function(ev){ev.preventDefault();hideOverlay("infoOverlay");});
    uDom('.overlayClose').on('click', function(){hideOverlay("all");});
    uDom('#close-notification').on('click', function(ev){ev.preventDefault();hideNotification();});
})();

window.addEventListener("load", function(event) { //on document ready
  allScriptsLoaded = true;
  Dashboard.init();
});
/******************************************************************************/

})();
