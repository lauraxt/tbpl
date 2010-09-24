/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

function Data(treeName, noIgnore, config, pusher, rev) {
  this._treeName = treeName;
  this._noIgnore = noIgnore;
  this._config = config;
  this._pusher = pusher;
  this._rev = rev;
  this._pushes = {};
  this._machines = [];
  this._finishedResults = {};
  this._runningAndPendingResults = {};
  this._orphanResults = {};
};

Data.prototype = {
  load: function Data_load(timeOffset, statusCallback, successCallback) {
    var self = this;
    // we can provide progress info, once we load more sources
    var loadTotal = 2;
    var loaded = -1;
    var failed = [];
    var loadedData = {};
    var checkLoaded = function() {
      if (failed.length)
        return;
      else if (++loaded < loadTotal)
        statusCallback({loadpercent: loaded/loadTotal});
      else {
        var updatedPushes = self._combineResults(loadedData, timeOffset);
        statusCallback({loadpercent: 1});
        successCallback(self._machines, updatedPushes);
      }
    };
    checkLoaded();
    var failCallback = function(what) {
      failed.push(what);
      statusCallback({failed: failed});
    };
    Config.pushlogDataLoader.load(
      Config.repoNames[this._treeName],
      timeOffset,
      function hgDataLoadCallback(data) {
        loadedData.pushes = data;
        checkLoaded();
      },
      this._pusher,
      this._rev
    );
    Config.tinderboxDataLoader.load(
      this._treeName,
      timeOffset,
      this._noIgnore,
      function tinderboxDataLoadCallback(data) {
        loadedData.machines = data.machines;
        loadedData.machineResults = data.machineResults;
        checkLoaded();
      },
      failCallback
    );
  },

  machineGroup: function Data_machineGroup(machineType) {
    if (this._config.treesWithGroups.indexOf(this._treeName) == -1)
      return machineType;
    for (var groupname in this._config.groupedMachineTypes) {
      if (this._config.groupedMachineTypes[groupname].indexOf(machineType) != -1)
        return groupname;
    }
    return machineType;
  },

  getMachineResult: function Data_getMachineResult(id) {
    return this._finishedResults[id];
  },

  _getRevForResult: function Data__getRevForResult(machineResult) {
    if (machineResult.rev)
      return machineResult.rev;
  
    var machineType = machineResult.machine.type;
  
    if (machineType != "Build" && machineType != "Nightly") {
      // Talos and Unit Test boxes use the builds provided
      // by build boxes and sync their start time with them.
      // If there's a build machine with the same start time,
      // use the same revision.
      for (var j in this._finishedResults) {
        var bMachine = this._finishedResults[j].machine;
        if ((bMachine.type == "Build") &&
          this._finishedResults[j].startTime.getTime() == machineResult.startTime.getTime()) {
          return this._finishedResults[j].guessedRev;
        }
      }
    }
  
    // Try to find out the rev by comparing times.
    // this breaks when going back in time. Just return nothing when doing so.
    // XXX fix this
    //if (timeOffset)
    // return '';

    var latestPushRev = "", latestPushTime = -1;
    var machineTime = machineResult.startTime.getTime();
    for (var i in this._pushes) {
      var push = this._pushes[i];
      var pushTime = push.date.getTime();
      if (pushTime < machineTime) {
        if (latestPushTime < pushTime) {
          latestPushRev = push.toprev;
          latestPushTime = pushTime;
        }
      }
    }
    return latestPushRev;
  },
  
  _combineResults: function Data__combineResults(data, goingIntoPast) {
    if (!goingIntoPast)
      this._machines = data.machines;
    var self = this;
    var newRunning = {};
    // TODO: make this a map to avoid adding a push twice
    var updatedPushes = [];
    for (var i in data.pushes) {
      // TODO: do not add already existing pushes to updatedPushes
      //if (!(data.pushes[i].toprev in this._pushes)) {
        this._pushes[data.pushes[i].toprev] = data.pushes[i];
        updatedPushes.push(data.pushes[i]);
      //}
    }

    function categorizeResult(result) {
      result.guessedRev = self._getRevForResult(result);
      if (!(result.push = self._pushes[result.guessedRev])) {
        // This test run started before any of the pushes in the pushlog.
        self._orphanResults[result.runID] = result;
        return;
      }
      if (~["building", "pending"].indexOf(result.state))
        newRunning[result.runID] = result;
      else {
        self._finishedResults[result.runID] = result;
        linkPush(result);
      }
    }
    function unlinkPush(result) {
      var push = result.push;
      var machine = result.machine;
      var debug = machine.debug ? "debug" : "opt";
      var group = self.machineGroup(machine.type);
      var grouparr = push.results[machine.os][debug][group]
      for (var i in grouparr) {
        if (grouparr[i] == result) {
          grouparr.splice(i, 1);
          break;
        }
      }
      // TODO: add the push to the updatedPushes
      delete result.push;
    }
    function linkPush(result) {
      var push = result.push;
      var machine = result.machine;
      var debug = machine.debug ? "debug" : "opt";
      var group = self.machineGroup(machine.type);
      if (!push.results)
        push.results = {};
      if (!push.results[machine.os])
        push.results[machine.os] = {};
      if (!push.results[machine.os][debug])
        push.results[machine.os][debug] = {};
      if (!push.results[machine.os][debug][group])
        push.results[machine.os][debug][group] = [];
      push.results[machine.os][debug][group].push(result);
      // TODO: add the push to the updatedPushes
    }

    /* TODO: reevaluate orphanResults when we go back in time
    var oldorphans = this._orphanResults;
    this._orphanResults = {};
    for (var i in oldorphans) {
      categorizeResult(oldorphans[i]);
    }
    */

    for (var i in data.machineResults)
      categorizeResult(data.machineResults[i]);

    this._runningAndPendingResults = newRunning;

    // TODO: remove old runningAndPendingResults from their pushes
    // and only evaluate newRunning (not when we are loading the past)
    for (var i in newRunning)
      linkPush(newRunning[i]);

    return updatedPushes;
  }
}
