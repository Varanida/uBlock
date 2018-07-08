/*******************************************************************************

    Varanida - a browser extension to block requests.
    –– data wallet component ––
    Silto (2018)

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

    Home: https://github.com/Varanida/varanida-extension
*/

const moment = require('moment');

/* whitelist utilities */

// TODO since this code is shared with ublock.js, move to a util file

// Any special regexp char will be escaped
const whitelistDirectiveEscape = /[-\/\\^$+?.()|[\]{}]/g;

// All `*` will be expanded into `.*`
const whitelistDirectiveEscapeAsterisk = /\*/g;

let directiveToRegexpMap = new Map();

// Probably manually entered whitelist directive
var isHandcraftedWhitelistDirective = function(directive) {//copied from ublock.js
    return directive.startsWith('/') && directive.endsWith('/') ||
           directive.indexOf('/') !== -1 && directive.indexOf('*') !== -1;
};

const matchDirective = function(url, hostname, directive) { //copied from ublock.js
    // Directive is a plain hostname.
    if ( directive.indexOf('/') === -1 ) {
        return hostname.endsWith(directive) &&
              (hostname.length === directive.length ||
               hostname.charAt(hostname.length - directive.length - 1) === '.');
    }
    // Match URL exactly.
    if ( directive.startsWith('/') === false && directive.indexOf('*') === -1 ) {
        return url === directive;
    }
    // Transpose into a regular expression.
    let re = directiveToRegexpMap.get(directive);
    if ( re === undefined ) {
        let reStr;
        if ( directive.startsWith('/') && directive.endsWith('/') ) {
            reStr = directive.slice(1, -1);
        } else {
            reStr = directive.replace(whitelistDirectiveEscape, '\\$&')
                             .replace(whitelistDirectiveEscapeAsterisk, '.*');
        }
        re = new RegExp(reStr);
        directiveToRegexpMap.set(directive, re);
    }
    return re.test(url);
};

var matchBucket = function(url, hostname, bucket, start) {//copied from ublock.js
    if ( bucket ) {
        for ( let i = start || 0, n = bucket.length; i < n; i++ ) {
            if ( matchDirective(url, hostname, bucket[i]) ) {
                return i;
            }
        }
    }
    return -1;
};

/*************************************************************************/

const µDataWallet = (function() {
  return {
    dataSettings: {
      dataShareLevel: 0,
      dataCompletionLevel: 0,
      dataTrackingWhitelistString: "",
    },
    tempData: {},
    tempDataCreatedOn: null,
    dataTrackingWhitelist: {}
  };
})();

µDataWallet.lockDataWallet = function() {
  // remove temp data if the wallet is locked
  this.tempData = {};
  this.tempDataCreatedOn = null;
}

/* settings handling */

µDataWallet.saveSettings = function(callback) {
    vAPI.storage.set(this.dataSettings, callback);
};

µDataWallet.updateSettings = function(updates, callback) {
  if (!updates) {
    return;
  }
  const updateKeys = Object.keys(updates);
  let hasUpdates = false;
  updateKeys.forEach(key => {
    this.dataSettings[key] = updates[key];
    hasUpdates = true;
  });
  if (hasUpdates) {
    this.saveSettings(callback);
  } else {
    callback && callback();
  }
};

/* initialization routine, executed at extension startup */

µDataWallet.init = function() {
  this.loadDataWhitelist();
  console.log("data wallet initialized");
}

µDataWallet.loadDataWhitelist = function() {
  if (!this.dataSettings.dataTrackingWhitelistString) {
    this.dataTrackingWhitelist = {};
    return;
  }
  this.dataTrackingWhitelist = µBlock.whitelistFromString(this.dataSettings.dataTrackingWhitelistString);
};

/* external functions, change interface carefully */

/* WHITELIST */

µDataWallet.saveWhitelist = function(callback) {
    const newWhitelistString = µBlock.stringFromWhitelist(this.dataTrackingWhitelist);
    this.updateSettings({
      dataTrackingWhitelistString: newWhitelistString
    }, callback);
};

µDataWallet.getDataWhitelistSwitch = function(url) {
    var targetHostname = µBlock.URI.hostnameFromURI(url),
        key = targetHostname,
        pos;
    for (;;) {
        if ( matchBucket(url, targetHostname, this.dataTrackingWhitelist[key]) !== -1 ) {
            return true;
        }
        pos = key.indexOf('.');
        if ( pos === -1 ) { break; }
        key = key.slice(pos + 1);
    }
    if ( matchBucket(url, targetHostname, this.dataTrackingWhitelist['//']) !== -1 ) {
        return true;
    }
    return false;
};

