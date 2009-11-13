function TinderboxData(treeName, dataLoader, repoNames) {
  this._treeName = treeName;
  this._dataLoader = dataLoader;
  this._repoNames = repoNames;
  this._normalData = { machines: [], machineResults: {} };
  this._unittestData = { machines: [], machineResults: {} };
}

TinderboxData.prototype = {

  oss: ["linux", "osx", "windows"],
  machineTypes: ["Build", "Leak Test", "Unit Test", "Mochitest", "Opt Mochitest", "Debug Mochitest", "Everythingelse Test", "Opt Everythingelse Test", "Debug Everythingelse Test", "Nightly", "Talos", "Static Analysis"],
  treesWithGroups: {
    "Firefox": ["Mochitest", "Opt Mochitest", "Debug Mochitest"],
  },
  _treesWithUnittest: ["Firefox", "Firefox3.5", "Firefox3.6", "TraceMonkey"],

  getRepoName: function TinderboxData_getRepoName() {
    return this._repoNames[this._treeName];
  },

  load: function TinderboxData_load(timeOffset, loadCallback, failCallback) {
    var self = this;
    this._dataLoader.load(
      this._treeName,
      timeOffset,
      function mainTreeLoadCallback(normalData) {
        self._normalData = normalData;
        loadCallback(self.getData());
      },
      failCallback
    );
    if (this._hasUnittestTree()) {
      this._dataLoader.load(
        this._getUnittestTreeName(),
        timeOffset,
        function unittestTreeLoadCallback(unittestData) {
          self._unittestData = unittestData;
          loadCallback(self.getData());
        },
        failCallback
      );
    }
  },

  getData: function TinderboxData_getData() {
    return {
      machines: this._normalData.machines.concat(this._unittestData.machines),
      machineResults: this._combineObjects(this._normalData.machineResults, this._unittestData.machineResults),
    };
  },

  _combineObjects: function TinderboxData__combineObjects(a, b) {
    var c = {};
    for (var i in a) {
      c[i] = a[i];
    }
    for (i in b) {
      c[i] = b[i];
    }
    return c;
  },

  _hasUnittestTree: function TinderboxData__hasUnittestTree() {
    return this._treesWithUnittest.indexOf(this._treeName) != -1;
  },

  _getUnittestTreeName: function TinderboxData__getUnittestTreeName() {
    return this._treeName + "-Unittest";
  },

}
