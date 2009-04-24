var TinderboxJSONUser = {};

(function(){

TinderboxJSONUser.load = function(tree, loadCallback, failCallback) {
  delete tinderbox_data;
  /**
   * tinderbox is a little quirky with maxdate, so get 24 hours with maxdate
   * 12 hours in the future
   */
  var scriptURL = timeOffset ?
    'http://tinderbox.mozilla.org/showbuilds.cgi?tree=' + treeName +
    '&maxdate=' + (timeOffset + 12 * 3600) + '&hours=24&json=1' :
    "http://tinderbox.mozilla.org/" + treeName + "/json.js"
  $.getScript(scriptURL, function () {
    try {
      if (!tinderbox_data) throw "tinderbox_data is invalid";
      loadCallback(parseTinderbox(tinderbox_data));
    } catch (e) {
      console.log(e);
      failCallback();
    }
  });
}

function getMachineType(name) {
  return {
    os:
    /Linux/.test(name) ? "linux" :
    /OS\s?X/.test(name) ? "osx" :
    /^WIN/i.test(name) ? "windows" :
    /static-analysis/.test(name) ? "linux" : "",

    type:
    /talos/i.test(name) ? "Talos" :
    /nightly/i.test(name) ? "Nightly" :
    /unit test/i.test(name) ? "Unit Test" :
    /depend/i.test(name) ? "Build" :
    /(leak|bloat)/i.test(name) ? "Leak Test" :
    /build/i.test(name) ? "Build" :
    /static-analysis/.test(name) ? "Static Analysis" :
    /(check|test)/.test(name) ? "Unit Test" : ""
  };
}

function nodeIsBR(e) {
  return e && (e.nodeType == Node.ELEMENT_NODE) && e.tagName.toLowerCase() == "br";
}
function getLogURL(id, full, note) {
  return "http://tinderbox.mozilla.org/" + (note ? "addnote" : "showlog") + ".cgi?log=" + treeName + "/" + id + (full ? "&fulltext=1" : "");
}
function processNote(note) {
  return note.replace(/<\/?pre>/g, "").trim().replace(/\n/g, "<br>");
}

function linkBugs(text) {
  return text.replace(/(bug\s*|b=)([1-9][0-9]*)\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
             .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="'+revURL('')+'$2">$1$2</a>');
}

function getScrapeResults(scrape) {
  return $(scrape).map(function() {
    if (this.match(/rev\:/))
      return null;
    var match = this.match(/(.*)\:(.*)/);
    return (match ? { name: match[1], result: match[2]} : { name: this });
  }).filter(function(a) { return a; }).get();
}

function getUnitTestResults(scrape) {
  return $(scrape).map(function() {
    var match = this.match(/(.*)<br\/>(.*)/);
    return match && {
      name: match[1],
      result: match[2]
    };
  }).filter(function (a) { return a; }).get();
}

function getTalosResults(scrape) {
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
    return getScrapeResults(scrape);

  return $('a', cell).get().map(function(ra) {
    var resultURL = ra.getAttribute("href");
    if (resultURL.indexOf("http://graphs-new") != 0)
      return;
    var match = ra.textContent.match(/(.*)\:(.*)/);
    if (!match)
      return null;
    var testname = match[1].trim();
    return {
      name: testname,
      result: match[2].trim(),
      detailsURL: seriesURLs[testname],
      "resultURL": resultURL
    };
  }).filter(function(a) { return a; });
}

function getBuildResults(scrape) {
  var testResults = [];
  // 1 -> Z; 2+3 -> Zdiff
  if (scrape.length >= 2) {
    var match = scrape[1].match(/(.*)\:(.*)/);
    testResults.push({
      name: "Codesize",
      result: match[2]
    });
  }
  if (scrape.length >= 3) {
  	var match = scrape[2].match(/(.*)\:(.*)/);
  	testResults.push({
      name: "Difference",
      result: match[2] + (scrape[3] ? scrape[3] : '' )
    });
  }
  return testResults;
}

function findRevInScrape(scrape) {
  var cell = document.createElement("td");
  cell.innerHTML = scrape.join("<br>\n");
  var reva = $('a[href^="http://hg.mozilla.org"]', cell).get(0);
  if (!reva)
    return null;

  return reva.textContent.substr(4, 12);
}

function getBuildScrape(td, machine, machineRunID) {
  var scrape = td.scrape[machineRunID];
  if (!scrape)
    return null;
  return {
    "rev": findRevInScrape(scrape),
    "testResults": (function (fun) {
        return fun[machine.type] ? fun[machine.type](scrape) : fun.generic(scrape);
      })({
        "Unit Test": getUnitTestResults,
        "Talos": getTalosResults,
        "Leak Test": getScrapeResults,
        "Build": getBuildResults,
        "generic": getScrapeResults
      })
  };
}

function parseTinderbox(td) {
  var machines = [];
  $(td.build_names).each(function(i, name) {
    var machinetype = getMachineType(name);
    if (!machinetype.os || !machinetype.type) {
      return;
    }
    machines[i] = { "name": name, "os": machinetype.os, "type": machinetype.type,
      latestFinishedRun: { id: "", startTime: -1 }, "runs": 0, "runtime": 0 };
  });

  var notes = td.note_array.map(processNote);

  var machineResults = {};
  td.build_table.forEach(function(row) { row.forEach(function(build, machineIndex) {
    if (!build.buildstatus || build.buildstatus == "null" || !machines[machineIndex])
      return;
    var state = build.buildstatus; /* building, success, testfailed, busted */
    var rev = "", testResults = [];
    var startTime = new Date(build.buildtime * 1000);
    var endTime = (state != "building") ? new Date(build.endtime * 1000) : 0;
    var machineRunID = build.logfile;
    var buildScrape = getBuildScrape(td, machines[machineIndex], machineRunID);
    var rev = buildScrape ? buildScrape.rev : "";
    var testResults = buildScrape ? buildScrape.testResults : [];

    if (machineResults[machineRunID])
      return;

    var note = build.hasnote ? notes[build.noteid * 1] : "";

    if (state == 'success' && endTime) {
      machines[machineIndex].runs++;
      machines[machineIndex].runtime+=
        (endTime.getTime() - startTime.getTime())/1000;
    }

    machineResults[machineRunID] = {
      "machine": machines[machineIndex],
      "runID": machineRunID,
      "fullLogURL": getLogURL(machineRunID, true, false),
      "briefLogURL": getLogURL(machineRunID, false, false),
      "addNoteURL": getLogURL(machineRunID, false, true),
      "state": state,
      "startTime": startTime,
      "endTime": endTime,
      "rev": rev,
      "guessedRev": rev,
      "testResults": testResults,
      "note": linkBugs(note),
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

})();
