function TinderboxData(treeName, dataLoader, repoNames) {
  this._treeName = treeName;
  this._dataLoader = dataLoader;
  this._repoNames = repoNames;
  this._data = { machines: [], machineResults: {} };
}

TinderboxData.prototype = {

  oss: ["linux", "osx", "windows"],
  machineTypes: ["Opt Build", "Debug Build", "Unit Test", "Mochitest", "Opt Mochitest", "Debug Mochitest", "Everythingelse Test", "Opt Everythingelse Test", "Debug Everythingelse Test", "Nightly", "Talos", "Static Analysis"],

  // These "groups" are machine types that are grouped like M(12345).
  treesWithGroups: {
    "Firefox": ["Mochitest", "Opt Mochitest", "Debug Mochitest"],
  },

  getRepoName: function TinderboxData_getRepoName() {
    return this._repoNames[this._treeName];
  },

  load: function TinderboxData_load(timeOffset, loadCallback, failCallback) {
    var self = this;
    this._dataLoader.load(
      this._treeName,
      timeOffset,
      function mainTreeLoadCallback(data) {
        self._data = data;
        loadCallback(self.getData());
      },
      failCallback
    );
  },

  getData: function TinderboxData_getData() {
    return this._data;
  },
}
