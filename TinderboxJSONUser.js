var TinderboxJSONUser = {

  load: function(tree, timeOffset, loadCallback, failCallback) {
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
    $.getScript(scriptURL, function () {
      try {
        if (!tinderbox_data) throw "tinderbox_data is invalid";
        loadCallback(self.parseTinderbox(tree, tinderbox_data));
      } catch (e) {
        window.tinderboxException = e;
        failCallback(e);
      }
    });
  },

  getMachineType: function(name) {
    return {
      os:
      /Linux/.test(name) ? "linux" :
      /OS\s?X/.test(name) ? "osx" :
      /^WIN/i.test(name) ? "windows" :
      /static-analysis/.test(name) ? "linux" : "",
  
      type:
      /talos/i.test(name) ? "Talos" :
      /nightly/i.test(name) ? "Nightly" :
      /mochitest/i.test(name) ? "Mochitest" :
      /everythingelse/i.test(name) ? "Everythingelse Test" :
      /unit test/i.test(name) ? "Unit Test" :
      /depend/i.test(name) ? "Build" :
      /(leak|bloat)/i.test(name) ? "Leak Test" :
      /build/i.test(name) ? "Build" :
      /static-analysis/.test(name) ? "Static Analysis" :
      /(check|test)/.test(name) ? "Unit Test" : ""
    };
  },
  
  getLogURL: function(tree, id, full, note) {
    return "http://tinderbox.mozilla.org/" + (note ? "addnote" : "showlog") + ".cgi?log=" + tree + "/" + id + (full ? "&fulltext=1" : "");
  },
  processNote: function(note) {
    return note.replace(/<\/?pre>/g, "").trim().replace(/\n/g, "<br>");
  },
  
  getScrapeResults: function(scrape) {
    return $(scrape).map(function() {
      if (this.match(/rev\:/) || this.match(/s\:/) || this.match(/try\-/))
        return null;
      var match = this.match(/(.*)\:(.*)/);
      return (match ? { name: match[1], result: match[2]} : { name: this });
    }).filter(function() { return this; }).get();
  },
  
  getUnitTestResults: function(scrape) {
    return $(scrape).map(function() {
      var match = this.match(/(.*)<br\/>(.*)/);
      return match && {
        name: match[1],
        result: match[2]
      };
    }).filter(function() { return this; }).get();
  },
  
  getTalosResults: function(scrape) {
    var seriesURLs = {};
    var foundSomething = false;
    var cell = document.createElement("td");
    cell.innerHTML = scrape.join("<br>\n");
    $('p a', cell).each(function() {
      if (this.getAttribute("href").indexOf("http://graphs-new") != 0)
        return;
      seriesURLs[this.textContent] = this.getAttribute("href");
      foundSomething = true;
    });
  
    if (!foundSomething)
      return this.getScrapeResults(scrape);
  
    return $('a', cell).map(function() {
      var resultURL = $(this).attr("href");
      if (resultURL.indexOf("http://graphs-new") != 0)
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
    }).filter(function() { return this; }).get();
  },
  
  findRevInScrape: function(scrape) {
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
  
  getBuildScrape: function(td, machine, machineRunID) {
    var self = this;
    var scrape = td.scrape[machineRunID];
    if (!scrape)
      return null;
    return {
      "rev": self.findRevInScrape(scrape),
      "testResults": (function (fun) {
          return (fun[machine.type] ? fun[machine.type] : fun.generic).call(self, scrape);
        })({
          "Unit Test": self.getUnitTestResults,
          "Mochitest": self.getUnitTestResults,
          "Everythingelse Test": self.getUnitTestResults,
          "Talos": self.getTalosResults,
          "Leak Test": self.getScrapeResults,
          "Build": self.getScrapeResults,
          "generic": self.getScrapeResults
        })
    };
  },
  
  parseTinderbox: function(tree, td) {
    var self = this;
    var machines = [];
    $(td.build_names).each(function(i, name) {
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
    td.build_table.forEach(function(row) { row.forEach(function(build, machineIndex) {
      if (!build.buildstatus || build.buildstatus == "null" || !machines[machineIndex])
        return;
      var state = build.buildstatus; /* building, success, testfailed, busted */
      var rev = "", testResults = [];
      var startTime = new Date(build.buildtime * 1000);
      var endTime = (state != "building") ? new Date(build.endtime * 1000) : 0;
      var machineRunID = build.logfile;
      var buildScrape = self.getBuildScrape(td, machines[machineIndex], machineRunID);
      var rev = buildScrape ? buildScrape.rev : "";
      var testResults = buildScrape ? buildScrape.testResults : [];
  
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
  
      machineResults[machineRunID] = {
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
        "testResults": testResults,
        "note": note,
        "errorParser": build.errorparser,
      };
      if (state != "building") {
        if (startTime.getTime() > machines[machineIndex].latestFinishedRun.startTime) {
          machines[machineIndex].latestFinishedRun = {
            id: machineRunID,
            "startTime": startTime.getTime()
          };
        }
      }
    }); });
  
    machines.forEach(function(machine) {
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
  String.prototype.trim = function () {
    var x=this;
    x=x.replace(/^\s*(.*?)/, "$1");
    x=x.replace(/(.*?)\s*$/, "$1");
    return x;
  }
}
