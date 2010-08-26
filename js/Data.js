function Data(treeName, noIgnore, config) {
  this._treeName = treeName;
  this._noIgnore = noIgnore;
  this._pushes = [];
  this._machines = [];
  this._machineResults = {};
  this._config = config;
};

Data.prototype = {
  loadPushes: function Data_loadPushes(timeOffset, loadCallback, failCallback) {
    var self = this;
    return Config.pushlogDataLoader.load(
      Config.repoNames[this._treeName],
      timeOffset,
      function hgDataLoadCallback(data) {
        self._pushes = data;
        self._loadedData();
        loadCallback();
      },
      failCallback
    );
  },

  loadMachineResults: function Data_loadMachineResults(timeOffset, loadCallback, failCallback) {
    var self = this;
    return Config.tinderboxDataLoader.load(
      this._treeName,
      timeOffset,
      this._noIgnore,
      function tinderboxDataLoadCallback(data) {
        self._machines = data.machines;
        self._machineResults = data.machineResults;
        self._loadedData();
        loadCallback();
      },
      failCallback
    );
  },

  machineTypeIsGrouped: function Data_machineTypeIsGrouped(machineType) {
    return this._config.treesWithGroups.indexOf(this._treeName) != -1 &&
      this._config.groupedMachineTypes.indexOf(machineType) != -1;
  },

  getMachines: function Data_getMachines() {
    return this._machines;
  },

  getMachineResults: function Data_getMachineResults() {
    return this._machineResults;
  },

  getPushes: function Data_getPushes() {
    return this._pushes;
  },

  _loadedData: function Data__loadedData() {
    this._combineResults();
  },

  _getPushForRev: function Data__getPushForRev(rev) {
    for (var k = 0; k < this._pushes.length; k++) {
      if (rev == this._pushes[k].toprev)
        return this._pushes[k];
    }
    return null;
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
      for (var j in this._machineResults) {
        var bMachine = this._machineResults[j].machine;
        if ((bMachine.type == "Build") &&
          this._machineResults[j].startTime.getTime() == machineResult.startTime.getTime()) {
          return this._machineResults[j].guessedRev;
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
    this._pushes.forEach(function findLatestPush(push) {
      var pushTime = push.date.getTime();
      if (pushTime < machineTime) {
        if (latestPushTime < pushTime) {
          latestPushRev = push.toprev;
          latestPushTime = pushTime;
        }
      }
    });
    return latestPushRev;
  },
  
  _combineResults: function Data__combineResults() {
    var self = this;

    $(this._pushes).each(function deletePush() {
      delete this.results;
    });
    Controller.keysFromObject(Config.testNames).forEach(function addMachineTypeToPushes(machineType) {
      for (var i in self._machineResults) {
        var machineResult = self._machineResults[i];
        if (machineResult.machine.type != machineType)
          continue;
  
        machineResult.guessedRev = self._getRevForResult(machineResult);
        var push = self._getPushForRev(machineResult.guessedRev);
        if (!push) {
          // This test run started before any of the pushes in the pushlog.
          // Ignore.
          continue;
        }
        var machine = machineResult.machine;
        var debug = machine.debug ? "debug" : "opt";
        if (!push.results)
          push.results = {};
        if (!push.results[machine.os])
          push.results[machine.os] = {};
        if (!push.results[machine.os][debug])
          push.results[machine.os][debug] = {};
        if (!push.results[machine.os][debug][machine.type])
          push.results[machine.os][debug][machine.type] = [];
        push.results[machine.os][debug][machine.type].push(machineResult);
      }
    });

    // generate performance results for each push
    this._pushes.forEach(function(push) {
      push.perfResults = this._getPerfResultsForPush(push);
    }, this);
  },

  /**
   * Aggregate test results for a push into an easy-to-use result set:
   *
   * [
   *  {
   *   os1: {
   *         ts: 200.3,
   *         tp4: 3002.21
   *        }
   *   }
   * ]
   */
  _getPerfResultsForPush: function Data__getPerfResultsForPush(push) {
    var perfResults = {};
    Controller.keysFromObject(Config.OSNames).forEach(function(os) {
      // talos are only run on opt builds, for now at least
      if (push.results && push.results[os] && push.results[os]["opt"] &&
          push.results[os]["opt"]["Talos Performance"]) {
        var buildResults = push.results[os]["opt"]["Talos Performance"];
        buildResults.forEach(function(buildResult) {
          var testResults = this.getMachineResults()[buildResult.runID].getTestResults();
          if (testResults) {
            testResults.forEach(function(testResult) {
              perfResults[os] = perfResults[os] || {};
              perfResults[os][testResult.name] = testResult.result;
            });
          }
        }, this);
      }
    }, this);
    return perfResults;
  }
}
