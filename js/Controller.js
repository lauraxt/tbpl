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

  _uiCallbacks: null,

  _loadInterval: null,
  _data: null,
  _requestedRange: null,
  _trackingTip: false,
  _params: {},

  init: function Controller_init() {
    var params = this._parseParams();
    this._params = params;
    this.treeName = (("tree" in params) && params.tree) || Config.defaultTreeName;
    var pusher = ("pusher" in params) && params.pusher;
    var noIgnore = ("noignore" in params) && (params.noignore == "1");
    var onlyUnstarred = ("onlyunstarred" in params) && (params.onlyunstarred == "1");

    if (!(this.treeName in Config.repoNames))
      throw "wrongtree"; // er, hm.

    this._data = new Data(this.treeName, noIgnore, Config);
    this._uiCallbacks = UserInterface.init(this, onlyUnstarred, pusher);

    var initialPushRangeParams = this._getInitialPushRangeParams(params);
    var initialPushRange = initialPushRangeParams.range;
    this._trackingTip = initialPushRangeParams.trackTip;
    this._initialDataLoad(initialPushRange);
    var self = this;
    this._loadInterval = setInterval(function startStatusRequestIntervalCallback() {
      self.refreshData();
    }, Config.loadInterval * 1000);
  },

  getData: function Controller_getData() {
    return this._data;
  },

  /**
   * Extend the displayed push range by num pushes.
   * Positive num extends into the future, negative into the past.
   **/
  extendPushRange: function Controller_extendPushRange(num) {
    var currentRange = this._requestedRange || this._data.getLoadedPushRange();
    if (!currentRange)
      return;

    var requestedRange;
    if (num >= 0) {
      // Extend into the future, i.e. increase endID.
      requestedRange = {
        startID: currentRange.startID,
        endID: currentRange.endID + num,
      };
    } else {
      // Extend into the past, i.e. decrease startID.
      requestedRange = {
        startID: currentRange.startID - Math.abs(num),
        endID: currentRange.endID,
      };
    }
    var loadTracker = new LoadTracker(this._uiCallbacks.status);
    this._data.loadPushRange(requestedRange, false, loadTracker, this._uiCallbacks.handleUpdatedPush, this._uiCallbacks.handleInfraStatsUpdate, this._uiCallbacks.handleInitialPushlogLoad);
    this._requestedRange = requestedRange;
  },

  getURLForPusherFilteringView: function Controller_getURLForPusherFilteringView(pusher) {
    var params = $.extend({}, this._params); // fancy way of cloning an object
    params.pusher = pusher;
    return this._createURLForParams(params);
  },

  getURLForSinglePushView: function Controller_getURLForSinglePushView(rev) {
    var params = $.extend({}, this._params);
    params.rev = rev;
    return this._createURLForParams(params);
  },

  _createURLForParams: function Controller__createURLForParams(params) {
    var items = [];
    for (var key in params) {
      items.push(escape(key) + "=" + escape(params[key]));
    }
    return "?" + items.join("&");
  },

  _parseParams: function Controller__parseParams() {
    // Get the parameters specified in the query string of the URL.
    var params = {};
    var search = document.location.search;
    if (search != "") {
      var items = search.substring(1).split("&"); // strip "?" and split on "&"
      for (var index in items) {
        var eqitems = items[index].split("=");
        if (eqitems.length >= 2) {
          params[unescape(eqitems[0])] = unescape(eqitems.slice(1).join("="));
        }
      }
    }
    return params;
  },

  getParams: function Controller_getParams() {
    // Return a copy of _params.
    return $.extend({}, this._params);
  },

  _getInitialPushRangeParams: function Controller__getInitialPushRangeParams(params) {
    if ("rev" in params)
      return {
        range: { rev: params.rev },
        trackTip: false,
      };

    if ("fromchange" in params && "tochange" in params)
      return {
        range: { fromchange: params.fromchange, tochange: params.tochange },
        trackTip: false,
      };

    if ("startdate" in params && "enddate" in params)
      return {
        range: { startdate: params.startdate, enddate: params.enddate },
        trackTip: false,
      };

    return {
      range: { maxhours: 24 }, // Don't include pushes that are older than the latest push minus 24 hours.
      trackTip: true,
    };
  },

  _initialDataLoad: function Controller__initialDataLoad(initialPushRange) {
    var loadTracker = new LoadTracker(this._uiCallbacks.status);
    this._data.loadPushRange(initialPushRange, true, loadTracker, this._uiCallbacks.handleUpdatedPush, this._uiCallbacks.handleInfraStatsUpdate, this._uiCallbacks.handleInitialPushlogLoad);
  },

  refreshData: function Controller_refreshData() {
    var loadTracker = new LoadTracker(this._uiCallbacks.status);
    this._data.refresh(loadTracker, this._trackingTip, this._uiCallbacks.handleUpdatedPush, this._uiCallbacks.handleInfraStatsUpdate);
  },
};