µDataWallet.toggleTrackingWhitelist = function(url, scope, newState) {
  var currentState = this.getDataWhitelistSwitch(url);
  if ( newState === undefined ) {
      newState = !currentState;
  }
  if ( newState === currentState ) {
      return currentState;
  }

  var dataTrackingWhitelist = this.dataTrackingWhitelist,
      pos = url.indexOf('#'),
      targetURL = pos !== -1 ? url.slice(0, pos) : url,
      targetHostname = µBlock.URI.hostnameFromURI(targetURL),
      key = targetHostname,
      directive = scope === 'page' ? targetURL : targetHostname;

  // Add to directive list
  if ( newState === true ) {
      if ( dataTrackingWhitelist[key] === undefined ) {
          dataTrackingWhitelist[key] = [];
      }
      dataTrackingWhitelist[key].push(directive);
      this.saveWhitelist();
      return true;
  }

  // Remove from directive list whatever causes current URL to be whitelisted
  var bucket, i;
  for (;;) {
      bucket = dataTrackingWhitelist[key];
      if ( bucket !== undefined ) {
          i = undefined;
          for (;;) {
              i = matchBucket(targetURL, targetHostname, bucket, i);
              if ( i === -1 ) { break; }
              directive = bucket.splice(i, 1)[0];
              if ( isHandcraftedWhitelistDirective(directive) ) {
                  dataTrackingWhitelist['#'].push('# ' + directive);
              }
          }
          if ( bucket.length === 0 ) {
              delete dataTrackingWhitelist[key];
          }
      }
      pos = key.indexOf('.');
      if ( pos === -1 ) { break; }
      key = key.slice(pos + 1);
  }
  bucket = dataTrackingWhitelist['//'];
  if ( bucket !== undefined ) {
      i = undefined;
      for (;;) {
          i = matchBucket(targetURL, targetHostname, bucket, i);
          if ( i === -1 ) { break; }
          directive = bucket.splice(i, 1)[0];
          if ( isHandcraftedWhitelistDirective(directive) ) {
              dataTrackingWhitelist['#'].push('# ' + directive);
          }
      }
      if ( bucket.length === 0 ) {
          delete dataTrackingWhitelist['//'];
      }
  }
  this.saveWhitelist();
  return true;
};

µDataWallet.getTrackingWhitelist = function() {
  return µBlock.stringFromWhitelist(this.dataTrackingWhitelist);
}

µDataWallet.setTrackingWhitelist = function(newWhitelistString, callback) {
  this.dataTrackingWhitelist = µBlock.whitelistFromString(newWhitelistString);
  this.saveWhitelist(callback);
}

µDataWallet.getLevels = function() {
  return {
    dataShareLevel: this.dataSettings.dataShareLevel,
    dataCompletionLevel: this.dataSettings.dataCompletionLevel
  };
};

µDataWallet.setShareLevel = function(newShareLevel, callback) {
  if (
    typeof newShareLevel !== "number" ||
    newShareLevel > this.dataSettings.dataCompletionLevel ||
    newShareLevel < 0
  ) {
    return callback && callback("Not a number or out of range");
  }
  µWallet && µWallet.setShareLevel(newShareLevel);
  this.updateSettings({
    dataShareLevel: newShareLevel
  }, callback);
};

const cleanData = function(dirtyData) {
  if (!dirtyData || typeof dirtyData !== "object") {
    return {};
  }
  let cleanData = {
    level1: undefined,
    level2: undefined,
    level3: undefined,
    completionLevel: dirtyData.completionLevel
  };
  let lvlStr,cleanLevelData,levelStructure,levelData;
  for (let level = 1; level < 4; level++) {
    lvlStr = "level"+level;
    if (dirtyData[lvlStr] && typeof dirtyData[lvlStr] === "object") {
      cleanData[lvlStr] = {};
      cleanLevelData = cleanData[lvlStr];
      levelStructure = µProfileConfig.userDataStructure[lvlStr];
      levelData = dirtyData[lvlStr];
      for (let i = 0; i < levelStructure.length; i++) {
        if (
          levelData[levelStructure[i].name] &&
          typeof levelData[levelStructure[i].name] === levelStructure[i].type
        ) {
          cleanLevelData[levelStructure[i].name] = levelData[levelStructure[i].name];
        }
      }
    }
  }
  return cleanData;
};

