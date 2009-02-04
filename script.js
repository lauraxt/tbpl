// Allow specifying a tree name in the URL (http://foo/?tree=Firefox3.0)
var treeName = "Firefox";
var match = /[?&]tree=([^&]+)/.exec(document.location.search);
if (match)
    treeName = match[1];

var repoNames = {
    "Firefox": "mozilla-central",
    "Firefox3.1": "releases/mozilla-1.9.1",
    "TraceMonkey": "tracemonkey",
    "Thunderbird": "comm-central",
    "Thunderbird3.0": "comm-central",
    "SeaMonkey": "comm-central",
    "Sunbird": "comm-central",
}

var pushlogURL = "http://hg.mozilla.org/" + repoNames[treeName] + "/";
var tinderboxURL = "http://tinderbox.mozilla.org/" + treeName + "/json.js";
var timezone = "-0800";
var pickupDelay = 1 * 60 * 1000; // number of ms until machine starts building a push

var oss = ["linux", "osx", "windows"];
var machineTypes = ["Build", "Leak Test", "Unit Test", "Talos", "Nightly", "Static Analysis"];
var loadStatus = { pushlog: "loading", tinderbox: "loading" };
var activeResult = -1;
var boxMatrix;

startStatusRequest();
setInterval(startStatusRequest, 120 * 1000);
buildFooter();

function startStatusRequest() {
    loadStatus = { pushlog: "loading", tinderbox: "loading" };
    updateStatus();

    // Load pushlog
    document.getElementById("pushlogiframe").contentWindow.location.href = "fetchraw.php?site=pushlog&tree=" + treeName;
    document.getElementById("pushlogiframe").onload = pushlogLoaded;
    
    setTimeout(function() {
        var s1 = document.createElement("script");
        s1.src = tinderboxURL;
        s1.type = "text/javascript";
        var s2 = document.createElement("script");
        s2.src = "data:text/javascript,tinderboxLoaded();";
        s2.type = "text/javascript";
        document.getElementsByTagName("head")[0].appendChild(s1);
        document.getElementsByTagName("head")[0].appendChild(s2);
    }, 0);
}

function buildFooter() {
    var innerHTML = "";
    if (treeName == "Firefox3.1")
        innerHTML += "FF3.1 | ";
    else
        innerHTML += "<a href='?tree=Firefox3.1'>FF3.1<" + "/a> | ";

    if (treeName == "Firefox")
        innerHTML += "FF3.2";
    else
        innerHTML += "<a href='./'>FF3.2<" + "/a>";

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
    var statusSpan = document.getElementById("loading");
    statusSpan.className = "";
    if (loading.length) {
        text = "Loading " + text + "...";
        statusSpan.className = "loading";
    }
    if (loadStatus.tinderbox == "fail") {
        text += " Parsing Tinderbox failed. :-(";
        statusSpan.className = "fail";
    }
    statusSpan.style.visibility = text ? "visible" : "hidden";
    statusSpan.innerHTML = text;
}

function getMachineType(name) {
    return [
        /Linux/.test(name) ? "linux" :
        /OS\s?X/.test(name) ? "osx" :
        /^WIN/i.test(name) ? "windows" :
        /bsmedberg/.test(name) ? "linux" : "",

        /talos/i.test(name) ? "Talos" :
        /nightly/i.test(name) ? "Nightly" :
        /unit test/i.test(name) ? "Unit Test" :
        /depend/i.test(name) ? "Build" :
        /(leak|bloat)/i.test(name) ? "Leak Test" :
        /build/i.test(name) ? "Build" :
        /bsmedberg/.test(name) ? "Static Analysis" :
        /(check|test)/.test(name) ? "Unit Test" : ""
    ];
}

