var repoNames = {
  "Firefox": "mozilla-central",
  "Firefox3.5": "releases/mozilla-1.9.1",
  "TraceMonkey": "tracemonkey",
  "Thunderbird": "comm-central",
  "Thunderbird3.0": "comm-central",
  "SeaMonkey": "comm-central",
  "Sunbird": "comm-central",
};

// Allow specifying a tree name in the URL (http://foo/?tree=Firefox3.0)
var treeName = "Firefox";
var match = /[?&]tree=([^&]+)/.exec(document.location.search);
if (match && repoNames[match[1]])
  treeName = match[1];

document.title = treeName + " - Tinderboxpushlog";

var pushlogURL = "http://hg.mozilla.org/" + repoNames[treeName] + "/";
var timezone = "-0700";
var pickupDelay = 0; // number of ms until machine starts building a push

var oss = ["linux", "osx", "windows"];
var machineTypes = ["Build", "Leak Test", "Unit Test", "Nightly", "Talos", "Static Analysis"];
var loadStatus = { pushlog: "loading", tinderbox: "loading" };
var activeResult = "";
var abortOutstandingSummaryLoadings = function () {};
var TinderboxDataLoader = TinderboxJSONUser;
var PushlogDataLoader = PushlogHTMLParser;

startStatusRequest();
setInterval(startStatusRequest, 120 * 1000);
buildFooter();
document.getElementById("pushes").onmousedown = clickNowhere;
$(".machineResult").live("click", resultLinkClick);
AddCommentUI.init(treeName, "http://tinderbox.mozilla.org/addnote.cgi");
AddCommentUI.registerNumSendingCommentChangedCallback(updateStatus);

var machines = [];
var machineResults = {};
var pushes = [];

$("#localTime").bind("click", function () {
  globalStorage[location.host].useLocalTime = true;
  updateTimezone();
  buildPushesList();
  return false;
});

$("#mvtTime").bind("click", function () {
  delete globalStorage[location.host].useLocalTime;
  updateTimezone();
  buildPushesList();
  return false;
});

updateTimezone();

function updateTimezone() {
  document.getElementById('localTime').className =
    globalStorage[location.host].useLocalTime ? 'selected' : '';
  document.getElementById('mvtTime').className =
    !globalStorage[location.host].useLocalTime ? 'selected' : '';
}

function startStatusRequest() {
  if (!checkPreqs())
    return;
  loadStatus = { pushlog: "loading", tinderbox: "loading" };
  updateStatus();

  PushlogDataLoader.load(
    repoNames[treeName],
    function loaded(data) {
      loadStatus.pushlog = "complete";
      updateStatus();
      pushes = data;
      combineResults();
      buildPushesList();
    },
    function failed() {
      loadStatus.tinderbox = "fail";
      updateStatus();
    }
  );

  TinderboxDataLoader.load(
    treeName,
    function loaded(data) {
      loadStatus.tinderbox = "complete";
      updateStatus();
      machines = data.machines;
      machineResults = data.machineResults;
      paintBoxMatrix(generateBoxMatrix());
      combineResults();
      buildPushesList();
    },
    function failed() {
      loadStatus.tinderbox = "fail";
      updateStatus();
    }
  );
}


function buildFooter() {
  var innerHTML = "";
  if (treeName == "Firefox3.5")
    innerHTML += "FF3.5 | ";
  else
    innerHTML += "<a href='?tree=Firefox3.5'>FF3.5<" + "/a> | ";

  if (treeName == "Firefox")
    innerHTML += "FF3.6";
  else
    innerHTML += "<a href='./'>FF3.6<" + "/a>";

  var chooser = document.getElementById("treechooser");
  chooser.innerHTML = innerHTML;
}


