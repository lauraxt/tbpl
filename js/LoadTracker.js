/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

function LoadTracker(statusCallback) {
  this._statusCallback = statusCallback;
  this._numTrackedLoads = 0;
  this._numFinishedLoads = 0;
  this._failErrors = [];
  this._reportedFail = false;
}

LoadTracker.prototype = {
  addTrackedLoad: function loadTracker_addTrackedLoad() {
    this._numTrackedLoads++;
    this._updateStatus();
  },
  loadCompleted: function loadTracker_loadCompleted() {
    this._numFinishedLoads++;
    this._updateStatus();
  },
  loadFailed: function loadTracker_loadFailed(e) {
    this._numFinishedLoads++;
    this._failErrors.push(e);
    this._updateStatus();
  },
  addMorePotentialLoads: function loadTracker_addMorePotentialLoads(num) {
    this._numTrackedLoads += num;
    this._updateStatus();
    var self = this;
    return {
      cancel: function loadTracker_estimation_cancel() {
        self._numTrackedLoads -= num;
        self._updateStatus();
      }
    };
  },
  _updateStatus: function loadTracker__updateStatus() {
    if (this._reportedFail)
      return;

    if (this._failErrors.length) {
      this._statusCallback({
        loadpercent: 1,
        failed: this._failErrors,
      });
      this._reportedFail = true;
      return;
    }
    this._statusCallback({
      loadpercent: this._numFinishedLoads / this._numTrackedLoads
    });
  },
};
