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
var walletAddressMem = null;
/******************************************************************************/

function renderExportField(exportValues) {
  if (!exportValues || exportValues.address !== walletAddressMem) {
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

function onExportWallet() {
  var onExportHandler = function(exportValues) {
    console.log(exportValues);
    var errorMessage = uDom.nodeFromId("errorMessage");
    if (exportValues instanceof Error) {
      errorMessage.textContent = "wrong password!";
      return;
    }
    errorMessage.textContent = "";
    /*{
      address: string,
      privKey: string,
      seed: string
    }*/
    renderExportField(exportValues);
  }
  var passwordField = uDom.nodeFromId("export-privkey-password");
  var pass1 = passwordField.value;
  messaging.send('dashboard', { what: 'exportWalletInfo', password: pass1 }, onExportHandler);
}

/******************************************************************************/

function renderWalletInfo() {
    var onRead = function(walletInfo) {
      /* {
        hasWallet: boolean,
        walletAddress: string,
        totalRewardCount: number
      };*/
        if ( !walletInfo.hasWallet) {
          uDom.nodeFromId('walletAddress').textContent = vAPI.i18n('noWalletText');
          return;
        }
        walletAddressMem = walletInfo.walletAddress;
        uDom.nodeFromId('walletAddress').textContent = walletInfo.walletAddress;
        uDom.nodeFromId('walletFunctions').style.setProperty("display", "block");
        var textarea = uDom.nodeFromId('userFilters');
        uDom('#exportPrivKeyButton').on('click', onExportWallet);
        uDom('#hidePrivKeyButton').on('click', onHideExport);
        hidePrivKeyButton
    };
    messaging.send('dashboard', { what: 'getWalletInfo' }, onRead);
}

/******************************************************************************/

// Handle user interaction
// uDom('#userFiltersRevert').on('click', revertChanges);

renderWalletInfo();

/******************************************************************************/

// https://www.youtube.com/watch?v=UNilsLf6eW4

})();
