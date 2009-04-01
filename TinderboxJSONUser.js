var TinderboxJSONUser = {};

(function(){

TinderboxJSONUser.load = function(tree, loadCallback, failCallback) {
  delete tinderbox_data;
  $.getScript("http://tinderbox.mozilla.org/" + treeName + "/json.js", function () {
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
function getTextWithMarker(e) {
  if (e.nodeType == Node.TEXT_NODE)
    return e.data;
  return '<em class="testfail">' + e.textContent + '</em>';
}
function processNote(note) {
  // There are too many line breaks in notes; only use those that make sense.
  // XXX Unfortunately that's not true for the Tinderbox JSON - those notes have no line breaks at all... bug 476872
  return note.replace(/<\/?pre>/g, "")
             .replace(/\n\n/g, "<br>")
             .replace(/\<\/b>]/g, "</b>]<br>")
             .replace(/\b\*\*\*/g, "<br>***")
             .replace(/\b\+\+/g, "<br>++")
             .replace(/\bWARNING/g, "<br>WARNING")
             .replace(/\b(REF)?TEST/g, "<br>$1TEST");
}

function linkBugs(text) {
  return text.replace(/(bug\s*|b=)([1-9][0-9]*)\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
             .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="'+revURL('')+'$2">$1$2</a>');
}

function getUnitTestResults(reva) {
  var e = reva.nextSibling;
  if (e) e = e.nextSibling;
  while (e && e.nodeType != Node.TEXT_NODE)
    e = e.nextSibling;

  if (!e || e.data.trim() != "TUnit")
    return [];

  var testResults = [];
  while (e) { 
    var testname = e.textContent.trim(), testresult = "";
    e = e.nextSibling;
    while (e && nodeIsBR(e)) {
      e = e.nextSibling;
    }
    while (e && !nodeIsBR(e)) {
      testresult += " " + getTextWithMarker(e).trim();
      e = e.nextSibling;
    }
    while (e && nodeIsBR(e)) {
      e = e.nextSibling;
    }
    testResults.push({
      name: testname.trim(),
      result: testresult.trim()
    });
  }
  return testResults;
}

function getTalosResults(tt) {
  var seriesURLs = {};
  $('p a', tt).each(function() {
    if (this.getAttribute("href").indexOf("http://graphs-new") != 0)
      return;
    seriesURLs[this.textContent] = this.getAttribute("href");
  });
  return $('a', tt).get().map(function(ra) {
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
      seriesURL: seriesURLs[testname],
      "resultURL": resultURL
    };
  }).filter(function(a) { return a; });
}

function getLeakResults(tt) {
  return $('abbr', tt).get().map(function(ra) {
    return {
      name: ra.textContent,
      result: ra.nextSibling.textContent.substr(1)
    };
  }).filter(function(a) { return a; });
}

function getBuildScrape(td, machine, machineRunID) {
  if (!td.scrape[machineRunID])
    return null;
  
  var cell = document.createElement("td");
  cell.innerHTML = td.scrape[machineRunID].join("<br>\n");
  var reva = $('a[href^="http://hg.mozilla.org"]', cell).get(0);
  if (!reva)
    return null;

  var rev = reva.textContent.substr(4, 12);

  var testResults = [];
  // Get individual test results or Talos times.
  if (machine.type == "Unit Test") {
    testResults = getUnitTestResults(reva);
  } else if (machine.type == "Talos") {
    testResults = getTalosResults(cell);
  } else if (machine.type == "Leak Test") {
    testResults = getLeakResults(cell);
  } else if (machine.type == "Build") {
    if (td.scrape[machineRunID].length == 2) {
      var match = td.scrape[machineRunID][1].match(/(.*)\:(.*)/);
      testResults = [{ name: "Codesize", result: match[2] }];
    }
  }
  return {
    "rev": rev,
    "testResults": testResults
  };
}

function parseTinderbox(td) {
  var machines = [];
  $(td.build_names).each(function(i, name) {
    var machinetype = getMachineType(name);
    if (!machinetype.os || !machinetype.type) {
      return;
    }
    machines[i] = { "name": name, "os": machinetype.os, "type": machinetype.type, latestFinishedRun: { id: "", startTime: -1 } };
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

  return { "machines": machines, "machineResults": machineResults };
}

})();
