var TinderboxHTMLParser = {};

(function(){

TinderboxHTMLParser.load = function(tree, loadCallback, failCallback) {
  NetUtils.loadDom("fetchraw.php?site=tinderbox&url=" + tree + "/", function (doc) {
    try {
      loadCallback(parseTinderbox(doc));
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
function saneLineBreakNote(note) {
  // There are too many line breaks in notes; only use those that make sense.
  return note.replace(/\\n/g, "\n")
             .replace(/\\("|'|\\)/g, "$1")
             .replace(/<\/?pre>/g, "")
             .replace(/\n\n/g, "<br>")
             .replace(/\]\n/g, "]<br>")
             .replace(/\n\*\*\*/g, "<br>***")
             .replace(/\n\+\+/g, "<br>++")
             .replace(/\nWARNING/g, "<br>WARNING")
             .replace(/\n(REF)?TEST/g, "<br>$1TEST");
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

  if (!e || e.data != " TUnit")
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
  $('p a[href^="http://graphs-new"]', tt.parentNode).each(function() {
    seriesURLs[this.textContent] = this.getAttribute("href");
  });
  return $('a[href^="http://graphs-new"]', tt.parentNode).get().map(function(ra) {
    var resultURL = ra.getAttribute("href");
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

function parseTinderbox(doc) {
  if (!$("#build_waterfall tr > td:first-child > a", doc).length)
    throw "I can't parse that";

  var machines = [];
  $("#build_waterfall th ~ td > font", doc).each(function(i, cell) {
    var name = cell.textContent.replace(/%/, "").trim();
    var machinetype = getMachineType(name);
    if (!machinetype.os || !machinetype.type) {
      return;
    }
    machines[i] = { "name": name, "os": machinetype.os, "type": machinetype.type, latestFinishedRun: { id: "", startTime: -1 } };
  });
  
  var todayDate = $("#build_waterfall tr > td:first-child > a", doc).get(0).childNodes[1].data.match(/[0-9\/]+/)[0];
  function parseTime(str) {
    if (str.indexOf("/") < 0)
      str = todayDate + " " + str;
    return new Date(str + " " + timezone);
  }
  
  var notes = [];
  var script = $(".script", doc).get(0).textContent;
  var match = script.match(/notes\[([0-9]+)\] = "(.*)";/g);
  if (match) {
    match.forEach(function(m) {
      var match = m.match(/notes\[([0-9]+)\] = "(.*)";/);
      notes[match[1]*1] = linkBugs(saneLineBreakNote(match[2]));
    });
  }
  
  var machineResults = {};
  var seenMachines = [];
  $("#build_waterfall td > tt", doc).get().forEach(function(tt) {
    var td = tt.parentNode;
    var a = $('a[title]', td).get(0); // should be 'a[onclick^="return log"]', but jQuery doesn't like that
    if (!a) {
      console.log(td);
    }
    var state = a.title; /* building, success, testfailed, busted */
    var machineIndex = 0, startTime = 0, endTime = 0, rev = "", machineRunID = "", testResults = [];
    if (state == "building") {
      var match = a.getAttribute("onclick").match(/log\(event,([0-9]+),.*,'(.*)','Started ([^,]*),/);
      machineRunID = match[2];
      machineIndex = match[1] * 1;
      if (!machines[machineIndex])
        return;
      startTime = parseTime(match[3]);
    } else {
      var match = a.getAttribute("onclick").match(/log\(event,([0-9]+),.*,'(.*)','Started ([^,]*), finished ([^']*)'/);
      machineRunID = match[2];
      machineIndex = match[1] * 1;
      if (!machines[machineIndex])
        return;
      startTime = parseTime(match[3]);
      endTime = parseTime(match[4]);
      var reva = $('a[href^="http://hg.mozilla.org"]', td).get(0);
      if (reva) {
        rev = reva.textContent.substr(4, 12);

        // Get individual test results or Talos times.
        if (machines[machineIndex].type == "Unit Test") {
          testResults = getUnitTestResults(reva);
        } else if (machines[machineIndex].type == "Talos") {
          testResults = getTalosResults(tt);
        }
      }
    }

    if (machineResults[machineRunID])
      return;

    var stars = [];
    $('a', td).get().forEach(function(s) {
      var onclick = s.getAttribute("onclick");
      if (!onclick)
        return;
      var match = onclick.match(/note\(event,([0-9]+),/);
      if (!match)
        return;
      stars.push(notes[match[1]*1]);
    });

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
      "note": stars.join("")
    };
    if (state != "building") {
      if (startTime.getTime() > machines[machineIndex].latestFinishedRun.startTime) {
        machines[machineIndex].latestFinishedRun = {
          id: machineRunID,
          "startTime": startTime.getTime()
        };
      }
    }
  });
  return { "machines": machines, "machineResults": machineResults };
}

})();
