/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var Controller = {
  keysFromObject: function Controller_keysFromObject(obj) {
    var keys = [];
    for (var key in obj) {
      keys.push(key);
    }
    return keys;
  },

  valuesFromObject: function Controller_valuesFromObject(obj) {
    var values = [];
    for (var key in obj) {
      values.push(obj[key]);
    }
    return values;
  },

  stripTags: function Controller_stripTags(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  treeName: Config.defaultTreeName,

  /**
   * Used to browse the history. This is a timestamp from which we go 12 hours
   * into the past. Or zero if we want to show the most recent changes.
   */
  _timeOffset: 0,
  _statusCallback: null,
  _refreshCallback: null,

  _loadInterval: null,
  _data: null,

  init: function Controller_init() {
    var params = this._getParams();

    // Allow specifying a tree name in the URL (http://foo/?tree=Firefox3.5)
    if ("tree" in params) {
      if (!Config.repoNames[params.tree])
        throw "wrongtree"; // er, hm.
      this.treeName = params.tree;
    }

    var pusher = null;
    if ("pusher" in params) {
      pusher = params.pusher;
    }

    var rev = null;
    if ("rev" in params) {
      rev = params.rev;
    }

    // Allow specifying &noignore=1 in the URL (to pass through to tinderbox)
    var noIgnore = ("noignore" in params) && (params.noignore == "1");

    this._data = new Data(this.treeName, noIgnore, Config, pusher, rev);

    var uiConf = UserInterface.init(this);
    this._statusCallback = uiConf.status;
    this._refreshCallback = uiConf.refresh;

    this._timeOffset = (new Date()).getTime() / 1000;

    var self = this;
    this._startStatusRequest();
    this._loadInterval = setInterval(function startStatusRequestIntervalCallback() {
      self._startStatusRequest();
    }, Config.loadInterval * 1000);
  },

  getData: function Controller_getData() {
    return this._data;
  },

  requestHistory: function Controller_requestHistory(callback) {
    this._timeOffset-= Config.goBackHours * 3600;
    this._data.load(this._timeOffset, this._statusCallback, callback);
  },

  _getParams: function Controller__getParams() {
    // Get the parameters specified in the query string of the URL.
    var params = {};
    var search = document.location.search;
    if (search != "") {
      var items = search.substring(1).split("&"); // strip "?" and split on "&"
      for (var index in items) {
        var eqitems = items[index].split("=");
        if (eqitems.length >= 2) {
          params[eqitems[0]] = eqitems.slice(1).join("=");
        }
      }
    }
    return params;
  },

  _startStatusRequest: function Controller__startStatusRequest() {
    this._data.load(0, this._statusCallback, this._refreshCallback);
  }
};
