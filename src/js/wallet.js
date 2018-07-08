/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2014-2016 Raymond Hill

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

/* global uDom, uBlockDashboard */

/******************************************************************************/

(function() {

'use strict';

/******************************************************************************/

var messaging = vAPI.messaging;
var walletInfoStore = null;
/******************************************************************************/

function renderExportField(exportValues) {
  if (!exportValues || exportValues.address !== walletInfoStore.walletAddress) {
    return;
  }
  var passwordField = uDom.nodeFromId("export-privkey-password");
  passwordField.value = "";
  var seedInput = uDom.nodeFromId("seed-field");
  seedInput.value = exportValues.seed;
  var privKeyInput = uDom.nodeFromId("privkey-field");
  privKeyInput.value = exportValues.privKey;
  uDom.nodeFromId('hidePrivKeyButton').style.setProperty("display", "inline-block");
  uDom.nodeFromId('exportData').style.setProperty("display", "block");

}
/******************************************************************************/

function onHideExport() {
  var seedInput = uDom.nodeFromId("seed-field");
  seedInput.value = "";
  var privKeyInput = uDom.nodeFromId("privkey-field");
  privKeyInput.value = "";
  uDom.nodeFromId('hidePrivKeyButton').style.setProperty("display", "none");
  uDom.nodeFromId('exportData').style.setProperty("display", "none");
}

/******************************************************************************/

function onLockWallet() {
  var onLockHandler = function() {
    uDom.nodeFromId('lockWallet').style.setProperty("display", "none");
  };
  messaging.send('dashboard', { what: 'lockWallet' }, onLockHandler);
}

/******************************************************************************/

function onExportWallet() {
  var errorMessage = uDom.nodeFromId("errorMessage");
  var onExportHandler = function(exportValues) {
    console.log(exportValues);
    if (typeof exportValues === "string") {
      errorMessage.textContent = exportValues;
      return;
    }
    /*{
      address: string,
      privKey: string,
      seed: string
    }*/
    uDom.nodeFromId('lockWallet').style.setProperty("display", "block");
    renderExportField(exportValues);
  }
  errorMessage.textContent = "";
  var passwordField = uDom.nodeFromId("export-privkey-password");
  var pass1 = passwordField.value;
  messaging.send('dashboard', { what: 'exportWalletInfo', password: pass1 }, onExportHandler);
}

/******************************************************************************/

function onDeleteWallet() {
  var errorField = uDom.nodeFromId("delete-wallet-overlay-error");
  var onDeleteHandler = function(success) {
    if (!success) {
      errorField.textContent = vAPI.i18n('passwordError');
      return console.log("error deleting wallet");
    }
    hideOverlay("delete-modal");
    renderWalletInfo();
  }
  errorField.textContent = "";
  var pass1 = null;
  if (walletInfoStore && !walletInfoStore.onlyAddress) {
    var passwordField = uDom.nodeFromId("delete-wallet-password");
    pass1 = passwordField.value;
  }
  messaging.send('dashboard', { what: 'deleteWallet', password: pass1}, onDeleteHandler);
}

/******************************************************************************/

function onRestoreWallet() {
  var errorField = uDom.nodeFromId("restore-wallet-overlay-error");
  errorField.textContent = "";
  var seedErrorField = uDom.nodeFromId("restore-wallet-overlay-seed-error");
  seedErrorField.textContent = "";
  var onRestoreHandler = function(walletInfo) {
    if (typeof walletInfo === "string") {
      if (walletInfo.indexOf("i18n-") === 0) {
        seedErrorField.textContent = vAPI.i18n(walletInfo.substr(5));
      } else {
        errorField.textContent = vAPI.i18n('passwordError');
      }
      return;
    }
    hideOverlay("restore-modal");
    renderWalletInfo();
  }

  var passwordField1 = uDom.nodeFromId("restore-wallet-new-password");
  var pass1 = passwordField1.value;
  var passwordField2 = uDom.nodeFromId("restore-wallet-new-password-duplicate");
  var pass2 = passwordField2.value;
  var seedField = uDom.nodeFromId("restore-wallet-seed");
  var seed = seedField.value;
  if (seed === "" || seed.split(" ").length !== 12) {
    seedErrorField.textContent = vAPI.i18n('seedInvalidError');
    return;
  }
  if (pass1 !== pass2 || pass1 === "") {
    errorField.textContent = vAPI.i18n('passwordMismatchError');
    return;
  }
  messaging.send('dashboard', { what: 'restoreWalletFromSeed', password: pass1, seed: seed}, onRestoreHandler);
}

/******************************************************************************/

function onChangePassword() {
  var errorField = uDom.nodeFromId("change-password-overlay-error");
  var oldErrorField = uDom.nodeFromId("change-password-overlay-old-error");
  errorField.textContent = "";
  oldErrorField.textContent = "";
  var onChangeHandler = function(walletInfo) {
    if (typeof walletInfo === "string") {
      oldErrorField.textContent = vAPI.i18n('passwordError');
      return;
    }
    hideOverlay("change-password-modal");
    renderWalletInfo();
  }
  var passwordField1 = uDom.nodeFromId("change-password-new-password");
  var pass1 = passwordField1.value;
  var passwordField2 = uDom.nodeFromId("change-password-new-password-duplicate");
  var pass2 = passwordField2.value;
  var oldPassField = uDom.nodeFromId("change-password-old-password");
  var oldPass = oldPassField.value;
  if (oldPass === "") {
    oldErrorField.textContent = vAPI.i18n('passwordError');
    return;
  }
  if (pass1 !== pass2) {
    errorField.textContent = vAPI.i18n('passwordMismatchError');
    return;
  }  else if (pass1.length < µConfig.minimalPasswordLength) {
    errorField.textContent = vAPI.i18n('passwordTooShortError').replace("{{minLength}}", µConfig.minimalPasswordLength);
    return;
  }
  messaging.send('dashboard', { what: 'changePassword', currentPassword: oldPass, newPassword: pass1}, onChangeHandler);

}

/******************************************************************************/

function renderWalletInfo() {
    var onRead = function(walletInfo) {
      /* {
        hasWallet: boolean,
        walletAddress: string,
        totalRewardCount: number,
        onlyAddress: boolean,
      };*/
        if ( !walletInfo.hasWallet) {
          uDom.nodeFromId('walletAddress').textContent = vAPI.i18n('noWalletText');
        } else {
          walletInfoStore = walletInfo;
          uDom.nodeFromId('walletAddress').textContent = walletInfo.walletAddress;
        }
        if (walletInfo.hasWallet) {
          uDom.nodeFromId('basicWalletFunctions').style.setProperty("display", "block");
        } else {
          uDom.nodeFromId('basicWalletFunctions').style.setProperty("display", "none");
        }
        if (walletInfo.hasWallet && !walletInfo.onlyAddress) {
          uDom.nodeFromId('walletFunctions').style.setProperty("display", "block");
        } else {
          uDom.nodeFromId('walletFunctions').style.setProperty("display", "none");
        }
        if (walletInfo.isUnlocked) {
          uDom.nodeFromId('lockWallet').style.setProperty("display", "block");
        } else {
          uDom.nodeFromId('lockWallet').style.setProperty("display", "none");
        }
    };
    messaging.send('dashboard', { what: 'getWalletInfo' }, onRead);
}

/******************************************************************************/

var copyAdressToClipboard = function(field) {
  var addressInput = uDom.nodeFromId(field+"-field");
  var button = uDom.nodeFromId(field+"-clipboard-button");
  var resetButton = function() {
    if (button && button.innerHTML) {
      button.innerHTML = "&#xf0c5;"
      button.style.setProperty("color", "#71727B");
    }
  }
  if (addressInput && addressInput.select){
    addressInput.focus();
    addressInput.select();
    document.execCommand("copy");
    addressInput.blur();
    button.innerHTML = "&#xf00c;"
    button.style.setProperty("color", "#19cc58");
    vAPI.setTimeout(resetButton, 2000);
  }

}

var hideOverlay = function(overlayId) {
  var overlaysContainer = uDom.nodeFromId("modal-overlay");
  var overlaysList = uDom.nodesFromClass("modal-window");
  if (overlayId === "delete-modal" || overlayId === "all") {
    uDom.nodeFromId('delete-overlay-password-div').style.setProperty("display", "none");
    var passwordField = uDom.nodeFromId("delete-wallet-password");
    passwordField.value = "";
  } else if (overlayId === "restore-modal" || overlayId === "all") {
    var seedField = uDom.nodeFromId("restore-wallet-seed");
    seedField.value = "";
    var passwordField1 = uDom.nodeFromId("restore-wallet-new-password");
    passwordField1.value = "";
    var passwordField2 = uDom.nodeFromId("restore-wallet-new-password-duplicate");
    passwordField2.value = "";
  } else if (overlayId === "change-password-modal" || overlayId === "all") {
    var passwordFieldOld = uDom.nodeFromId("change-password-old-password");
    passwordFieldOld.value = "";
    var passwordField1 = uDom.nodeFromId("change-password-new-password");
    passwordField1.value = "";
    var passwordField2 = uDom.nodeFromId("change-password-new-password-duplicate");
    passwordField2.value = "";
  }
  for (var i = 0; i < overlaysList.length; i++) {
    overlaysList[i].style.setProperty("display", "none");
  }
  overlaysContainer.style.setProperty("display", "none");
}
/******************************************************************************/

var openDeleteModal = function() {
  uDom.nodeFromId('modal-overlay').style.setProperty("display", "block");
  uDom.nodeFromId('delete-modal').style.setProperty("display", "block");
  if (walletInfoStore && !walletInfoStore.onlyAddress) {
    uDom.nodeFromId('delete-overlay-password-div').style.setProperty("display", "block");
  }
};

var openRestoreModal = function() {
  uDom.nodeFromId('modal-overlay').style.setProperty("display", "block");
  uDom.nodeFromId('restore-modal').style.setProperty("display", "block");
};

var openChangePasswordModal = function() {
  uDom.nodeFromId('modal-overlay').style.setProperty("display", "block");
  uDom.nodeFromId('change-password-modal').style.setProperty("display", "block");
};

renderWalletInfo();

uDom('#seed-clipboard-button').on('click', function() {copyAdressToClipboard("seed");});
uDom('#privkey-clipboard-button').on('click', function() {copyAdressToClipboard("privkey");});
uDom('#delete-wallet-button').on('click', openDeleteModal);
uDom('#delete-wallet-button-overlay').on('click', onDeleteWallet);
uDom('#lock-wallet-button').on('click', onLockWallet);
uDom('#exportPrivKeyButton').on('click', onExportWallet);
uDom('#hidePrivKeyButton').on('click', onHideExport);
uDom('#change-password-button').on('click', openChangePasswordModal);
uDom('#restore-password-button').on('click', openRestoreModal);
uDom('#change-password-button-overlay').on('click', onChangePassword);
uDom('#restore-wallet-button-overlay').on('click', onRestoreWallet);
uDom('#cancel-change-password-button-overlay').on('click', function() {hideOverlay("change-password-modal");});
uDom('#cancel-restore-wallet-button-overlay').on('click', function() {hideOverlay("restore-modal");});
uDom('#cancel-delete-wallet-button-overlay').on('click', function() {hideOverlay("delete-modal");});

uDom('.overlayClose').on('click', function(){hideOverlay("all");})

/******************************************************************************/

})();
