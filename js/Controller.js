var Controller = {

  keysFromObject: function Controller_keysFromObject(obj) {
    var keys = [];
    for (var key in obj) {
      keys.push(key);
    }
    return keys;
  },

  treeName: Config.defaultTreeName,
  loadStatus: { pushlog: "loading", tinderbox: "loading" },

  /**
   * Used to browse the history. This is a timestamp from which we go 12 hours
   * into the past. Or zero if we want to show the most recent changes.
   */
  _timeOffset: 0,

  _loadInterval: null,
  _data: null,

  init: function Controller_init() {
    // Allow specifying a tree name in the URL (http://foo/?tree=Firefox3.5)
    var match = /[?&]tree=([^&]+)/.exec(document.location.search);
    if (match) {
      if (!Config.repoNames[match[1]])
        throw "wrongtree"; // er, hm.
      this.treeName = match[1];
    } 

    this._data = new Data(this.treeName, Config);
    this._machineTypes = this._data.getMachineTypes();

    UserInterface.init(this);

    this.forceRefresh();
  },

  getData: function Controller_getData() {
    return this._data;
  },

  getTimeOffset: function Controller_getTimeOffset() {
    return this._timeOffset;
  },

  setTimeOffset: function Controller_setTimeOffset(timeOffset) {
    this._timeOffset = timeOffset;
    this.forceRefresh();
  },

  forceRefresh: function Controller_forceRefresh() {
    var self = this;
    this._startStatusRequest();
    if (this._loadInterval) {
      clearInterval(this._loadInterval);
      this._loadInterval = null;
    }
    if (!this._timeOffset) {
      // Don't bother refreshing the past.
      this._loadInterval = setInterval(function startStatusRequestIntervalCallback() {
        self._startStatusRequest();
      }, Config.loadInterval * 1000);
    }
  },

  _startStatusRequest: function Controller__startStatusRequest() {
    var self = this;
    this.loadStatus = { pushlog: "loading", tinderbox: "loading" };
    UserInterface.updateStatus();
  
    this._data.loadPushes(
      this._timeOffset,
      function loaded() {
        self.loadStatus.pushlog = "complete";
        self._loadedData("pushes");
      },
      function failed() {
        self.loadStatus.pushlog = "fail";
        UserInterface.updateStatus();
      }
    );
  
    this._data.loadMachineResults(
      this._timeOffset,
      function loaded() {
        self.loadStatus.tinderbox = "complete";
        self._loadedData("machineResults");
      },
      function failed() {
        self.loadStatus.tinderbox = "fail";
        UserInterface.updateStatus();
      }
    );
  },

  _loadedData: function Controller__loadedData(kind) {
    UserInterface.updateStatus();
    UserInterface.loadedData(kind);
  },

};
