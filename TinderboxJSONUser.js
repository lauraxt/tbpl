var TinderboxJSONUser = {

  load: function TinderboxJSONUser_load(tree, timeOffset, loadCallback, failCallback) {
    delete tinderbox_data;
    var self = this;
    /**
     * tinderbox is a little quirky with maxdate, so get 24 hours with maxdate
     * 12 hours in the future
     */
    var scriptURL = timeOffset ?
      'http://tinderbox.mozilla.org/showbuilds.cgi?tree=' + tree +
      '&maxdate=' + (timeOffset + 12 * 3600) + '&hours=24&json=1' :
      "http://tinderbox.mozilla.org/" + tree + "/json.js"
    $.getScript(scriptURL, function tinderboxJSONGetScriptCallback() {
      try {
        if (!tinderbox_data) throw "tinderbox_data is invalid";
        loadCallback(self.parseTinderbox(tree, tinderbox_data));
      } catch (e) {
        window.tinderboxException = e;
        failCallback(e);
      }
    });
  },

  getMachineType: function TinderboxJSONUser_getMachineType(name) {
    return {
      os:
      /Linux/.test(name) ? "linux" :
      /Fedora/.test(name) ? "linux" :
      /OS\s?X/.test(name) ? "osx" :
      /WINNT/i.test(name) ? "windows" :
      /static-analysis/.test(name) ? "linux" : "",
  
      type:
      /talos/i.test(name) ? "Talos" :
      /nightly/i.test(name) ? "Nightly" :
      /opt.*mochitest/i.test(name) ? "Opt Mochitest" :
      /debug.*mochitest/i.test(name) ? "Debug Mochitest" :
      /mochitest/i.test(name) ? "Mochitest" :
      /opt.*crashtest/i.test(name) ? "Opt Crashtest" :
      /debug.*crashtest/i.test(name) ? "Debug Crashtest" :
      /crashtest/i.test(name) ? "Crashtest" :
      /opt.*jsreftest/i.test(name) ? "Opt JSReftest" :
      /debug.*jsreftest/i.test(name) ? "Debug JSReftest" :
      /jsreftest/i.test(name) ? "JSReftest" :
      /opt.*reftest/i.test(name) ? "Opt Reftest" :
      /debug.*reftest/i.test(name) ? "Debug Reftest" :
      /reftest/i.test(name) ? "Reftest" :
      /opt.*xpcshell/i.test(name) ? "Opt XPCShellTest" :
      /debug.*xpcshell/i.test(name) ? "Debug XPCShellTest" :
      /xpcshell/i.test(name) ? "XPCShellTest" :
      /depend/i.test(name) ? "Opt Build" :
      /(leak|bloat)/i.test(name) ? "Debug Build" :
      /build/i.test(name) ? "Opt Build" :
      /static-analysis/.test(name) ? "Static Analysis" :
      /(check|test)/.test(name) ? "Unit Test" : ""
    };
  },
  
  getLogURL: function TinderboxJSONUser_getLogURL(tree, id, full, note) {
    return "http://tinderbox.mozilla.org/" + (note ? "addnote" : "showlog") + ".cgi?log=" + tree + "/" + id + (full ? "&fulltext=1" : "");
  },
  processNote: function TinderboxJSONUser_processNote(note) {
    return note.replace(/<\/?pre>/g, "").trim().replace(/\n/g, "<br>");
  },
  
  findRevInScrape: function TinderboxJSONUser_findRevInScrape(scrape) {
    if (!scrape)
      return "";
    var cell = document.createElement("td");
    cell.innerHTML = scrape.join("<br>\n");
    var revLinks = $('a[href^="http://hg.mozilla.org"]', cell).get();
    for (var i = 0; i < revLinks.length; i++) {
      var linkText = revLinks[i].textContent;
      if (linkText.indexOf("mobile") == -1) {
        return linkText.substr(4, 12);
      }
    }

    // Tryserver uses try-c49054c95eba instead
    match = scrape.join("").match(/try\-([0-9a-f]{12})/);
    return match ? match[1] : null;
  },
  
  getBuildScrape: function TinderboxJSONUser_getBuildScrape(td, machineRunID) {
    return td.scrape[machineRunID];
  },
  
  parseTinderbox: function TinderboxJSONUser_parseTinderbox(tree, td) {
    var self = this;
    var machines = [];
    $(td.build_names).each(function buildMachinesArray(i, name) {
      var machinetype = self.getMachineType(name);
      if (!machinetype.os || !machinetype.type) {
        return;
      }
      machines[i] = {
        "name": name,
        "os": machinetype.os,
        "type": machinetype.type,
        latestFinishedRun: { id: "", startTime: -1 },
        "runs": 0,
        "runtime": 0
      };
    });
  
    var notes = td.note_array.map(self.processNote);
  
    var machineResults = {};
    td.build_table.forEach(function forEachTinderboxTableColumn(row) { row.forEach(function forEachTinderboxTableRow(build, machineIndex) {
      if (!build.buildstatus || build.buildstatus == "null" || !machines[machineIndex])
        return;
      var state = build.buildstatus; /* building, success, testfailed, busted */
      var rev = "";
      var startTime = new Date(build.buildtime * 1000);
      var endTime = (state != "building") ? new Date(build.endtime * 1000) : 0;
      var machineRunID = build.logfile;
      var buildScrape = self.getBuildScrape(td, machineRunID);
      var rev = self.findRevInScrape(buildScrape);
  
      if (machineResults[machineRunID])
        return;
  
      if (state != "building" && !rev)
        return;
  
      var note = build.hasnote ? notes[build.noteid * 1] : "";
  
      if (state == 'success' && endTime) {
        machines[machineIndex].runs++;
        machines[machineIndex].runtime+=
          (endTime.getTime() - startTime.getTime())/1000;
      }
  
      machineResults[machineRunID] = new MachineResult ({
        "tree" : tree,
        "machine": machines[machineIndex],
        "runID": machineRunID,
        "fullLogURL": self.getLogURL(tree, machineRunID, true, false),
        "briefLogURL": self.getLogURL(tree, machineRunID, false, false),
        "addNoteURL": self.getLogURL(tree, machineRunID, false, true),
        "state": state,
        "startTime": startTime,
        "endTime": endTime,
        "rev": rev,
        "guessedRev": rev,
        "note": note,
        "errorParser": build.errorparser,
        "_scrape": buildScrape,
      });
      if (state != "building") {
        if (startTime.getTime() > machines[machineIndex].latestFinishedRun.startTime) {
          machines[machineIndex].latestFinishedRun = {
            id: machineRunID,
            "startTime": startTime.getTime()
          };
        }
      }
    }); });
  
    machines.forEach(function setAverageCycleTimeOnMachine(machine) {
      if (machine.runs) {
        machine.averageCycleTime = Math.ceil(machine.runtime/machine.runs);
      }
      delete machine.runs;
      delete machine.runtime;
    });
  
    return { "machines": machines, "machineResults": machineResults };
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
      "Opt Mochitest": self.getUnitTestResults,
      "Debug Mochitest": self.getUnitTestResults,
      "Opt Everythingelse Test": self.getUnitTestResults,
      "Debug Everythingelse Test": self.getUnitTestResults,
      "Everythingelse Test": self.getUnitTestResults,
      "Talos": self.getTalosResults,
      "Debug Build": self.getScrapeResults,
      "Opt Build": self.getScrapeResults,
      "generic": self.getScrapeResults
    });
  },
  
  getScrapeResults: function MachineResult_getScrapeResults(scrape) {
    return $(scrape).map(function parseGenericTestScrapeLine() {
      if (this.match(/rev\:/) || this.match(/s\:/) || this.match(/try\-/))
        return null;
      var match = this.match(/(.*)\:(.*)/);
      return (match ? { name: match[1], result: match[2]} : { name: this });
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
