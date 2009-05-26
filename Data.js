function Data(treeName, config) {
  this._treeName = treeName;
  this._tinderboxData = new TinderboxData(this._treeName, config.tinderboxDataLoader);
  this._hgData = new HgData(this._tinderboxData.getRepoName(), config.pushlogDataLoader);
};

Data.prototype = {

  getRevUrl: function(rev) {
    return this._hgData.getRevUrl(rev);
  },

  loadPushes: function(timeOffset, loadCallback, failCallback) {
    return this._hgData.load(timeOffset, loadCallback, failCallback);
  },

  loadMachineResults: function(timeOffset, loadCallback, failCallback) {
    return this._tinderboxData.load(timeOffset, loadCallback, failCallback);
  },

  getOss: function() {
    return this._tinderboxData.oss;
  },

  getMachineTypes: function() {
    return this._tinderboxData.machineTypes;
  },

}