function updateStatus() {
  var loading = [];
  for (i in loadStatus) {
    if (loadStatus[i] == "loading")
      loading.push({ tinderbox: "Tinderbox", pushlog: "pushlog" }[i]);
  }
  var text = loading.join(" and ");
  var statusSpan = $("#loading");
  statusSpan.removeClass("loading");
  statusSpan.removeClass("fail");
  if (loading.length) {
    text = "Loading " + text + "...";
    statusSpan.addClass("loading");
  }
  if (loadStatus.tinderbox == "fail") {
    text += " Parsing Tinderbox failed. :-(";
    statusSpan.addClass("fail");
  }
  var numComments = AddCommentUI.numSendingComments;
  if (numComments) {
    text += " Sending " + numComments + " " + (numComments == 1 ? "comment" : "comments") + "...";
    statusSpan.addClass("loading");
  }
  statusSpan.css("visibility", text ? "visible" : "hidden");
  statusSpan.html(text);
}

function stripTags(text) {
  var div = document.createElement("div");
  div.innerHTML = text;
  return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function linkBugs(text) {
  return text.replace(/(bug\s*|b=)([1-9][0-9]*)\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
         .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="'+revURL('')+'$2">$1$2</a>');
}

function generateBoxMatrix() {
  var boxMatrix = {};
  machines.forEach(function(machine) {
    if (!machine.latestFinishedRun.id) {
      // Ignore machines without run information.
      return;
    }
    if (!boxMatrix[machine.type])
      boxMatrix[machine.type] = {};
    if (!boxMatrix[machine.type][machine.os])
      boxMatrix[machine.type][machine.os] = [];
    boxMatrix[machine.type][machine.os].push(machineResults[machine.latestFinishedRun.id]);
  });
  return boxMatrix;
}

function paintBoxMatrix(boxMatrix) {
  var colspans = { "linux": 1, "osx": 1, "windows": 1 };
  for (mt in boxMatrix) {
    for (os in colspans) {
      colspans[os] *= boxMatrix[mt][os] ? boxMatrix[mt][os].length : 1;
    }
  }
  oss.forEach(function(os) {
    document.getElementById(os + "th").setAttribute("colspan", colspans[os]);
  });

  var table = document.getElementsByTagName("table")[0];
  table.removeChild(document.getElementsByTagName("tbody")[0]);
  var tbody = document.createElement("tbody");
  table.appendChild(tbody);
  ["Build", "Leak Test", "Unit Test", "Nightly", "Talos"].forEach(function(t) {
    if (!boxMatrix[t])
      return;
    var row = document.createElement("tr");
    tbody.appendChild(row);
    row.innerHTML = '<th>' + t + '</th>';
    oss.forEach(function(os) {
      if (!boxMatrix[t][os]) {
        row.innerHTML += '<td class="empty" colspan=' + colspans[os] + '></td>';
        return;
      }
      var boxColspan = colspans[os] / boxMatrix[t][os].length;
      boxMatrix[t][os].forEach(function(machineResult) {
        var status = machineResult.state;
        row.innerHTML += '<td colspan="' + boxColspan + '"><a href="' +
                 machineResult.briefLogURL + '" class="' + status +
                 '" resultID="' + machineResult.runID + '">' +
                 resultTitle(t, status) + '</a></td>';
      });
    });
  });
  table.style.visibility = "visible";
  $("a", table).get().forEach(function(cell) {
    cell.addEventListener("click", resultLinkClick, false);
  });
}

function getPushIndexForRev(rev) {
  for (var k = 0; k < pushes.length; k++) {
    if (rev == pushes[k].toprev)
      return k;
  }
  return -1;
}

function getRevForResult(machineResult) {
  if (machineResult.rev)
    return machineResult.rev;

  var machineType = machineResult.machine.type;

  if (machineType == "Talos" || machineType == "Unit Test") {
    // Talos and Unit Test boxes use the builds provided
    // by build boxes and sync their start time with them.
    // If there's a build machine with the same start time,
    // use the same revision.
    for (var j in machineResults) {
      var bMachine = machineResults[j].machine;
      if ((bMachine.type == "Build" || bMachine.type == "Leak Test") &&
        machineResults[j].startTime.getTime() == machineResult.startTime.getTime()) {
        return machineResults[j].guessedRev;
      }
    }
  }

  // Try to find out the rev by comparing times.
  var latestPushRev = "", latestPushTime = -1;
  var machineTime = machineResult.startTime.getTime();
  pushes.forEach(function (push) {
    var pushTime = push.date.getTime();
    if (pushTime + pickupDelay < machineTime) {
      if (latestPushTime < pushTime) {
        latestPushRev = push.toprev;
        latestPushTime = pushTime;
      }
    }
  });
  return latestPushRev;
}

function combineResults() {
  $(pushes).each(function() {
    delete this.results;
  });
  machineTypes.forEach(function (machineType) {
    for (var i in machineResults) {
      var machineResult = machineResults[i];
      if (machineResult.machine.type != machineType)
        continue;

      machineResult.guessedRev = getRevForResult(machineResult);
      var pushIndex = getPushIndexForRev(machineResult.guessedRev);
      if (pushIndex < 0) {
        // This test run started before any of the pushes in the pushlog.
        // Ignore.
        continue;
      }
      if (!pushes[pushIndex].results)
        pushes[pushIndex].results = {};
      if (!pushes[pushIndex].results[machineResult.machine.os])
        pushes[pushIndex].results[machineResult.machine.os] = {};
      if (!pushes[pushIndex].results[machineResult.machine.os][machineResult.machine.type])
        pushes[pushIndex].results[machineResult.machine.os][machineResult.machine.type] = [];
      pushes[pushIndex].results[machineResult.machine.os][machineResult.machine.type].push(machineResult);
      pushes[pushIndex].results[machineResult.machine.os][machineResult.machine.type].sort(function(a, b) {
        var aTime = a.startTime.getTime(), bTime = b.startTime.getTime();
        return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
      });
    }
  });
}

function getMVTDate(date) {
  var d = date;
  var timediff = '';
  if (!globalStorage[location.host].useLocalTime) {
    var hoursdiff = date.getTimezoneOffset()/60 + timezone/100;
    d = new Date(date.getTime() + hoursdiff * 60 * 60 * 1000);
    // properly display half-hour timezones with sign and leading zero
    var absdiff = Math.abs(hoursdiff);
    timediff = ' ' + (hoursdiff < 0 ? '-' : '') +
      (absdiff < 10 ? '0' : '') + (Math.floor(absdiff) * 100 + 60 * (absdiff -
      Math.floor(absdiff)));
  }
  return d.toLocaleString() + timediff;
}

function revURL(rev) {
  return pushlogURL + "rev/" + rev;
}

function resultTitle(type, status) {
  return {
    "building": type + ' is still running',
    "success": type + ' was successful',
    "testfailed": 'Tests failed on ' + type,
    "busted": type + ' is burning'
  }[status];
}

function machineResultLink(machineResult) {
  return '<a href="' + machineResult.briefLogURL +
  '" resultID="' + machineResult.runID +
  '" class="machineResult ' + machineResult.state +
  '" title="' + resultTitle(machineResult.machine.type, machineResult.state) +
  '">' + machineResult.machine.type.charAt(0) +
  (machineResult.note ? '*' : '') +
  '</a>';
}

function buildPushesList() {
  var ul = document.getElementById("pushes");
  ul.innerHTML = pushes.map(function(push, pushIndex) {
    return '<li>\n' +
    '<h2><span class="pusher">' + push.pusher + '</span> &ndash; ' +
    '<span class="date">' + getMVTDate(push.date) + '</span></h2>\n' +
    '<ul class="results">\n' +
    oss.map(function(os) {
      if (!push.results || !push.results[os])
        return '';
      var results = push.results[os];
      return '<li><span class="os ' + os + '">' +
      { "linux": "Linux", "osx": "Mac OS X", "windows": "Windows" }[os] +
      '</span><span class="osresults">' +
      machineTypes.map(function(machineType) {
        if (!results[machineType])
          return '';
        return results[machineType].map(machineResultLink).join(" ");
      }).join("\n") +
      '</span></li>';
    }).join("\n") +
    '</ul>' +
    '<ul class="patches">\n' +
    push.patches.map(function(patch, patchIndex) {
      return '<li>\n' +
      '<a class="revlink" href="' + revURL(patch.rev) + '">' + patch.rev +
      '</a>\n<div class="popup"><span><span class="author">' + patch.author + '</span> &ndash; ' +
      '<span class="desc">' + patch.desc.split("\n")[0] + '</span></span></div>\n' +
      '</li>';
    }).join("\n") +
    '</ul>\n' +
    '</li>';
  }).join("\n");
  $(".patches > li").bind("mouseenter", function startFadeInTimeout() {
    var div = $(".popup:not(.hovering)", this);
    if (div.width() - div.children().width() > 10)
      return; // There's enough space; no need to show the popup.

    var self = $(this);
    var popup = null;
    var fadeInTimer = 0, fadeOutTimer = 0;
    self.unbind("mouseenter", startFadeInTimeout);
    self.bind("mouseleave", clearFadeInTimeout);
    function clearFadeInTimeout() {
      self.unbind("mouseleave", clearFadeInTimeout);
      self.bind("mouseenter", startFadeInTimeout);
      clearTimeout(fadeInTimer);
    }
    fadeInTimer = setTimeout(function () {
      self.unbind("mouseleave", clearFadeInTimeout);
      self.bind("mouseleave", startFadeOutTimeout);
      popup = div.clone().addClass("hovering").insertBefore(div).fadeIn(200);
    }, 500);
    function startFadeOutTimeout() {
      self.unbind("mouseleave", startFadeOutTimeout);
      self.bind("mouseenter", clearFadeOutTimeout);
      fadeOutTimer = setTimeout(function () {
        popup.fadeOut(200);
        fadeOutTimer = setTimeout(function () {
          self.unbind("mouseenter", clearFadeOutTimeout);
          self.bind("mouseenter", startFadeInTimeout);
          popup.remove();
          popup = null;
        }, 200);
      }, 300);
    }
    function clearFadeOutTimeout() {
      self.unbind("mouseenter", clearFadeOutTimeout);
      self.bind("mouseleave", startFadeOutTimeout);
      clearTimeout(fadeOutTimer);
      popup.fadeIn(200);
    }
  });
  setActiveResult(activeResult, false);
}

function clickNowhere(e) {
  if (!$(e.target).is("a, #pushes"))
    setActiveResult("");
}

function resultLinkClick(e) {
  var resultID = this.getAttribute("resultID");
  setActiveResult(resultID, true);
  e.preventDefault();
}

function markActiveResultLinks() {
  if (activeResult)
    $('.machineResult[resultID="' + activeResult + '"]').attr("active", "true");
}

function setActiveResult(resultID, scroll) {
  abortOutstandingSummaryLoadings();
  abortOutstandingSummaryLoadings = function () {};
  if (activeResult) {
    $('.machineResult[resultID="' + activeResult + '"]').removeAttr("active");
  }
  activeResult = resultID;
  markActiveResultLinks();
  if (activeResult) {
    var activeA = $('.results .machineResult[resultID="' + activeResult + '"]').get(0);
    if (activeA && scroll) {
      scrollElemIntoView(activeA, document.getElementById("pushes"), 20);
    }
  }
  displayResult();
}

function scrollElemIntoView(elem, box, margin) {
  var boxBox = box.getBoundingClientRect();
  var elemBox = elem.getBoundingClientRect();
  if (elemBox.top < boxBox.top) {
    // over the scrollport
    animateScroll(box, box.scrollTop - (boxBox.top - elemBox.top) - margin, 150);
  } else if (elemBox.bottom > boxBox.bottom) {
    // under the scrollport
    animateScroll(box, box.scrollTop + (elemBox.bottom - boxBox.bottom) + margin, 150);
  }
}
function animateScroll(scrollBox, end, duration) {
  var startTime = Date.now();
  var start = scrollBox.scrollTop;
  var timer = setInterval(function () {
    var now = Date.now();
    var newpos = 0;
    if (now >= startTime + duration) {
      clearInterval(timer);
      newpos = end;
    } else {
      var t = (now - startTime) / duration;
      t = (1 - Math.cos(t * Math.PI)) / 2; // smooth
      newpos = (1 - t) * start + t * end;
    }
    scrollBox.scrollTop = newpos;
  }, 16);
}

function getMVTTime(date) {
  if (!date.getTime)
    return '';
  var d = date;
  if (!globalStorage[location.host].useLocalTime)
    d = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + timezone/100 * 60 * 60 * 1000);
  return d.toLocaleFormat('%H:%M');
}

function displayResult() {
  var result = machineResults[activeResult];
  var box = document.getElementById("results");
  if (!box)
    return;
  if (!result) {
    box.removeAttribute("state");
    box.className = "";
    box.innerHTML = "";
    return;
  }
  box.setAttribute("state", result.state);
  box.className = result.note ? "hasStar" : "";
  box.innerHTML = (function () {
    return '<h3><span class="machineName">' + result.machine.name +
    '</span> [<span class="state">' + result.state + '</span>] ' +
    '<span class="duration">Started ' + getMVTTime(result.startTime) +
    ', ' + (result.state == "building" ? 'still running...' :
    'finished ') + getMVTTime(result.endTime) + '</span></h3>\n' +
    '<a class="briefLog" href="' + result.briefLogURL +
    '">View Brief Log</a> <a class="fullLog" href="' +
    result.fullLogURL + '">View Full Log</a> <a class="addNote" href="' +
    result.addNoteURL + '">Add a Comment</a> <span id="summaryLoader"></span>' +
    (function () {
      if (!result.testResults.length)
        return '';
      return '<ul class="testResults">\n' +
      result.testResults.map(function(r) {
        return '<li>' + r.name + ': ' + ( r.resultURL ? '<a href="' +
        r.resultURL.replace(/"/g, "&quot;") + '">' + r.result + '</a>' :
        r.result ) + (r.seriesURL ? ' (<a href="' +
        r.seriesURL.replace(/"/g, "&quot;") + '">details</a>)' : '') + '</li>';
      }).join("") +
      '</ul>';
    })() +
    (function () {
      return '<div class="stars">' +
      (function() {
        if (!result.note)
          return '';
        return '<div class="note">' +
        result.note + '</div>';
      })() + '<div class="summary"></div></div>';
    })();
  })();
  AddCommentUI.updateUI();
  setupSummaryLoader(result, box);
}

function setupSummaryLoader(result, box) {
  if (result.state == "building" || result.state == "success")
    return;

  var summaryLoader = $("#summaryLoader").get(0);
  summaryLoader.innerHTML = "Retrieving summary..."
  summaryLoader.className = "loading";
  fetchSummary(activeResult, function(summary) {
    summaryLoader.innerHTML = summary ? "" : "Summary is empty.";
    summaryLoader.className = "";
    if (summary)
      box.className += " hasSummary"
    $(".stars .summary").get(0).innerHTML = summary.replace(/ALSA.*device\n/g, "").replace(/\n/g, "<br>\n");
  }, function() {
    summaryLoader.innerHTML = "Fetching summary failed.";
    summaryLoader.className = "";
  }, function() {
    summaryLoader.innerHTML = "Fetching summary timed out.";
    summaryLoader.className = "";
  });
}

String.prototype.trim = function () {
  var x=this;
  x=x.replace(/^\s*(.*?)/, "$1");
  x=x.replace(/(.*?)\s*$/, "$1");
  return x;
}

var cachedSummaries = {};

function fetchSummary(runID, loadCallback, failCallback, timeoutCallback) {
  if (cachedSummaries[runID]) {
    loadCallback(cachedSummaries[runID]);
    return;
  }
  var onLoad = function(summary) {
    cachedSummaries[runID] = summary;
    loadCallback(summary);
  };
  var req = NetUtils.loadText("summaries/get.php?tree=" + treeName + "&id=" + runID, onLoad, failCallback, timeoutCallback);
  var oldAbort = abortOutstandingSummaryLoadings;
  abortOutstandingSummaryLoadings = function () {
    if (req)
      req.abort();
    oldAbort();
  }
}