var machines = [];
var machineResults = {};

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
function stripTags(text) {
    var div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    return text.replace(/(bug\s*)?\b([0-9]{5,7})\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
               .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="'+revURL('')+'$2">$1$2</a>');
}

function tinderboxLoaded() {
    try {
        parseTinderbox(tinderbox_data);
        loadStatus.tinderbox = "complete";
        updateBoxMatrix();
        maybeCombineResults();
    } catch (e) {
        alert(e);
        loadStatus.tinderbox = "fail";
    }
    updateStatus();
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

function getTalosResults(cell) {
    var seriesURLs = {};
    $("p a", cell).each(function() {
        seriesURLs[this.textContent] = this.getAttribute("href");
    });
    return $('a[href^="http://graphs"]', cell).get().map(function(ra) {
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
    }).filter(function(a) a);
}


function getBuildScrape(td, machineIndex, machineRunID) {
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
    if (machines[machineIndex].type == "Unit Test") {
        testResults = getUnitTestResults(reva);
    } else if (machines[machineIndex].type == "Talos") {
        testResults = getTalosResults(cell);
    }
    return {
        "rev": rev,
        "testResults": testResults
    };
}

function parseTinderbox(td) {
    machines = [];
    boxMatrix = {};
    td.build_names.forEach(function(name) {
        var [os, type] = getMachineType(name);
        if (!os || !type) {
            alert(name + " failed the name test");
            return;
        }
        machines.push({ "name": name, "os": os, "type": type, latestFinishedRun: { id: "", startTime: -1 } });
    });

    var notes = td.note_array.map(processNote);

    machineResults = {};
    var seenMachines = [];
    td.build_table.forEach(function(row) { row.forEach(function(build, machineIndex) {
        if (!build.buildstatus || build.buildstatus == "null" || !machines[machineIndex])
            return;
        var state = build.buildstatus; /* building, success, testfailed, busted */
        var rev = "", testResults = [];
        var startTime = new Date(build.buildtime * 1000);
        var endTime = (state != "building") ? new Date(build.endtime * 1000) : 0;
        var machineRunID = build.logfile;
        var buildScrape = getBuildScrape(td, machineIndex, machineRunID);
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
            "note": note
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
    buildBoxMatrix();
}

function buildBoxMatrix() {
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
}

function updateBoxMatrix() {
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
    ["Build", "Leak Test", "Unit Test", "Talos", "Nightly"].forEach(function(t) {
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
    $("a", table).each(function() {
        this.addEventListener("click", resultLinkClick, false);
    });
}

var pushes = [];

function pushlogLoaded() {
    var doc = this.contentDocument;
    if (!doc.getElementsByTagName("table").length)
        return;

    pushes = [];
    var table = doc.getElementsByTagName("table")[0];
    $("td[rowspan]:first-child", table).each(function() {
        var numPatches = this.getAttribute("rowspan") * 1;
        var patches = [];
        for (var i = 0, row = this.parentNode; i < numPatches && row; i++, row = row.nextSibling) {
            var rev = $("td.age", row).get(0).firstChild.firstChild.data;
            var strong = row.lastChild.firstChild.innerHTML;
            var dashpos = strong.indexOf(String.fromCharCode(8212));
            var author = strong.substring(0, dashpos - 1);
            var desc = strong.substring(dashpos + 2);
            patches.push({
               "rev": rev,
               "author": author,
               "desc": linkBugs(stripTags(desc))
            });
        }
        var pusher = this.firstChild.firstChild.data;
        var date = new Date($(".date", this).get(0).innerHTML);
        pushes.push({
            "pusher": pusher,
            "date": date,
            "toprev": patches[0].rev,
            "patches": patches
        });
    });
    loadStatus.pushlog = "complete";
    updateStatus();
    maybeCombineResults();
}

function maybeCombineResults() {
    if (loadStatus.pushlog == "complete" && loadStatus.tinderbox == "complete")
        combineResults();
}

function getPushIndexForRev(rev) {
    for (var k = 0; k < pushes.length; k++) {
        if (rev == pushes[k].toprev)
            return k;
    }
    return -1;
}

function getRevForResult(machineResult) {
    if (machineResult.rev != "")
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
    pushes.forEach(function(push) {
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
    machineTypes.forEach(function(machineType) {
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

    buildPushesList();
}

function getPSTDate(date) {
    var d = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + timezone/100 * 60 * 60 * 1000);
    return d.toLocaleString() + ' ' + timezone;
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

function buildPushesList() {
    var ul = document.getElementById("pushes");
    ul.innerHTML = pushes.map(function(push, pushIndex) {
        return '<li>\n'
        + '<h2><span class="pusher">' + push.pusher + '</span> &ndash; '
        + '<span class="date">' + getPSTDate(push.date) + '</span></h2>\n'
        + '<ul class="results">\n'
        + oss.map(function(os) {
            if (!push.results || !push.results[os])
                return '';
            var results = push.results[os];
            return '<li><span class="os ' + os + '">'
            + { "linux": "Linux", "osx": "Mac OS X", "windows": "Windows" }[os]
            + '</span><span class="osresults">'
            + machineTypes.map(function(machineType) {
                if (!results[machineType])
                    return '';
                return results[machineType].map(function(machineResult) {
                    return '<a href="' + machineResult.briefLogURL
                    + '" resultID="' + machineResult.runID
                    + '" class="machineResult ' + machineResult.state
                    + '" title="' + resultTitle(machineType, machineResult.state)
                    + '">' + machineType.charAt(0)
                    + (machineResult.note ? '*' : '')
                    + '</a>';
                }).join(" ");
            }).join("\n")
            + '</span></li>';
        }).join("\n")
        + '</ul>'
        + '<ul class="patches">\n'
        + push.patches.map(function(patch, patchIndex) {
            return '<li>\n'
            + '<a class="revlink" href="' + revURL(patch.rev) + '">' + patch.rev
            + '</a>\n<span class="author">' + patch.author + '</span> &ndash; '
            + '<span class="desc">' + patch.desc.split("\n")[0] + '</span>\n'
            + '</li>';
        }).join("\n")
        + '</ul>\n'
        + '</li>';
    }).join("\n");
    $("a.machineResult").each(function() {
        this.addEventListener("click", resultLinkClick, false);
    });
    setActiveResult(activeResult, false);
}

function resultLinkClick(e) {
    var resultID = this.getAttribute("resultID");
    setActiveResult(resultID, true);
    e.preventDefault();
}

function setActiveResult(resultID, scroll) {
    if (activeResult != -1) {
        var activeA = $('.results a[resultID="' + activeResult + '"]').get(0);
        if (activeA)
            activeA.removeAttribute("active");
    }
    activeResult = resultID;
    if (activeResult != -1) {
        var activeA = $('.results a[resultID="' + activeResult + '"]').get(0);
        if (activeA) {
            activeA.setAttribute("active", "true");
            if (scroll)
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
    var timer = setInterval(function() {
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

function getPSTTime(date) {
    if (!date.getTime)
        return '';
    var d = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + timezone/100 * 60 * 60 * 1000);
    return d.toLocaleFormat('%H:%M');
}

function displayResult() {
    var result = machineResults[activeResult];
    var box = document.getElementById("results");
    if (!result || !box)
        return;
    box.setAttribute("state", result.state);
    box.className = result.note ? "hasStar" : "";
    box.innerHTML = (function() {
        return '<h3><span class="machineName">' + result.machine.name
        + '</span> [<span class="state">' + result.state + '</span>] '
        + '<span class="duration">Started ' + getPSTTime(result.startTime)
        + ', ' + (result.state == "building" ? 'still running...' :
        'finished ') + getPSTTime(result.endTime) + '</span></h3>\n'
        + '<a class="briefLog" href="' + result.briefLogURL
        + '">View Brief Log</a> <a class="fullLog" href="'
        + result.fullLogURL + '">View Full Log</a> <a class="addNote" href="'
        + result.addNoteURL + '">Add a Comment</a>'
        + (function() {
            if (!result.testResults.length)
                return '';
            if (result.machine.type == "Unit Test") {
                return '<ul class="unitTestResults">\n'
                + result.testResults.map(function(r) {
                    return '<li>' + r.name + ': ' + r.result + '</li>';
                }).join("")
                + '</ul>';
            }
            if (result.machine.type == "Talos") {
                return '<ul class="talosResults">\n'
                + result.testResults.map(function(r) {
                    return '<li>' + r.name + ': <a href="' + r.resultURL
                    + '">' + r.result + '</a>'
                    + (r.seriesURL ? ' (<a href="' + r.seriesURL
                    + '">details</a>)' : '') + '</li>';
                }).join("")
                + '</ul>';
            }
        })()
        + (function() {
            if (!result.note)
                return '';
            return '<div class="stars">'
            + result.note + '</div>';
        })();
    })();
    var addNoteLink = $("a.addNote").get(0);
    addNoteLink.addEventListener("click", logLinkClick, false);
}

function logLinkClick(e) {
    var div = document.getElementById("addNotePopup");

    // Recreate iframe to keep it transparent while loading.
    var iframe = div.getElementsByTagName("iframe")[0];
    if (iframe)
        div.removeChild(iframe);
    var iframe = document.createElement("iframe");
    iframe.setAttribute("src", this.getAttribute("href"));
    div.appendChild(iframe);

    div.getElementsByTagName("a")[0].onclick = function(e2) {
        div.className = '';
        e2.preventDefault();
    };
    div.className = "open";
    e.preventDefault();
}

String.prototype.trim = function() {
  var x=this;
  x=x.replace(/^\s*(.*?)/, "$1");
  x=x.replace(/(.*?)\s*$/, "$1");
  return x;
}
