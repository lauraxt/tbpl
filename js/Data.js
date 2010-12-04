/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

function Data(treeName, noIgnore, config, pusher, rev) {
  this._treeName = treeName;
  this._noIgnore = noIgnore;
  this._config = config;
  this._pusher = pusher;
  this._rev = rev;
  this._pushes = {};
  this._machines = {};
  this._finishedResults = {};
  this._runningAndPendingResults = {};
  // These results could not be associated to any push yet. Keep track of them
  // and try again on the next refresh, the corresponding push may be there by
  // then.
  this._orphanResults = {};
};

Data.prototype = {
  load: function Data_load(timeOffset, statusCallback, successCallback) {
    var self = this;
    // we can provide progress info, once we load more sources
    var loadTotal = timeOffset ? 2 : 4;
    var loaded = -1;
    var failed = [];
    var loadedData = {pending: {}, running: {}, pushes: {}, machineResults: {}};
    var infraStats = !timeOffset ? {} : null;
    var checkLoaded = function() {
      if (failed.length)
        return;
      else if (++loaded < loadTotal)
        statusCallback({loadpercent: loaded/loadTotal});
      else {
        var updatedPushes = self._combineResults(loadedData, timeOffset);
        statusCallback({loadpercent: 1});
        successCallback(Controller.valuesFromObject(self._machines),
          Controller.valuesFromObject(updatedPushes), infraStats);
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
      failCallback,
      this._pusher,
      this._rev
    );
    Config.tinderboxDataLoader.load(
      this._treeName,
      timeOffset,
      this._noIgnore,
      function tinderboxDataLoadCallback(data) {
        loadedData.machineResults = data;
        checkLoaded();
      },
      failCallback,
      this
    );
    if (!timeOffset) {
      // Here we'll fetch the pending / running JSON, and we'll
      // count the builds. These numbers will be displayed in the
      // infrastructure popup in the UI.
      // Adding the actual running / pending entries to the right
      // pushes will happen in _combineResults.
      this._getPendingBuilds(function (pending) {
        loadedData.pending = pending;
        for (var tree in pending) {
          if (!(tree in infraStats))
            infraStats[tree] = {pending: 0, running: 0};
          for (var rev in pending[tree])
            infraStats[tree].pending += pending[tree][rev].length;
        }
        checkLoaded();
      });
      this._getRunningBuilds(function (running) {
        loadedData.running = running;
        for (var tree in running) {
          if (!(tree in infraStats))
            infraStats[tree] = {pending: 0, running: 0};
          for (var rev in running[tree])
            infraStats[tree].running += running[tree][rev].length;
        }
        checkLoaded();
      });
    }
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

  getPushForRev: function Data_getPushForRev(toprev) {
    return this._pushes[toprev];
  },

  _getPushForResult: function Data__getPushForResult(machineResult) {
    var repo = Config.repoNames[this._treeName];
    if (!(repo in machineResult.revs))
      return null;

    var resultRev = machineResult.revs[repo];
    for (var rev in this._pushes) {
      if (this._pushes[rev].defaultTip == resultRev) {
        return this._pushes[rev];
      }
    }

    return this._pushes[resultRev] || null;
  },

  getMachine: function Data__getMachine(name) {
    if (!(name in this._machines)) {
      // XXX clean all this up after all builders have been
      // transitioned to the new bug 586664 form
      var os =
        /linux.*64/i.test(name) ? "linux64" :
        /fedora.*64/i.test(name) ? "linux64" :
        /linux/i.test(name) ? "linux" :
        /fedora/i.test(name) ? "linux" :
        /macosx64/.test(name) ? "osx64" :
        /snowleopard/.test(name) ? "osx64" :
        /OS\s?X.*10\.6/.test(name) ? "osx64" :
        /macosx/.test(name) ? "osx" :
        /leopard/.test(name) ? "osx" :
        /OS\s?X/.test(name) ? "osx" :
        /w764/.test(name) ? "windows7-64" :
        /WINNT 6\.1 x64/i.test(name) ? "windows7-64" :
        /WINNT 5\.1/i.test(name) ? "windowsxp" :
        /win7/.test(name) ? "windows" :
        /win32/.test(name) ? "windows" :
        /WINNT 6\.1/i.test(name) ? "windows" :
        /WINNT 5\.2/i.test(name) ? "windows" :
        /android/i.test(name) ? "android" :
        /Maemo 5/.test(name) ? "maemo5" : 
        /Maemo/.test(name) ? "maemo4" : 
        /N810/.test(name) ? "maemo4" : 
        /n900/.test(name) ? "maemo5" :
        /xp/i.test(name) ? "windowsxp" :
        /static-analysis/.test(name) ? "linux" : "";

      var debug = /debug/i.test(name) || /(leak|bloat)/i.test(name);

      // see Config.testNames
      var type =
        /talos/i.test(name) ? "Talos Performance" :
        /nightly/i.test(name) ? "Nightly" :
        /shark/i.test(name) ? "Nightly" :
        /mochitest/i.test(name) ? "Mochitest" :
        /crashtest/i.test(name) ? "Crashtest" :
        /jsreftest/i.test(name) ? "JSReftest" :
        /reftest-d2d/i.test(name) ? "Reftest-Direct2D" :
        /direct3d/i.test(name) ? "Reftest-Direct3D" :
        /opengl/i.test(name) ? "Reftest-OpenGL" :
        /reftest/i.test(name) ? "Reftest" :
        /xpcshell/i.test(name) ? "XPCShellTest" :
        /depend/i.test(name) ? "Build" :
        /build/i.test(name) ? "Build" :
        /jetpack/i.test(name) ? "Jetpack SDK Test" :
        /mozmill-all/i.test(name) ? "Mozmill" :
        /(a11y|chrome|cold|dirty|dromaeo|scroll|svg|tp4)/.test(name) ? "Talos Performance" :
        /(check|test)/.test(name) ? "Unit Test" : "";

      if (!os || !type)
        return;

      this._machines[name] = {name: name, os: os, type: type, debug: debug,
        latestFinishedRun: null, runs: 0, runtime: 0, averageCycleTime: 0};
    }
    return this._machines[name];
  },

  _combineResults: function Data__combineResults(data, goingIntoPast) {
    var self = this;
    var updatedPushes = {};
    for (var toprev in data.pushes) {
      if (!(data.pushes[toprev].toprev in this._pushes)) {
        this._pushes[toprev] = data.pushes[toprev];
        updatedPushes[toprev] = data.pushes[toprev];
      }
    }

    // Adds the result to either _orphanResults, currentlyRunning or
    // _finishedResults. Also takes care of keeping track of the machine and
    // makes sure new notes are correctly forwarded to already linked jobs.
    function categorizeResult(result) {
      if (!(result.push = self._getPushForResult(result))) {
        self._orphanResults[result.runID] = result;
        return;
      }
      if (result.runID in self._finishedResults) {
        var existing = self._finishedResults[result.runID];
        if (result.note != existing.note) {
          existing.note = result.note;
          updatedPushes[existing.push.toprev] = existing.push;
        }
        return;
      }
      linkPush(result);
      self._finishedResults[result.runID] = result;
      var machine = result.machine;
      if (!machine.latestFinishedRun || result.startTime > machine.latestFinishedRun.startTime) {
        machine.latestFinishedRun = result;
      }
      if (result.state != "success")
        return;
      machine.runs++;
      machine.runtime+= (result.endTime.getTime() - result.startTime.getTime())/1000;
      machine.averageCycleTime = Math.ceil(machine.runtime/machine.runs);
    }

    // Removes a run from a push. This is needed for running jobs that are
    // removed in favor of the finished counterpart. For now, the same job
    // has different runIDs depending on the status.
    function unlinkPush(result) {
      var push = result.push;
      var machine = result.machine;
      var debug = machine.debug ? "debug" : "opt";
      var group = self.machineGroup(machine.type);
      var grouparr = push.results[machine.os][debug][group]
      for (var i in grouparr) {
        if (grouparr[i].runID == result.runID) {
          grouparr.splice(i, 1);
          break;
        }
      }
      updatedPushes[push.toprev] = push;
      result.push = null;
    }

    // Add a run to the corresponding push so it is displayed in the ui.
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
      updatedPushes[push.toprev] = push;
    }

    if (goingIntoPast) {
      var oldorphans = this._orphanResults;
      this._orphanResults = {};
      for (var i in oldorphans) {
        categorizeResult(oldorphans[i]);
      }
    }

    for (var i in data.machineResults)
      categorizeResult(data.machineResults[i]);

    // returns elements in a that are not in b
    function objdiff(a, b) {
      var c = {};
      for (var k in a)
        if (!(k in b))
          c[k] = a[k];
      return c;
    }

    if (!goingIntoPast) {
      var currentlyRunning = {};
      // key pending jobs on id + submitted_at and running jobs on
      // id + start_time so we get different keys for the same job when it
      // changes state. This is needed so we actually refresh the rendering via
      // unlinkPush/linkPush.
      // also keep in mind bug 590526, which says that tinderbox loses runs
      // when they have the same buildername + starttime
      var branchname = Config.repoNames[this._treeName].replace(/^[^\/]+\//, '');
      if (branchname in data.pending) {
        for (var rev in data.pending[branchname]) {
          if (!(rev in this._pushes))
            continue;
          for (var i in data.pending[branchname][rev]) {
            var job = data.pending[branchname][rev][i];
            var machine = this.getMachine(job.buildername);
            if (!machine)
              continue;
            var key = job.id + job.submitted_at;
            var revs = {};
            revs[Config.repoNames[this._treeName]] = rev;
            currentlyRunning[key] = {
              machine: machine,
              startTime: new Date(job.submitted_at * 1000),
              revs: revs,
              push: this._pushes[rev],
              state: "pending"
            };
          }
        }
      }
      if (branchname in data.running) {
        for (var rev in data.running[branchname]) {
          if (!(rev in this._pushes))
            continue;
          for (var i in data.running[branchname][rev]) {
            var job = data.running[branchname][rev][i];
            var machine = this.getMachine(job.buildername);
            if (!machine)
              continue;
            var key = job.id + job.start_time;
            var revs = {};
            revs[Config.repoNames[this._treeName]] = rev;
            currentlyRunning[key] = {
              machine: machine,
              startTime: new Date(job.start_time * 1000),
              revs: revs,
              push: this._pushes[rev],
              state: "running"
            };
          }
        }
      }
      var notRunningAnyMore = objdiff(this._runningAndPendingResults, currentlyRunning);
      for (var i in notRunningAnyMore)
        unlinkPush(notRunningAnyMore[i]);
      var newRunning = objdiff(currentlyRunning, this._runningAndPendingResults);
      for (var i in newRunning)
        linkPush(newRunning[i]);
      this._runningAndPendingResults = currentlyRunning;

      // workaround to regenerate the DOM (and thus ETA string) for all running
      // pushes
      for (var k in currentlyRunning) {
        var push = currentlyRunning[k].push;
        updatedPushes[push.toprev] = push;
      }
    }

    return updatedPushes;
  },
  
  _getPendingBuilds: function Data__getPendingBuilds(success, error) {
    var self = this;
    $.getJSON("http://build.mozilla.org/builds/builds-pending.js", function(data) {
      if (!data.pending)
        return;
      self._filterHiddenBuilds(data.pending);
      success(data.pending);
    });
  },
  
  _getRunningBuilds: function Data__getRunningBuilds(success, error) {
    var self = this;
    $.getJSON("http://build.mozilla.org/builds/builds-running.js", function(data) {
      if (!data.running)
        return;
      self._filterHiddenBuilds(data.running);
      success(data.running);
    });
  },

  _filterHiddenBuilds: function Data__filterHiddenBuilds(obj) {
    if (this._noIgnore)
      return;
    for (var repo in obj) {
      for (var toprev in obj[repo]) {
        obj[repo][toprev] = obj[repo][toprev].filter(function (build) {
          return Config.hiddenBuilds.indexOf(build.buildername) == -1;
        });
      }
    }
  },
}
