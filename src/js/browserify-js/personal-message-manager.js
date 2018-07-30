/*******************************************************************************

    Varanida - a browser extension to block requests.
    –– message manager component ––
    simplified version (no persistence) of Metamask's message managers
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


const EventEmitter = require('events');
const ethUtil = require('ethereumjs-util');
const createId = require('./random-id');
const hexRe = /^[0-9A-Fa-f]+$/g;

/**
 * Represents, and contains data about, a 'personal_sign' type signature request. These are created when a
 * signature for a personal_sign call is requested.
 *
 * @see {@link https://web3js.readthedocs.io/en/1.0/web3-eth-personal.html#sign}
 *
 * @typedef {Object} PersonalMessage
 * @property {number} id An id to track and identify the message object
 * @property {Object} msgParams The parameters to pass to the personal_sign method once the signature request is
 * approved.
 * @property {string} msgParams.data The string of the signature request
 * @property {string} msgParams.hexData A hex string conversion of the string
 * @property {string} rawSig A hex string signature (when the message is signed)
 * @property {number} time The epoch time at which this message was created
 * @property {string} status Indicates whether the signature request is 'unapproved', 'signed' or 'rejected'
 *
 */

module.exports = class PersonalMessageManager extends EventEmitter {
  /**
   * Controller in charge of managing - storing, adding, removing, updating - PersonalMessage.
   *
   * @typedef {Object} PersonalMessageManager
   * @property {array} messages Holds all messages that have been created by this PersonalMessageManager
   *
   */
  constructor (opts) {
    super();
    this.messages = [];
  }

  /**
   * A getter for the number of 'unapproved' PersonalMessages in this.messages
   *
   * @returns {number} The number of 'unapproved' PersonalMessages in this.messages
   *
   */
  getUnapprovedPersonalMsgCount() {
    return Object.keys(this.getUnapprovedMsgs()).length;
  }

  /**
   * A getter for the 'unapproved' PersonalMessages in this.messages
   *
   * @returns {Object} An index of PersonalMessage ids to PersonalMessages, for all 'unapproved' PersonalMessages in
   * this.messages
   *
   */
  getUnapprovedMsgs () {
    return this.messages.filter(msg => msg.status === 'unapproved')
    .reduce((result, msg) => { result[msg.id] = msg; return result; }, {});
  }

  /**
   * Creates a new PersonalMessage with an 'unapproved' status using the passed msgParams. this.addMsg is called to add
   * the new PersonalMessage to this.messages
   *
   * @param {Object} msgParams The params for the eth_sign call to be made after the message is approved.
   * @returns {number} The id of the newly created PersonalMessage.
   *
   */
  addUnapprovedMessage (msgParams) {
    console.log(`PersonalMessageManager addUnapprovedMessage: ${JSON.stringify(msgParams)}`);
    msgParams.hexData = this.normalizeMsgData(msgParams.data);
    var time = (new Date()).getTime();
    var msgId = createId();
    var msgData = {
      id: msgId,
      msgParams: msgParams,
      time: time,
      status: 'unapproved'
    };
    this.addMsg(msgData);
    // signal update
    this.emit('update');
    return msgId;
  }

  /**
   * Adds a passed PersonalMessage to this.messages
   *
   * @param {Message} msg The PersonalMessage to add to this.messages
   *
   */
  addMsg (msg) {
    this.messages.push(msg);
  }

  /**
   * Returns a specified PersonalMessage.
   *
   * @param {number} msgId The id of the PersonalMessage to get
   * @returns {PersonalMessage|undefined} The PersonalMessage with the id that matches the passed msgId, or undefined
   * if no PersonalMessage has that id.
   *
   */
  getMsg (msgId) {
    return this.messages.find(msg => msg.id === msgId);
  }

  /**
   * Sets a PersonalMessage status to 'signed' via a call to this._setMsgStatus and updates that PersonalMessage in
   * this.messages by adding the raw signature data of the signature request to the PersonalMessage
   *
   * @param {number} msgId The id of the PersonalMessage to sign.
   * @param {buffer} rawSig The raw data of the signature request
   *
   */
  setMsgStatusSigned (msgId, rawSig) {
    const msg = this.getMsg(msgId);
    msg.rawSig = rawSig;
    this._updateMsg(msg);
    this._setMsgStatus(msgId, 'signed');
  }

  /**
   * Sets a PersonalMessage status to 'rejected' via a call to this._setMsgStatus.
   *
   * @param {number} msgId The id of the PersonalMessage to reject.
   *
   */
  rejectMsg (msgId) {
    this._setMsgStatus(msgId, 'rejected');
  }

  /**
   * Updates the status of a PersonalMessage in this.messages via a call to this._updateMsg
   *
   * @private
   * @param {number} msgId The id of the PersonalMessage to update.
   * @param {string} status The new status of the PersonalMessage.
   * @throws A 'PersonalMessageManager - PersonalMessage not found for id: "${msgId}".' if there is no PersonalMessage
   * in this.messages with an id equal to the passed msgId
   * @fires An event with a name equal to `${msgId}:${status}`. The PersonalMessage is also fired.
   * @fires If status is 'rejected' or 'signed', an event with a name equal to `${msgId}:finished` is fired along
   * with the PersonalMessage
   *
   */
  _setMsgStatus (msgId, status) {
    const msg = this.getMsg(msgId);
    if (!msg) {
      throw new Error('PersonalMessageManager - Message not found for id: "${msgId}".');
    }
    msg.status = status;
    this._updateMsg(msg);
    this.emit(`${msgId}:${status}`, msg);
    if (status === 'rejected' || status === 'signed') {
      this.emit(`${msgId}:finished`, msg);
    }
  }

  /**
   * Sets a PersonalMessage in this.messages to the passed PersonalMessage if the ids are equal.
   *
   * @private
   * @param {msg} PersonalMessage A PersonalMessage that will replace an existing PersonalMessage (with the same
   * id) in this.messages
   *
   */
  _updateMsg (msg) {
    const index = this.messages.findIndex((message) => message.id === msg.id);
    if (index !== -1) {
      this.messages[index] = msg;
    }
  }

  /**
   * A helper function that converts raw buffer data to a hex, or just returns the data if it is already formatted as a hex.
   *
   * @param {any} data The buffer data to convert to a hex
   * @returns {string} A hex string conversion of the buffer data
   *
   */
  normalizeMsgData (data) {
    try {
      const stripped = ethUtil.stripHexPrefix(data);
      if (stripped.match(hexRe)) {
        return ethUtil.addHexPrefix(stripped);
      }
    } catch (e) {
      console.log(`Message was not hex encoded, interpreting as utf8.`);
    }
    return ethUtil.bufferToHex(new Buffer(data, 'utf8'));
  }
};
