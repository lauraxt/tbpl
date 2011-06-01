/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var TinderboxJSONUser = {

  load: function TinderboxJSONUser_load(tree, pushes, noIgnore, loadTracker, loadCallback, data) {
    delete tinderbox_data;
    var self = this;
    if (!pushes.length)
      return;
    var now = new Date();
    this._getTimeRangesForPushes(pushes, now).forEach(function (timeRange) {
      var scriptURL = self._getScriptURL(tree, timeRange, noIgnore, now);
      loadTracker.addTrackedLoad();
      $.getScript(scriptURL, function tinderboxJSONGetScriptCallback() {
        if (!tinderbox_data) {
          loadTracker.loadFailed("tinderbox_data is invalid");
        } else {
          pushes.forEach(function (push) {
            // push.latestTinderboxData is the date until which we already have
            // up-to-date Tinderbox data for this push.
            push.latestTinderboxData = Math.max(push.latestTinderboxData || push.date, timeRange.endTime);
          });
          self.parseTinderbox(tree, tinderbox_data, data, loadTracker, loadCallback);
          loadTracker.loadCompleted();
        }
      });
    });
  },

  _getRequestStartForPushes: function TinderboxJSONUser__getRequestStartForPushes(pushes, now) {
    // Return the earliest time for which there's no existing Tinderbox data
    // for any push in pushes.
    return pushes.reduce(function (startTime, push) {
      return Math.min(startTime, push.latestTinderboxData || push.date);
    }, now.getTime());
  },

  _getTimeRangesForPushes: function TinderboxJSONUser__getTimeRangesForPushes(pushes, now) {
    var rangeDuration = 12 * 60 * 60 * 1000; // 12 hours
    var maxResultDelayAfterPush = 12 * 60 * 60 * 1000; // 12 hours
    var latestPushDate = pushes[pushes.length - 1].date;
    var requestEnd = new Date(Math.min(latestPushDate.getTime() + maxResultDelayAfterPush, now));
    var requestStart = this._getRequestStartForPushes(pushes, now);
    var timeRanges = [];
    while (requestEnd > requestStart) {
      timeRanges.push({
        endTime: requestEnd,
        duration: rangeDuration,
      });
      requestEnd = new Date(requestEnd - rangeDuration);
    }
    return timeRanges;
  },

  _getScriptURL: function TinderboxJSONUser__getScriptURL(tree, timeRange, noIgnore, now) {
    if (timeRange.endTime >= now && !noIgnore)
      return "http://tinderbox.mozilla.org/" + tree + "/json.js";

    var scriptURL = 'http://tinderbox.mozilla.org/showbuilds.cgi?tree=' + tree +
                    '&json=1' +
                    '&maxdate=' + Math.ceil(timeRange.endTime / 1000) +
                    '&hours=' + Math.ceil(timeRange.duration / 60 / 60 / 1000);
    if (noIgnore) {
      scriptURL += '&noignore=1';
    }
    return scriptURL;
  },

  _getSlaveName: function TinderboxJSONUser__getSlaveName(buildScrape) {
    if (buildScrape) {
      for (var i = 0; i < buildScrape.length; i++) {
        var matches = /^(\s*)s:(\s*)(.*?)$/.exec(buildScrape[i]);
        if (matches)
          return matches[3];
      }
    }
    return "";
  },

  findRevInScrape: function TinderboxJSONUser_findRevInScrape(scrape) {
    var revs = {};
    if (!scrape)
      return revs;
    var matches;
    var re = /http:\/\/hg.mozilla.org\/([^"]*)\/rev\/([0-9a-f]{12})/g;
    for (var i = 0; i < scrape.length; i++) {
      // There may be multiple revs in different repos in one line of the
      // scrape, so keep exec()ing until we run out.
      while ((matches = re.exec(scrape[i])) != null) {
        revs[matches[1]] = matches[2];
      }
    }
    return revs;
  },
  
  getBuildScrape: function TinderboxJSONUser_getBuildScrape(td, machineRunID) {
    return td.scrape[machineRunID];
  },
  
  parseTinderbox: function TinderboxJSONUser_parseTinderbox(tree, td, data, loadTracker, callback) {
    var self = this;
    var machines = [];
    $(td.build_names).each(function buildMachinesArray(i, name) {
      var machine = data.getMachine(name);
      if (!machine)
        return;
      machines[i] = machine;
    });
  
    var machineResults = {};
    for (var rowIndex = 0; rowIndex < td.build_table.length; rowIndex++) {
    for (var machineIndex = 0; machineIndex < td.build_table[rowIndex].length; machineIndex++) {
      var machine = machines[machineIndex];
      if (!machine)
        continue;
      var build = td.build_table[rowIndex][machineIndex];
      if (build === -1 || build.buildstatus == "null" || !machines[machineIndex])
        continue;
      var state = build.buildstatus; /* building, success, testfailed, busted */
      var rev = "";
      var startTime = new Date(build.buildtime * 1000);
      var endTime = (state != "building") ? new Date(build.endtime * 1000) : 0;
      var machineRunID = build.logfile;
      var buildScrape = self.getBuildScrape(td, machineRunID);
      var revs = self.findRevInScrape(buildScrape);
      // just ignore jobs that can’t be associated to a revision, this also
      // takes care of running builds
      if (!revs)
        continue;
  
      if (machineResults[machineRunID])
        continue;

      var result = machineResults[machineRunID] = new MachineResult ({
        "tree" : tree,
        "machine": machine,
        "slave": self._getSlaveName(buildScrape),
        "runID": machineRunID,
        "state": state,
        "startTime": startTime,
        "endTime": endTime,
        "briefLogURL": "http://tinderbox.mozilla.org/showlog.cgi?log=" + tree + '/' + machineRunID,
        "fullLogURL": "http://tinderbox.mozilla.org/showlog.cgi?log=" + tree + '/' + machineRunID + '&fulltext=1',
        "summaryURL": Config.baseURL + "php/getTinderboxSummary.php?tree=" + tree + "&id=" + machineRunID + '&starred=true',
        "annotatedSummaryURL": Config.baseURL + "php/getTinderboxSummary.php?tree=" + tree + "&id=" + machineRunID,
        "reftestLogURL": Config.baseURL + "php/getTinderboxSummary.php?tree=" + tree + "&id=" + machineRunID + '&reftest=true',
        "revs": revs,
        "notes": [],
        "_scrape": buildScrape,
      });
    } }
    this._loadESNoteData(tree, loadTracker, machineResults, callback);
  },

  _addNotesToMachineResult: function TinderboxJSONUser___addNotesToMachineResult(machineResult, notes) {
    var startTime = machineResult.startTime.getTime() / 1000;
    notes.forEach(function (note) {
      if (note.startTime == startTime && note.slave == machineResult.slave) {
        machineResult.notes.push(note);
      }
    });
  },

  _loadESNoteData: function TinderboxJSONUser__loadNoteData(tree, loadTracker, machineResults, callback) {
    var self = this;

    // Generate the query string data to use to request note data from ElasticSearch;
    // this consists of the tree name and a list of dates encompassing all
    // the machineResults.
    var dates = [];
    for (var resultID in machineResults) {
      if (machineResults[resultID].startTime) {
        var resultDate = UserInterface._ISODateString(machineResults[resultID].startTime);
        if (dates.indexOf(resultDate) == -1 && resultDate != 'NaN-NaN-NaN') {
          dates.push(resultDate);
        }
      }
    }

    if (!dates.length) {
      callback(machineResults);
      return;
    }

    var noteparams = { 
      'tree': Config.treeInfo[tree].primaryRepo,
      'dates': dates 
    };

    loadTracker.addTrackedLoad();
    $.ajax({
      url: Config.wooBugURL,
      data: noteparams,
      dataType: 'text json',
      error: function (request, textStatus, error) {
        loadTracker.loadFailed(textStatus);
      },
      success: function(notes) {
        try {
          // Loop through machineResults and see if we have any matching notes.
          for (var resultID in machineResults) {
            self._addNotesToMachineResult(machineResults[resultID], notes);
          }

          callback(machineResults);
          loadTracker.loadCompleted();
        } catch (e) {
          console.log(e);
          loadTracker.loadFailed('note data is invalid');
        }
      }
    });
  },

};
