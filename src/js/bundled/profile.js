/*******************************************************************************

 Varanida - a browser extension to block requests.
 Copyright (C) 2018 Varanida

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

 Home: https://github.com/Varanida/varanida-extension/
 */

/******************************************************************************/

(function() {

    'use strict';

    /******************************************************************************/

    var messaging = vAPI.messaging;
    var password = undefined;
    var privkey = undefined;
    var userDataStore = undefined;
    var walletInfoStore = undefined;
    var walletIsUnlocked = false;

    /******************************************************************************/

    var testLevel = function(level) {
      var lvlStr = "level"+level;
      if (!userDataStore || !userDataStore[lvlStr]) {
        return false;
      }
      var levelStructure = µProfileConfig.userDataStructure[lvlStr];
      var levelStore = userDataStore[lvlStr];
      for (var i = 0; i < levelStructure.length; i++) {
        if (
          !levelStore[levelStructure[i].name] ||
          typeof levelStore[levelStructure[i].name] !== levelStructure[i].type
        ) {
          return false;
        }
      }
      return true;
    };

    var calculateNewCompletionLevel = function() {
        if (testLevel(1)) {
            if (testLevel(2)) {
                if (testLevel(3)) {
                    return 3;
                } else {
                    return 2;
                }
            } else {
                return 1;
            }
        } else {
            return 0;
        }
    };

    /******************************************************************************/

    var displayCompletionLevel = function(level) {

        uDom(".currentLevel").text(level);

        uDom.nodeFromId('profileLevel3Checked').style.setProperty("display", level > 2 ? "block" : "none");
        uDom.nodeFromId('profileLevel2Checked').style.setProperty("display", level > 1 ? "block" : "none");
        uDom.nodeFromId('profileLevel1Checked').style.setProperty("display", level > 0 ? "block" : "none");
    };
    /******************************************************************************/

    var browseLevels = function(ev) {
        uDom('.m-wizard__step').removeClass("m-wizard__step--current");
        uDom(this).addClass("m-wizard__step--current");
        uDom('.m-wizard__form-step').removeClass("m-wizard__form-step--current");
        var level = this.getAttribute("data-level");
        uDom('#m_wizard_form_step_'+level).addClass("m-wizard__form-step--current");
        displayInfoLevel(level);
    };
    /******************************************************************************/

    var displayInfoLevel = function(level) {
        var dataSettingsBonusStr = vAPI.i18n('popupDataSettingsBonus');
        var bonus = µConfig.rewards.bonusPercentageForData[level];
        uDom.nodeFromId('dataBonusInfo').textContent = vAPI.i18n('popupDataSettingsBonus').replace('{{bonus}}', bonus);
    };

    /******************************************************************************/

    var changeUserProfile = function(level, name, value) {
        if (!userDataStore) {
            userDataStore = {};
        }
        if (!userDataStore['level'+level]) {
            userDataStore['level'+level] = {};
        }
        userDataStore['level'+level][name] = value;

        //Display level
        displayCompletionLevel(calculateNewCompletionLevel());
    };

    /******************************************************************************/

    var getUserValue = function(level, name) {
        if (userDataStore && userDataStore['level'+level]) {
            return userDataStore['level'+level][name];
        } else {
            return undefined;
        }
    };

    /******************************************************************************/

    var onDateInputChanged = function(ev) {
        const input = ev.target;
        const level = this.getAttribute('data-setting-level');
        const name = this.getAttribute('data-setting-name');
        const type = this.getAttribute('data-setting-type');
        const max = this.getAttribute('max');
        const min = this.getAttribute('min');
        // We check the value is between max and min
        let value = input.value;
        if (value > max) {
            value = max;
            input.value = value;
        } else if (value < min) {
            value = min;
            input.value = value;
        }

        let old_value = getUserValue(level, name); // We fetch old value
        old_value = old_value ? old_value.split('/') : []; // We split it in a single array
        old_value = old_value.length === 3 ? old_value : [1, 1, 1970]; // We check the array contain a day / month /year
        switch (this.getAttribute('id').split('-').slice(-1).pop()) {
            case 'day':
                old_value[0] = value;
                break;
            case 'month':
                old_value[1] = value;
                break;
            case 'year':
                old_value[2] = value;
                break;
            default:
                return;
        }
        const new_value = old_value.join('/'); // We apply updated array to value
        changeUserProfile(level, name, new_value);
    };

    /******************************************************************************/

    var onInputChanged = function(ev) {
        const input = ev.target;
        const level = this.getAttribute('data-setting-level');
        const name = this.getAttribute('data-setting-name');
        const type = this.getAttribute('data-setting-type');
        let value = input.value;
        if (type === "checkbox"){
            value = uDom(this).prop('checked');
        }
        if (type === "date"){
            // should not use this for a date
            return;
        }
        if ( value !== input.value) {
            input.value = value;
        }
        changeUserProfile(level, name, value);
    };

    /******************************************************************************/

    var onPreventDefault = function(ev) {
        ev.target.focus();
        ev.preventDefault();
    };

    /******************************************************************************/

    var initDropDown = function(element, configList) {
      for (var i = 0; i < configList.length; i++) {
        var opt = configList[i];
        var el = document.createElement("option");
        if (opt.name) {
          el.textContent = opt.name;
        } else if (opt.i18n) {
          el.textContent = vAPI.i18n(opt.i18n);
        }
        el.value = opt.id;
        element.appendChild(el);
      }
    };

    /******************************************************************************/

    var initLanguageDropDown = function(element, configList) {
      var locale = navigator.language;
      var localeStr = null;
      var placedLocale = false;
      if (navigator.languages && navigator.languages.length > 0) {
          locale = navigator.languages[0];
      }
      localeStr = locale.split('-')[0].toLowerCase();
      if (localeStr) {
        for (var j = 0; j < configList.length; j++) {
          if (configList[j].id === localeStr) {
            var localEl = document.createElement("option");
            localEl.textContent = configList[j].name;
            localEl.value = configList[j].id;
            element.appendChild(localEl);
            placedLocale = true;
            break;
          }
        }
      }
      var opt, el;
      for (var i = 0; i < configList.length; i++) {
        opt = configList[i];
        if (placedLocale && opt.id === localeStr) {
          continue;
        }
        el = document.createElement("option");
        el.textContent = opt.name;
        el.value = opt.id;
        element.appendChild(el);
      }
    };

    /******************************************************************************/

    var renderProfileLoading = function(loading) {
      if (loading) {
        uDom(".profileLoading").addClass("loading");
      } else {
        uDom(".profileLoading").removeClass("loading");
      }
    };

    /******************************************************************************/

    var onUserDataReceived = function(data) {
        renderProfileLoading(false);
        var errorMessage = uDom.nodeFromId("errorUnlockWalletMessage");
        if (typeof data !== 'string') {
            userDataStore = data;
            walletIsUnlocked = true;
            uDom('[data-setting-type="input"]').forEach(function(uNode) {
                if (data['level'+uNode.attr('data-setting-level')]) {
                    uNode.val(data['level'+uNode.attr('data-setting-level')][uNode.attr('data-setting-name')]);
                }
            });
            uDom('[data-setting-type="date"]').forEach(function(uNode) {
                if (data['level'+uNode.attr('data-setting-level')]) {
                    let date_val = data['level'+uNode.attr('data-setting-level')][uNode.attr('data-setting-name')];
                    date_val = date_val ? date_val.split('/') : [undefined, undefined, undefined];
                    date_val = Array.isArray(date_val) && date_val.length === 3 ? date_val : [undefined, undefined, undefined];
                    switch (uNode.attr('id').split('-').slice(-1).pop()) {
                        case 'day':
                            uNode.val(date_val[0]);
                            break;
                        case 'month':
                            uNode.val(date_val[1]);
                            break;
                        case 'year':
                            uNode.val(date_val[2]);
                            break;
                    }
                }
            });
            uDom('[data-setting-type="checkbox"]').forEach(function(uNode) {
                if (data['level'+uNode.attr('data-setting-level')]) {
                    uNode.prop('checked', data['level'+uNode.attr('data-setting-level')][uNode.attr('data-setting-name')] === true);
                }
            });
            uDom('[data-setting-type="radio"]').forEach(function(uNode) {
                if (data['level'+uNode.attr('data-setting-level')]) {
                    uNode.prop('checked', data['level'+uNode.attr('data-setting-level')][uNode.attr('data-setting-name')] === uNode.attr('value'));
                }
            });
            renderPage();
            displayCompletionLevel(calculateNewCompletionLevel());
            errorMessage.textContent = "";
            uDom.nodeFromId('errorUnlockWalletBlock').style.setProperty("display", "none");
            uDom.nodeFromId("unlock-password").value = "";
            uDom.nodeFromId("unlock-privkey").value = "";
        } else {
            if (data.indexOf("i18n-") === 0) {
              errorMessage.textContent = vAPI.i18n(data.substr(5));
            } else {
              if (walletInfoStore && walletInfoStore.onlyAddress) {
                errorMessage.textContent = vAPI.i18n('privKeyError');
              } else {
                errorMessage.textContent = vAPI.i18n('passwordError');
              }
            }
            uDom.nodeFromId('errorUnlockWalletBlock').style.setProperty("display", "block");
        }
    };

    /******************************************************************************/

    var afterSave = function(saveError) {
      if (!saveError) {
        const button = uDom.nodeFromId("profileSaveButton");
        const resetButton = function() {
          if (button && button.innerHTML) {
            button.innerHTML =
            '<span>'+
                '<i class="la la-save"></i>'+
                '<span data-i18n="profileSave">'+vAPI.i18n("profileSave")+'</span>'+
            '</span>';
          }
        };
        button.innerHTML =
        '<span>'+
            '<i class="la la-check"></i>'+
            '<span>'+vAPI.i18n("profileSaved")+'</span>'+
        '</span>';
        vAPI.setTimeout(resetButton, 2000);
    }
    };

    var onProfileSave = function() {
        let newCompletionLevel = calculateNewCompletionLevel();
        messaging.send(
            'dashboard',
            {
                what: 'setUserData',
                password: password,
                privKey: privkey,
                newCompletionLevel: newCompletionLevel,
                data: userDataStore
            },
            afterSave
        );
    };

    /******************************************************************************/

    var renderPage = function() {
        if ( !walletInfoStore || !walletInfoStore.hasWallet) {
            uDom.nodeFromId('userProfileForm').style.setProperty("display", "none");
            uDom.nodeFromId('userUnlockWallet').style.setProperty("display", "none");
            uDom.nodeFromId('userHasNoWallet').style.setProperty("display", "block");
        } else if ( !walletIsUnlocked ) {
            uDom.nodeFromId('userProfileForm').style.setProperty("display", "none");
            uDom.nodeFromId('userUnlockWallet').style.setProperty("display", "block");
            uDom.nodeFromId('errorUnlockWalletBlock').style.setProperty("display", "none");
            uDom.nodeFromId('userHasNoWallet').style.setProperty("display", "none");
            if ( walletInfoStore && walletInfoStore.onlyAddress ) {
                uDom.nodeFromId('userUnlockWalletWithPassword').style.setProperty("display", "none");
                uDom.nodeFromId('userUnlockWalletWithPrivkey').style.setProperty("display", "block");
            } else {
                uDom.nodeFromId('userUnlockWalletWithPassword').style.setProperty("display", "block");
                uDom.nodeFromId('userUnlockWalletWithPrivkey').style.setProperty("display", "none");
            }
        } else {
            uDom.nodeFromId('userProfileForm').style.setProperty("display", "block");
            uDom.nodeFromId('userUnlockWallet').style.setProperty("display", "none");
            uDom.nodeFromId('userHasNoWallet').style.setProperty("display", "none");
        }
    };

    /******************************************************************************/

    var onUnlockWallet = function() {
        renderProfileLoading(true);
        password = uDom.nodeFromId("unlock-password").value;
        privkey = uDom.nodeFromId("unlock-privkey").value;
        messaging.send('dashboard', { what: 'getUserData', password: password , privKey: privkey}, onUserDataReceived);
    };

    /******************************************************************************/

    var onLockWallet = function() {
        var onLockHandler = function() {
            password = undefined;
            privkey = undefined;
            userDataStore = undefined;
            walletIsUnlocked = false;
            renderPage();
        };
        messaging.send('dashboard', { what: 'lockWallet' }, onLockHandler);
    };

    /******************************************************************************/

    var onReadWalletInfo = function(walletInfo) {
        walletInfoStore = walletInfo;
        if (walletInfo && walletInfo.isUnlocked === true) {
            walletIsUnlocked = true;
            onUnlockWallet();
        } else {
            renderPage();
        }
    };

    /******************************************************************************/

    uDom.onLoad(function() {
        messaging.send('dashboard', { what: 'getWalletInfo' }, onReadWalletInfo);
        uDom('#unlockWalletButton').on('click', onUnlockWallet);
        uDom('.unlock-wallet-field').on("keyup", function(event) {
          event.preventDefault();
          if (event.keyCode === 13) {
            onUnlockWallet();
          }
        });
        initDropDown(uDom.nodeFromId("user-city"), µProfileConfig.countryList);
        initDropDown(uDom.nodeFromId("user-industry"), µProfileConfig.industryList);
        initLanguageDropDown(uDom.nodeFromId("user-mother-tongue"), µProfileConfig.languageList);
        uDom('#lockWalletButton').on('click', onLockWallet);
        uDom('#profileSaveButton').on('click', onProfileSave);
        uDom('[data-setting-type="input"]').forEach(function(uNode) {
            uNode.on('change', onInputChanged).on('click', onPreventDefault);
        });
        uDom('[data-setting-type="date"]').forEach(function(uNode) {
            uNode.on('change', onDateInputChanged).on('click', onPreventDefault);
        });
        uDom('[data-setting-type="checkbox"]').forEach(function(uNode) {
            uNode.on('click', onInputChanged);
        });
        uDom('[data-setting-type="radio"]').forEach(function(uNode) {
            uNode.on('click', onInputChanged);
        });
        uDom('.m-wizard__step').on('click', browseLevels);
        displayInfoLevel(1);
    });

    /******************************************************************************/

})();
