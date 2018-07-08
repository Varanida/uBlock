/*******************************************************************************

    Varanida - a browser extension to block requests.
    –– recorder component ––
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

'use strict';

const EventEmitter = require('events');

const MIN_ENTRIES_BETWEEN_READ = 5;
const MAX_ENTRIES_BETWEEN_READ = 50;
const MIN_TIME_BETWEEN_CHECK = 300 * 1000; //5min
const START_TIMEOUT = 30 * 1000; //30sec

const LogEntry = function(args, shareLevel) {
    this.init(args, shareLevel);
};

LogEntry.prototype.init = function(args, shareLevel) {
    this.tstamp = Date.now();
    this.tab = args[0] || '';
    this.cat = args[1] || '';
    this.d0 = args[2];
    this.d1 = args[3];
    this.d2 = args[4];
    this.d3 = args[5];
    this.d4 = args[6];
    this.shareLevel = shareLevel;
};

class Recorder extends EventEmitter {

  constructor (initState = [], shareLevel = 0) {
    super()
    // set init state
    this._buffer = initState;
    this._started = false;
    this._hasEmitted = false;
    this._shareLevel = shareLevel;
  }
  start() {
    console.log("starting recorder");
    this._started = true;
    vAPI.setTimeout(this._checkTimeEmit.bind(this), START_TIMEOUT);
  }
  writeOne() {
    if (!this._started) {
      return;
    }
    const newEntry = new LogEntry(arguments, this._shareLevel);
    if (newEntry.d0) { //has been filtered
      this._buffer.push(newEntry);
      this._checkEmit();
    } else {
      // console.log("not recorded");
      // console.log(newEntry);
    }
  }

  setShareLevel(newLevel) {
    this._shareLevel = newLevel;
  }

  readAll() {
    let outbuffer = [];
    for (var i = 0; i < this._buffer.length; i++) {
      if (!this._buffer[i].d0) {
        continue;
      }
      outbuffer.push({
        category:       this._buffer[i].cat,
        timestamp:      this._buffer[i].tstamp,
        requestUrl:     this._buffer[i].d2,
        rootHostname:   this._buffer[i].d3,
        pageHostname:   this._buffer[i].d4,
        rawFilter:         this._buffer[i].d0.raw,
        compiledFilter: this._buffer[i].d0.compiled,
        level:          this._buffer[i].shareLevel
      });
    }
    this._clean();
    return outbuffer;
  }

  // subscribe to changes
  subscribe (handler) {
    this.on('needsReading', handler)
  }

  // unsubscribe to changes
  unsubscribe (handler) {
    this.removeListener('needsReading', handler)
  }

  // empty buffer
  _clean() {
    this._buffer = [];
    this._hasEmitted = false;
    // vAPI.messaging.broadcast({ what: 'recorderCleaned' });
  }

  // check if there is the need to emit an event
  _checkEmit() {
    if (!this._hasEmitted && this._buffer.length >= MAX_ENTRIES_BETWEEN_READ) {
      this._hasEmitted = true;
      this.emit('needsReading', {length: this._buffer.length});
    }
  }

  _checkTimeEmit() {
    if (!this._hasEmitted && this._buffer.length > MIN_ENTRIES_BETWEEN_READ) {
      this._hasEmitted = true;
      this.emit('needsReading', {length: this._buffer.length});
    }
    vAPI.setTimeout(this._checkTimeEmit.bind(this), MIN_TIME_BETWEEN_CHECK);
  }
}

module.exports = Recorder;
/******************************************************************************/
