function Data(treeName, config) {
  this._treeName = treeName;
  this._tinderboxData = new TinderboxData(this._treeName, config.tinderboxDataLoader, config.repoNames);
  this._hgData = new HgData(this._tinderboxData.getRepoName(), config.pushlogDataLoader);
  this._pushes = [];
  this._machines = [];
  this._machineResults = {};
};

Data.prototype = {

  getRevUrl: function(rev) {
    return this._hgData.getRevUrl(rev);
  },

  loadPushes: function(timeOffset, loadCallback, failCallback) {
    var self = this;
    return this._hgData.load(
      timeOffset,
      function (data) {
        self._pushes = data;
        self._loadedData();
        loadCallback();
      },
      failCallback
    );
  },

  loadMachineResults: function(timeOffset, loadCallback, failCallback) {
    var self = this;
    return this._tinderboxData.load(
      timeOffset,
      function (data) {
        self._machines = data.machines;
        self._machineResults = data.machineResults;
        self._loadedData();
        loadCallback();
      },
      failCallback
    );
  },

  getOss: function() {
    return this._tinderboxData.oss;
  },

  getMachineTypes: function() {
    return this._tinderboxData.machineTypes;
  },

  getMachines: function() {
    return this._machines;
  },

  getMachineResults: function() {
    return this._machineResults;
  },

  getPushes: function() {
    return this._pushes;
  },

  _loadedData: function() {
    this._combineResults();
  },

  _getPushForRev: function(rev) {
    for (var k = 0; k < this._pushes.length; k++) {
      if (rev == this._pushes[k].toprev)
        return this._pushes[k];
    }
    return null;
  },
  
  _getRevForResult: function(machineResult) {
    if (machineResult.rev)
      return machineResult.rev;
  
    var machineType = machineResult.machine.type;
  
    if (machineType == "Talos" || machineType == "Unit Test") {
      // Talos and Unit Test boxes use the builds provided
      // by build boxes and sync their start time with them.
      // If there's a build machine with the same start time,
      // use the same revision.
      for (var j in this._machineResults) {
        var bMachine = this._machineResults[j].machine;
        if ((bMachine.type == "Build" || bMachine.type == "Leak Test") &&
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
    this._pushes.forEach(function (push) {
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
  
  _combineResults: function() {
    var self = this;

    $(this._pushes).each(function() {
      delete this.results;
    });
    this._tinderboxData.machineTypes.forEach(function (machineType) {
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
        if (!push.results)
          push.results = {};
        if (!push.results[machineResult.machine.os])
          push.results[machineResult.machine.os] = {};
        if (!push.results[machineResult.machine.os][machineResult.machine.type])
          push.results[machineResult.machine.os][machineResult.machine.type] = [];
        push.results[machineResult.machine.os][machineResult.machine.type].push(machineResult);
        push.results[machineResult.machine.os][machineResult.machine.type].sort(function(a, b) {
          var aTime = a.startTime.getTime(), bTime = b.startTime.getTime();
          return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
        });
      }
    });
  },

}