µDataWallet.setUserData = function(credentials, newCompletionLevel, data, callback) {
  const walletInfo = {
    hasWallet: µWallet.walletSettings.hasKeyring,
    walletAddress: µWallet.walletSettings.keyringAddress
  };
  if (!walletInfo.hasWallet || !walletInfo.walletAddress) {
    return callback && callback("no wallet available");
  }
  //verify that we have correct data to begin with
  if (
    typeof data !== "object" ||
    typeof newCompletionLevel !== "number" ||
    newCompletionLevel > 3 ||
    newCompletionLevel < 0
  ) {
    return callback && callback("Data invalid or Completion level not a number or out of range");
  }
  // sanitize data
  const cleanedData = cleanData(Object.assign(data, {completionLevel: newCompletionLevel}));
  //stringify the object to encrypt it
  let stringData;
  try {
    stringData = JSON.stringify(cleanedData);
  } catch (e) {
    return callback && callback("impossible to stringify data");
  }
  //encrypt the data
  return new Promise((resolve, reject) => {
    return µWallet.encryptAndSign(credentials, stringData, resolve);
  })
  .then((encryptedData) => {
    //add properties to the object that is sent
    const objectToSend = Object.assign({
      completionLevel: newCompletionLevel,
      publicAddress: walletInfo.walletAddress
    }, encryptedData);
    //stringify to be added as request body
    const rawStringToSend = JSON.stringify(objectToSend);
    return new Promise((resolve, reject) => {
      //post encrypted data to the API
      const xmlhttp = new XMLHttpRequest();
      const url = `${µConfig.urls.api}api/Profiles`;
      xmlhttp.onreadystatechange = function() {
        if (this.readyState === 4) {
          if (this.status === 200) {
            const responseData = JSON.parse(this.responseText);
            return resolve(responseData);
          }
          return reject("i18n-profileNetworkError");
        }
      };
      xmlhttp.open("POST", url, true);
      xmlhttp.addEventListener("error", function() {
        reject("i18n-profileNetworkError");
      });
      xmlhttp.setRequestHeader('Content-Type','application/json')
      xmlhttp.send(rawStringToSend);
    });
  })
  .then((responseData) => {
    // the data was accepted by the server, use as temporary local version
    this.tempData = cleanedData;
    if (responseData.createdOn) {
      this.tempDataCreatedOn = moment(responseData.createdOn);
    }
    //update completion setting
    let newSettings = {
      dataCompletionLevel: newCompletionLevel
    };
    if (newCompletionLevel < this.dataSettings.dataShareLevel) {
      newSettings.dataShareLevel = newCompletionLevel;
    }
    this.updateSettings(newSettings);
    //everything went fine, nothing to report
    return null;
  })
  .then(res => callback && callback(res),
    err => callback && callback(err instanceof Error? err.message : err));

}

µDataWallet.getUserData = function(credentials, callback) {
  const walletInfo = {
    hasWallet: µWallet.walletSettings.hasKeyring,
    walletAddress: µWallet.walletSettings.keyringAddress
  };
  if (!walletInfo.hasWallet || !walletInfo.walletAddress) {
    return callback && callback("no wallet available");
  }

  return new Promise((resolve, reject) => {
    //retrieve encrypted data from the API
    const xmlhttp = new XMLHttpRequest();
    const url = `${µConfig.urls.api}api/Profiles/${walletInfo.walletAddress}`;
    xmlhttp.onreadystatechange = function() {
      if (this.readyState === 4) {
        if (this.status === 200 || this.status === 304) {
          const encryptedData = JSON.parse(this.responseText);
          return resolve(encryptedData);
        } else if (this.status === 204) {
          return resolve(null);
        }
        return reject("i18n-profileNetworkError");
      }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.addEventListener("error", function() {
      reject("i18n-profileNetworkError");
    });
    xmlhttp.send();
  })
  .then((encryptedDataObject) => {
    if (!encryptedDataObject) {
      return µWallet.getOrValidatePrivKeyProm(credentials)
      .then(() => {
        return cleanData({});
      });
    }
    //don't use this data if for some reason it's older than data that is currently stored
    if (encryptedDataObject.createdOn && this.tempDataCreatedOn) {
      const encryptedDataTime = moment(encryptedDataObject.createdOn);
      if (encryptedDataTime.isSameOrBefore(this.tempDataCreatedOn, "second")) {
        return this.tempData;
      }
    }
    //decrypt data and verify signature
    return new Promise((resolve, reject) => {
      return µWallet.decryptAndVerify(credentials, encryptedDataObject, resolve);
    })
    .then((rawDataObject) => {
      // pass the error from the decryption function
      if (typeof rawDataObject !== "object") {
        return Promise.reject(rawDataObject)
      }
      // don't handle this json if the signature is invalid, who knows what's inside.
      if (!rawDataObject.isSignValid) {
        return Promise.reject("Signature invalid")
      }
      // parse the new data as json object
      let parsedData;
      try {
        parsedData = JSON.parse(rawDataObject.data);
      } catch (e) {
        return Promise.reject("Data invalid: impossible to parse")
      }
      //update the completion level if it's wrong
      if (
        parsedData &&
        typeof parsedData.completionLevel === "number" &&
        parsedData.completionLevel !== this.dataSettings.dataCompletionLevel
      ) {
        let newSettings = {
          dataCompletionLevel: parsedData.completionLevel
        };
        if (parsedData.completionLevel < this.dataSettings.dataShareLevel) {
          newSettings.dataShareLevel = parsedData.completionLevel;
        }
        this.updateSettings(newSettings);
      }
      // remove unknown properties from the data
      const cleanedData = cleanData(parsedData);
      //update temporary data for usage as long as the browser is open
      this.tempData = cleanedData;
      this.tempDataCreatedOn = encryptedDataObject.createdOn? moment(encryptedDataObject.createdOn) : null;
      return cleanedData;
    });
  })
  .then(res => callback && callback(res),
    err => callback && callback(err instanceof Error? err.message : err));
}

window.µDataWallet = µDataWallet;
