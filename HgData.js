function HgData(repoName, dataLoader) {
  this._repoName = repoName;
  this._dataLoader = dataLoader;
}

HgData.prototype = {

  load: function HgData_load(timeOffset, loadCallback, failCallback) {
    return this._dataLoader.load(this._repoName, timeOffset, loadCallback, failCallback);
  },

  getRepoUrl: function HgData_getRepoUrl() {
    return "http://hg.mozilla.org/" + this._repoName + "/";
  },

  getRevUrl: function HgData_getRevUrl(rev) {
    return this.getRepoUrl() + "rev/" + rev;
  },

};
