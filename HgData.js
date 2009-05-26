function HgData(repoName, dataLoader) {
  this._repoName = repoName;
  this._dataLoader = dataLoader;
}

HgData.prototype = {

  load: function(timeOffset, loadCallback, failCallback) {
    return this._dataLoader.load(this._repoName, timeOffset, loadCallback, failCallback);
  },

  getRepoUrl: function() {
    return "http://hg.mozilla.org/" + this._repoName; + "/";
  },

  getRevUrl: function(rev) {
    return this.getRepoUrl() + "rev/" + rev;
  },

};
