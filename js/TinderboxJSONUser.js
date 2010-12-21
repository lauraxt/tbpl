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
          loadCallback(self.parseTinderbox(tree, tinderbox_data, data));
          loadTracker.loadCompleted();
        }
      });
    });
  },

  _getTimeRangesForPushes: function TinderboxJSONUser__getTimeRangesForPushes(pushes, now) {
    var rangeDuration = 12 * 60 * 60 * 1000; // 12 hours
    var maxResultDelayAfterPush = 12 * 60 * 60 * 1000; // 12 hours
    var latestPushDate = pushes[pushes.length - 1].date;
    var requestEnd = new Date(Math.min(latestPushDate.getTime() + maxResultDelayAfterPush, now));
    var requestStart = pushes[0].date;
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

  processNote: function TinderboxJSONUser_processNote(note) {
    return note.replace(/<\/?pre>/g, "").trim().replace(/\n/g, "<br>");
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
  
  parseTinderbox: function TinderboxJSONUser_parseTinderbox(tree, td, data) {
    var self = this;
    var machines = [];
    $(td.build_names).each(function buildMachinesArray(i, name) {
      var machine = data.getMachine(name);
      if (!machine)
        return;
      machines[i] = machine;
    });
  
    var notes = td.note_array.map(self.processNote);
  
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

      var note = build.hasnote ? notes[build.noteid * 1] : "";

      var result = machineResults[machineRunID] = new MachineResult ({
        "tree" : tree,
        "machine": machine,
        "runID": machineRunID,
        "state": state,
        "startTime": startTime,
        "endTime": endTime,
        "briefLogURL": "http://tinderbox.mozilla.org/showlog.cgi?log=" + tree + '/' + machineRunID,
        "fullLogURL": "http://tinderbox.mozilla.org/showlog.cgi?log=" + tree + '/' + machineRunID + '&fulltext=1',
        "summaryURL": Config.baseURL + "php/getSummary.php?tree=" + tree + "&id=" + machineRunID,
        "revs": revs,
        "note": note,
        "errorParser": build.errorparser,
        "_scrape": buildScrape,
      });
    } }
    return machineResults;
  }
};

if (!String.prototype.trim) {
  String.prototype.trim = function String_trim() {
    var x=this;
    x=x.replace(/^\s*(.*?)/, "$1");
    x=x.replace(/(.*?)\s*$/, "$1");
    return x;
  }
}

function MachineResult(data) {
  for (var i in data) {
    this[i] = data[i];
  }
}

MachineResult.prototype = {
  getTestResults: function MachineResult_getTestResults() {
    var self = this;
    var machine = this.machine;
    var scrape = this._scrape;
    if (!scrape)
      return [];
    return (function callRightScrapeParser(fun) {
      return (fun[machine.type] ? fun[machine.type] : fun.generic).call(self, scrape);
    })({
      "Unit Test": self.getUnitTestResults,
      "Mochitest": self.getUnitTestResults,
      "Everythingelse Test": self.getUnitTestResults,
      "Talos Performance": self.getTalosResults,
      "Build": self.getScrapeResults,
      "generic": self.getScrapeResults
    });
  },
  
  getScrapeResults: function MachineResult_getScrapeResults(scrape) {
    return $(scrape).map(function parseGenericTestScrapeLine() {
      if (this.match(/rev\:/) || this.match(/s\:/) || this.match(/try\-/))
        return null;
      var match = this.match(/(.*)(\:|<br\/>)(.*)/);
      return (match ? { name: match[1], result: match[3]} : { name: this });
    }).filter(function filterNull() { return this; }).get();
  },
  
  getUnitTestResults: function MachineResult_getUnitTestResults(scrape) {
    return $(scrape).map(function parseUnitTestScrapeLine() {
      var match = this.match(/(.*)<br\/>(.*)/);
      return match && {
        name: match[1],
        result: match[2]
      };
    }).filter(function filterNull() { return this; }).get();
  },
  
  getTalosResults: function MachineResult_getTalosResults(scrape) {
    var seriesURLs = {};
    var foundSomething = false;
    var cell = document.createElement("td");
    cell.innerHTML = scrape.join("<br>\n");
    $('p a', cell).each(function lookForGraphLink() {
      if (this.getAttribute("href").indexOf("http://graphs") != 0)
        return;
      seriesURLs[this.textContent] = this.getAttribute("href");
      foundSomething = true;
    });
  
    if (!foundSomething)
      return this.getScrapeResults(scrape);

    var failLines = $(scrape).map(function parseFailedTalosRunScrapeLine() {
      return this.match(/FAIL\:(.*)/) && { name: this };
    }).filter(function filterNull() { return this; }).get();
  
    return failLines.concat($('a', cell).map(function parseEachGraphLink() {
      var resultURL = $(this).attr("href");
      if (resultURL.indexOf("http://graphs") != 0)
        return;
      var match = this.textContent.match(/(.*)\:(.*)/);
      if (!match)
        return null;
      var testname = match[1].trim();
      return {
        name: testname,
        result: match[2].trim(),
        detailsURL: seriesURLs[testname],
        "resultURL": resultURL
      };
    }).filter(function filterNull() { return this; }).get());
  },
};
