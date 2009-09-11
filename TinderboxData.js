function TinderboxData(treeName, dataLoader, repoNames) {
  this._treeName = treeName;
  this._dataLoader = dataLoader;
  this._repoNames = repoNames;
  this._normalData = { machines: [], machineResults: {} };
  this._unittestData = { machines: [], machineResults: {} };
}

TinderboxData.prototype = {

  oss: ["linux", "osx", "windows"],
  machineTypes: ["Build", "Leak Test", "Unit Test", "Mochitest", "Everythingelse Test", "Nightly", "Talos", "Static Analysis"],
  _treesWithUnittest: ["Firefox", "Firefox3.5", "Firefox3.6", "TraceMonkey"],

  getRepoName: function() {
    return this._repoNames[this._treeName];
  },

  load: function(timeOffset, loadCallback, failCallback) {
    var self = this;
    this._dataLoader.load(
      this._treeName,
      timeOffset,
      function(normalData) {
        self._normalData = normalData;
        loadCallback(self.getData());
      },
      failCallback
    );
    if (this._hasUnittestTree()) {
      this._dataLoader.load(
        this._getUnittestTreeName(),
        timeOffset,
        function(unittestData) {
          self._unittestData = unittestData;
          loadCallback(self.getData());
        },
        failCallback
      );
    }
  },

  getData: function() {
    return {
      machines: this._normalData.machines.concat(this._unittestData.machines),
      machineResults: this._combineObjects(this._normalData.machineResults, this._unittestData.machineResults),
    };
  },

  _combineObjects: function(a, b) {
    var c = {};
    for (var i in a) {
      c[i] = a[i];
    }
    for (i in b) {
      c[i] = b[i];
    }
    return c;
  },

  _hasUnittestTree: function() {
    return this._treesWithUnittest.indexOf(this._treeName) != -1;
  },

  _getUnittestTreeName: function() {
    return this._treeName + "-Unittest";
  },

}
