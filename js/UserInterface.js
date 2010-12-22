/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var UserInterface = {

  _controller: null,
  _treeName: "",
  _data: null,
  _activeResult: "",
  _storage: null,

  init: function UserInterface_init(controller) {
    var self = this;
    this._controller = controller;
    this._treeName = controller.treeName;
    this._data = controller.getData();
    this._setupStorage();

    document.title = "[0] " + controller.treeName + " - Tinderboxpushlog";

    this._refreshMostRecentlyUsedTrees();
    this._buildTreeSwitcher();
    this._buildLegend();
    this._buildTreeInfo();

    $("#localTime").bind("click", function localTimeClick() {
      self._switchTimezone(true);
      return false;
    });

    $("#mvtTime").bind("click", function mvtTimeClick() {
      self._switchTimezone(false);
      return false;
    });

    $("#pushes, #topbar").bind("mousedown", function pushesMouseDown(e) {
      self._clickNowhere(e);
    });

    $(".dropdown").live("click", function dropdownClick(ev) {
      $(this).addClass("open");
    });

    $("html").bind("mousedown", function clickAnywhere(e) {
      // Close open dropdowns if the event's target is not inside
      // an open dropdown.
      if ($(e.target).parents(".dropdown.open").length == 0)
        $(".dropdown").removeClass("open");
    });

    SummaryLoader.init();
    AddCommentUI.init("http://tinderbox.mozilla.org/addnote.cgi", this._storage);
    AddCommentUI.registerNumSendingCommentChangedCallback(function commentSendUpdater(changedResult) {
      self.updateStatus();
      if (changedResult) {
        // Starredness is reflected in several places:
        //  - a star after the letter in the results column next to the push
        //  - the list of failed jobs in the top right corner
        //  - the number of unstarred failures in the title
        //  - the panel showing the star if the starred result is selected
        // We need to refresh all these places.
        self.handleUpdatedPush(changedResult.push);
        self._updateTreeStatus();
        self._setActiveResult(self._activeResult, false);
      }
    });
    AddCommentUI.registerNumSendingBugChangedCallback(function bugSendUpdater() {
      self.updateStatus();
    });

    this._updateTimezoneDisplay();

    $("#pushes").append(
      $('<li id="goBackLi"><a id="goBack" href="#" title="add another ' + Config.goBackPushes + ' pushes"></a></li>')
        .children().first().bind('click', function goBack() {
          self._controller.extendPushRange(-Config.goBackPushes);
          return false;
        }).parent());

    return {
      status: function (status) {
        self.updateStatus(status);
      },
      handleUpdatedPush: function (push) {
        self.handleUpdatedPush(push);
      },
      handleInfraStatsUpdate: function (infraStats) {
        self.handleInfraStatsUpdate(infraStats);
      },
      handleInitialPushlogLoad: function () {
        $("#pushes").removeClass("initialload");
      },
    };
  },

  handleUpdatedPush: function UserInterface_handleUpdatedPush(push) {
    $("#nopushes").remove();
    var existingPushNode = $("#push-" + push.id);
    if (existingPushNode.length) {
      this._refreshPushResultsInPushNode(push, existingPushNode);
    } else {
      this._generatePushNode(push).insertBefore(this._getInsertBeforeAnchor(push));
    }
  },

  _getInsertBeforeAnchor: function UserInterface__getInsertBeforeAnchor(push) {
    var allPushNodes = $("#pushes").children(".push");
    // allPushNodes are sorted in decreasing pushID order.
    // The first pushNode with pushID < push.id will be our
    // insertBefore anchor. If all existing pushes have
    // pushID > push.id, the goBack arrow container li is the
    // anchor.
    for (var i = 0; i < allPushNodes.length; i++) {
      var currentPushNode = allPushNodes.eq(i);
      if (+currentPushNode.attr("data-id") < push.id)
        return currentPushNode;
    }
    return $("#goBackLi");
  },

  handleInfraStatsUpdate: function UserInterface_handleInfraStatsUpdate(infraStats) {
    var html = '<dt>Branch</dt><dd><a href="http://build.mozilla.org/builds/pending.html">pending</a>' +
      ' / <a href="http://build.mozilla.org/builds/running.html">running</a></dd>';
    var total = {pending: 0, running: 0};
    for (var branch in infraStats) {
      html += "<dt>" + branch + "</dt><dd>" + infraStats[branch].pending + " / " + infraStats[branch].running + "</dd>";
      total.pending += infraStats[branch].pending;
      total.running += infraStats[branch].running;
    }
    html += "<dt>Total</dt><dd>" + total.pending + " / " + total.running + "</dd>";
    $("#infrastructure").html(html);
  },

  updateStatus: function UserInterface_updateStatus(status) {
    if (status && status.loadpercent == 1) {
      this._updateTreeStatus();
    }
    var statusSpan = $("#loading");
    statusSpan.removeClass("loading");
    statusSpan.removeClass("fail");
    var text = "";
    if (status) {
      if (status.loadpercent < 1) {
        text += "Loading " + Math.ceil(status.loadpercent * 100) + "% …";
        statusSpan.addClass("loading");
      } else if (status.failed) {
        text += "Loading failed: " + status.failed.join(", ");
        statusSpan.addClass("fail");
      }
    }
    var numComments = AddCommentUI.numSendingComments;
    if (numComments) {
      text += " Sending " + numComments + " " + (numComments == 1 ? "comment" : "comments") + "…";
      statusSpan.addClass("loading");
    }
    var numBugs = AddCommentUI.numSendingBugs;
    if (numBugs) {
      text += " Marking " + numBugs + " " + (numBugs == 1 ? "bug" : "bugs") + "…";
      statusSpan.addClass("loading");
    }
    statusSpan.css("visibility", text ? "visible" : "hidden");
    statusSpan.html(text);
  },
  
  _setupStorage: function UserInterface__setupStorage() {
    try {
      this._storage = window.localStorage;
    } catch (e) {}
    if (!this._storage) {
      try {
        if (window.globalStorage)
          this._storage = globalStorage[location.host];
      } catch (e) {}
    }
    this._storage = this._storage || {};
  },

  _mostRecentlyUsedTrees: function() {
    if (!("mostRecentlyUsedTrees" in this._storage))
      this._setMostRecentlyUsedTrees([]);
    if (JSON.parse(this._storage.mostRecentlyUsedTrees).length != 3)
      this._setMostRecentlyUsedTrees(Controller.keysFromObject(Config.repoNames).slice(0, 3));
    return JSON.parse(this._storage.mostRecentlyUsedTrees);
  },

  _setMostRecentlyUsedTrees: function(trees) {
    this._storage.mostRecentlyUsedTrees = JSON.stringify(trees);
  },

  _refreshMostRecentlyUsedTrees: function UserInterface__refreshMostRecentlyUsedTrees() {
    if (this._mostRecentlyUsedTrees().indexOf(this._treeName) == -1) {
      // Remove the least recently used tree and add this tree as the most recently used one.
      // The array is ordered from recent to not recent.
      this._setMostRecentlyUsedTrees([this._treeName].concat(this._mostRecentlyUsedTrees().slice(0, 2)));
    }
  },

  _buildTreeSwitcher: function UserInterface__buildTreeSwitcher() {
    var mruList = $('<ul id="mruList"></ul>').appendTo("#treechooser");
    var moreListContainer = $('<div id="moreListContainer" class="dropdown"><h2>more</h2></div></li>').appendTo("#treechooser");
    var moreList = $('<ul id="moreList"></ul>').appendTo(moreListContainer);
    var self = this;
    Controller.keysFromObject(Config.repoNames).forEach(function (tree, i) {
      var isMostRecentlyUsedTree = (self._storage.mostRecentlyUsedTrees.indexOf(tree) != -1);
      var treeLink = self._treeName == tree ?
        "<strong>" + tree + "</strong>" :
        "<a href='?tree=" + tree + "'>" + tree + "</a>";
      $("<li>" + treeLink + "</li>").appendTo(isMostRecentlyUsedTree ? mruList : moreList);
    });
  },

  _buildLegend: function UserInterface__buildLegend() {
    var legend = $('#legend');
    for (var name in Config.testNames) {
      $('<dt>' + Config.testNames[name] + '</dt><dd>' + name + '</dd>').appendTo(legend);
    }
    $('<dt>…*</dt><dd>commented</dd>' +  
      '<dt class="pending">lightgray</dt><dd>pending</dd>' +
      '<dt class="running">gray</dt><dd>running</dd>' +
      '<dt class="success">green</dt><dd>success</dd>' +
      '<dt class="testfailed">orange</dt><dd>tests failed</dd>' +
      '<dt class="exception">purple</dt><dd>infrastructure exception</dd>' +
      '<dt class="busted">red</dt><dd>build error</dd>' + 
      '<dt class="retry">blue</dt><dd>build has been restarted</dd>' +
      '<dt class="unknown">black</dt><dd>unknown error</dd>' +
      '').appendTo(legend);
  },

  _buildTreeInfo: function UserInterface__buildTreeInfo() {
    $.ajax({
      url: "http://tinderbox.mozilla.org/" + this._treeName + "/status.html",
      dataType: "text",
      success: function (data) {
        var div = $("<div>").html(data);
        $("#preamble", div).remove();
        $("#status-container", div).contents().appendTo("#tree-status");
      }
    });

    google.setOnLoadCallback(function() {
      var service = new google.gdata.calendar.CalendarService("mozilla-tinderbox");

      var items = [
        {
          elem: document.getElementById("current-sheriff"),
          calendar: "http://www.google.com/calendar/feeds/j6tkvqkuf9elual8l2tbuk2umk%40group.calendar.google.com/public/full",
          fallback: "#developers"
        },
        {
          elem: document.getElementById("current-releng"),
          calendar: "http://www.google.com/calendar/feeds/aelh98g866kuc80d5nbfqo6u54%40group.calendar.google.com/public/full",
          fallback: "#build"
        }
      ];

      function refreshItem(item) {
        // Ignore DST and find Mozilla Standard Time
        var mst = new Date(Date.now() +
                           (new Date()).getTimezoneOffset() * 60 * 1000 +
                           Config.mvtTimezoneOffset * 60 * 60 * 1000);

        var query = new google.gdata.calendar.CalendarEventQuery(item.calendar);
        query.setMinimumStartTime(new google.gdata.DateTime(mst, true));
        query.setOrderBy("starttime");
        query.setSortOrder("ascending");
        query.setMaxResults("1");
        query.setSingleEvents(true);

        service.getEventsFeed(query, function(root) {
          var result = root.feed.getEntries();
          if (!!result.length)
            result = result[0].getTitle().getText();
          else
            result = item.fallback;

          if (result.indexOf("#") == 0)
            result = '<a href="irc://irc.mozilla.org/' + result.slice(1) + '">' + result + '</a>';

          item.elem.innerHTML = result;
        }, function(error) {
          item.elem.innerHTML = '<span style="color:red; text-decoration:underline" title="Error: ' + ((error.cause) ? error.cause.statusText : error.message) + '">probably ' + item.fallback + '</span>';
        });
      }

      for (var i in items) {
        var item = items[i];
        refreshItem(item);
        setInterval(refreshItem, 1000 * 60 * 60 /* every hour */, item);
      }
    });
    google.load("gdata", "1.s");
  },

  _updateTimezoneDisplay: function UserInterface__updateTimezoneDisplay() {
    document.getElementById('localTime').className = this._useLocalTime() ? 'selected' : '';
    document.getElementById('mvtTime').className = !this._useLocalTime() ? 'selected' : '';
  },

  _switchTimezone: function UserInterface__switchTimezone(local) {
    var self = this;
    this._setUseLocalTime(local);
    this._updateTimezoneDisplay();
    $(".date").each(function() {
      var elem = $(this);
      if (!elem.attr("data-timestamp"))
        return;
      var date = new Date();
      date.setTime(elem.attr("data-timestamp"));
      elem.html(self._getDisplayDate(date));
    });
  },

  _linkBugs: function UserInterface__linkBugs(text) {
    return text.replace(/(bug\s*|b=)([1-9][0-9]*)\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
           .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="http://hg.mozilla.org/' + Config.repoNames[this._treeName] + '/rev/$2">$1$2</a>');
  },

  _updateTreeStatus: function UserInterface__updateTreeStatus() {
    var machines = this._data.getMachines();
    var self = this;
    var failing = [];
    var unstarred = 0;
    machines.forEach(function addMachineToTreeStatus1(machine) {
      var result = machine.latestFinishedRun;
      if (!result)
        // Ignore machines without run information.
        return;
      // errors in front, failures in back
      switch(result.state)
      {
        case 'busted':
        case 'exception':
        case 'unknown':
          failing.unshift(result);
        break;
        case 'testfailed':
          failing.push(result);
        break;
      }
      if (!result.note &&
          (result.state == 'busted' || result.state == 'testfailed' || result.state == 'exception' ||
           result.state == 'unknown'))
        ++unstarred;
    });
    $('#status').html(
      '<strong>' + failing.length + '</strong> Job' + (failing.length != 1 ? 's are' : ' is') + ' failing:<br />' +
      failing.map(function(machineResult) {
        var className = "machineResult " + machineResult.state;
        var title = self._resultTitle(machineResult);
        if (machineResult.note) {
          className += " hasNote";
          title = "(starred) " + title;
        }
        return '<a href="' + machineResult.briefLogURL + '"' +
               ' onclick="UserInterface.clickMachineResult(event, this)"' +
               ' class="' + className + '"' +
               ' title="' + title + '"' +
               (machineResult.runID == self._activeResult ? ' active="true"' : '') +
               ' resultID="' + machineResult.runID + '"' +
               '>' + title + '</a>';
      }).join('\n')
    );
    document.title = document.title.replace(/\[\d*\]/, "[" + unstarred + "]");
  },

  _useLocalTime: function UserInterface__useLocalTime() {
    return this._storage.useLocalTime == "true"; // Storage stores Strings, not Objects :-(
  },

  _setUseLocalTime: function UserInterface__setUseLocalTime(value) {
    if (value)
      this._storage.useLocalTime = "true";
    else
      delete this._storage.useLocalTime;
  },

  _getTimezoneAdaptedDate: function UserInterface__getTimezoneAdaptedDate(date) {
    if (this._useLocalTime())
      return date;

    var hoursdiff = date.getTimezoneOffset() / 60 + Config.mvtTimezoneOffset;
    return new Date(date.getTime() + hoursdiff * 60 * 60 * 1000);
  },

  _pad: function UserInterface__pad(n) {
    return n < 10 ? '0' + n : n;
  },

  _getDisplayDate: function UserInterface__getDisplayDate(date) {
    var timezoneName = this._useLocalTime() ? "" : " " + Config.mvtTimezoneName;
    var d = this._getTimezoneAdaptedDate(date);
    var pad = this._pad;
    // Thu Jan 7 20:25:03 2010 (PST)
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " +
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " +
    d.getDate() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + " " +
    d.getFullYear() + timezoneName;
  },
  
  _getDisplayTime: function UserInterface__getDisplayTime(date) {
    if (!date.getTime)
      return '';

    var d = this._getTimezoneAdaptedDate(date);
    var pad = this._pad;
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  },

  _resultTitle: function UserInterface__resultTitle(result) {
    var number = this._numberForMachine(result.machine);
    var type = result.machine.type + (number ? " " + number : "") + (result.machine.debug ? " debug" : " opt");
    return {
      "pending": type + ' is pending',
      "running": type + ' is still running',
      "success": type + ' was successful',
      "testfailed": 'Tests failed on ' + type + ' on ' + Config.OSNames[result.machine.os],
      "exception": 'Infrastructure exception on ' + type + ' on ' + Config.OSNames[result.machine.os],
      "busted": type + ' on ' + Config.OSNames[result.machine.os] + ' is burning',
      "retry": type + ' on ' + Config.OSNames[result.machine.os] + ' has been restarted',
      "unknown": 'Unknown error on ' + type + ' on ' + Config.OSNames[result.machine.os],
    }[result.state] + (result.state == "pending" ? "" : ', ' + this._timeString(result));
  },
  
  _timeString: function UserInterface__timeString(result) {
    if (["running", "pending"].indexOf(result.state) == -1) {
      return 'took ' + Math.ceil((result.endTime.getTime() - result.startTime.getTime()) / 1000 / 60)
        + 'mins';
    }
    if (!result.machine.averageCycleTime)
      return 'ETA unknown';
    var elapsed = Math.ceil(((new Date()).getTime() - result.startTime.getTime()) / 1000);
    if (elapsed > result.machine.averageCycleTime)
      return 'ETA any minute now';
    return 'ETA ~' + Math.ceil((result.machine.averageCycleTime - elapsed) / 60)
      + 'mins';
  },

  _numberForMachine: function UserInterface__numberForMachine(machine) {
    var match = /([0-9]+)\/[0-9]/.exec(machine.name);
    if (match)
      return match[1];
    
    if (machine.name.match(/mochitest\-other/))
      return "oth";

    // Mobile mochitests named mochitest1 instead of mochitests-1/4.
    match = /mochitest([1-9])/.exec(machine.name);
    if (match)
      return match[1];

    if (machine.name.match(/unit chrome/))
      return "c";

    if (machine.name.match(/unit browser\-chrome/))
      return "b-c";

    return "";
  },

  _machineResultLink: function UserInterface__machineResultLink(machineResult, onlyNumber) {
    var machine = machineResult.machine;
    /*
     * pending or running builds should not link to a log and should not open
     * the details panel because the runID will change once the run is finished
     * and because the details show no more info than the tooltip
     */
    return '<a' + (['running', 'pending'].indexOf(machineResult.state) == -1 ? 
      ' href="' + machineResult.briefLogURL + '"' +
      ' resultID="' + machineResult.runID + '"' +
      (machineResult.runID == this._activeResult ? ' active="true"' : '') +
      ' onclick="UserInterface.clickMachineResult(event, this)"' : "") +
    ' class="machineResult ' + machineResult.state +
    '" title="' + this._resultTitle(machineResult) +
    '">' + (machine.type == "Mochitest" && onlyNumber ? this._numberForMachine(machine) :
      Config.testNames[machine.type] + this._numberForMachine(machine)) +
    (machineResult.note ? '*' : '') +
    '</a>';
  },

  _addSuggestionLink: function UserInterface__addSuggestionLink(machineResults, target) {
    if (machineResults.suggestions) {
      for (var i = 0; i < machineResults.suggestions.length; ++i) {
        var item = machineResults.suggestions[i];
        var link =
        $("<a href=\"#\">Bug " + item.id + "</a>").click(function() {
          AddCommentUI.toggleSuggestion(this.getAttribute("data-id"), this);
          return false;
        }).attr("title", "[" + item.status.trim() + "] " + item.summary)
        .attr("data-id", item.id)
        .appendTo(target);
        if (AddCommentUI.shouldAutoStarBug(item.id))
          link.click();
      }
    }
  },

  _machineGroupResultLink: function UserInterface__machineGroupResultLink(machineType, machineResults) {
    if (!machineResults.length)
      return "";
    var self = this;
    return '<span class="machineResultGroup" machineType="' +
    Config.testNames[machineType] +
    '"> ' +
    machineResults.map(function linkMachineResult(a) { return self._machineResultLink(a, true); }).join(" ") +
    ' </span>';
  },

  _buildHTMLForOS: function UserInterface__buildHTMLForOS(os, debug, results) {
    var self = this;
    var osresults = Controller.keysFromObject(Config.testNames).map(function buildHTMLForPushResultsOnOSForMachineType(machineType) {
      if (!results[machineType] || results[machineType].length == 0)
        return '';

      // Sort results.
      function resultOrder(a, b) {
        // Sort finished before running before pending results,
        // and then via start time.
        if (a.state != b.state &&
            (a.state == "pending" || b.state == "pending" ||
             a.state == "running" || b.state == "running")) {
          // When does b go after a? Return -1 in those cases.
          if ((b.state == "pending") ||
              (b.state == "running" && a.state != "pending"))
            return -1;
          return 1;
        }
        return a.startTime.getTime() - b.startTime.getTime();
      }
      if (Config.treesWithGroups.indexOf(self._treeName) != -1 &&
          Controller.keysFromObject(Config.groupedMachineTypes).indexOf(machineType) != -1) {
        results[machineType].sort(function machineResultSortOrderComparison(a, b) {
          // machine.type does not mess up the numeric/alphabetic sort
          var numA = a.machine.type + self._numberForMachine(a.machine);
          var numB = b.machine.type + self._numberForMachine(b.machine);
          if (numA == numB)
            return resultOrder(a, b);

          return numA > numB ? 1 : -1;
        });
        return self._machineGroupResultLink(machineType, results[machineType]);
      }
      results[machineType].sort(resultOrder);
      return results[machineType].map(function linkMachineResults(a) { return self._machineResultLink(a); }).join(" ");
    }).join("");

    if (!osresults)
      return '';

    return '<li><span class="os ' + os + '">' + Config.OSNames[os] + debug +
    '</span><span class="osresults">' + osresults + '</span></li>';
  },

  _buildHTMLForPushResults: function UserInterface__buildHTMLForPushResults(push) {
    var self = this;
    return Controller.keysFromObject(Config.OSNames).map(function buildHTMLForPushResultsOnOS(os) {
      if (!push.results || !push.results[os])
        return '';
      return (push.results[os].opt   ? self._buildHTMLForOS(os, " opt"  , push.results[os].opt  ) : '') + 
             (push.results[os].debug ? self._buildHTMLForOS(os, " debug", push.results[os].debug) : '');
    }).join("\n");
  },
  
  _buildHTMLForPushPatches: function UserInterface__buildHTMLForPushPatches(push) {
    var self = this;
    return push.patches.map(function buildHTMLForPushPatch(patch, patchIndex) {
      return '<li>\n' +
      '<a class="revlink" href="' + self._changesetURL(patch.rev) + '">' + patch.rev +
      '</a>\n<div class="popup"><span><span class="author">' + patch.author + '</span> &ndash; ' +
      '<span class="desc">' + self._linkBugs(patch.desc.split("\n")[0]) + '</span>' +
      (function buildHTMLForPatchTags() {
        if (!patch.tags.length)
          return '';

        return ' <span class="logtags">' + $(patch.tags).map(function () {
          return ' <span class="' + this.type + '">' + this.name + '</span>';
        }).get().join('') + '</span>';
      })() +
      '</span></div>\n' +
      '</li>';
    }).join("\n");
  },

  _changesetURL: function UserInterface__changesetUrl(rev) {
      return 'http://hg.mozilla.org/' + Config.repoNames[this._treeName] + '/rev/' + rev;
  },

  _generatePushNode: function UserInterface__generatePushNode(push) {
    var self = this;
    var nodeHtml = '<li class="push" id="push-' + push.id + '" data-id="' + push.id + '">\n' +
      '<h2><a href="' + this._controller.getURLForPusherFilteringView(push.pusher) +
      '" class="pusher">' + push.pusher + '</a> &ndash; ' +
      '<a class="date" data-timestamp="' + push.date.getTime() +
      '" href="' + this._controller.getURLForSinglePushView(push.toprev) + '">' +
      self._getDisplayDate(push.date) + '</a>' +
      ' <span class="talosCompare">(<label>compare: <input class="revsToCompare" type="checkbox" value="' + push.toprev + '"></label>)</span>' +
      '<button class="csetList" onclick="UserInterface._listChangesetsForPush(\''+ push.toprev +'\')">List changeset URLs</button>' +
      '</h2>\n' +
      '<ul class="results"></ul>\n' +
      '<ul class="patches"></ul>\n' +
      '</li>';
    var node = $(nodeHtml);
    $(".patches", node).html(this._buildHTMLForPushPatches(push));
    this._refreshPushResultsInPushNode(push, node);
    this._installComparisonClickHandler(node);
    this._installTooltips(node);
    return node;
  },
  
  _refreshPushResultsInPushNode: function UserInterface__refreshPushResultsInPushNode(push, node) {
    $(".results", node).html(this._buildHTMLForPushResults(push));
  },

  _listChangesetsForPush: function(toprev) {
    var self = this;
    var push = this._data.getPushForRev(toprev);
    var urls = push.patches.map(function (patch) { return self._changesetURL(patch.rev); });
    // We want to show the csets' URLs first-to-last for pasting into bugs,
    // instead of last-to-first as they're displayed in the UI
    urls.reverse();
    var html = "<!DOCTYPE html><title>Changeset URLs for push " + toprev +
               "</title><pre>" + urls.join('\n') + "</pre>";
    window.open("data:text/html," + escape(html), "", "width=600,height=300,scrollbars=yes");
  },

  clickMachineResult: function UserInterface_clickMachineResult(e, result) {
    e.preventDefault();
    this._resultLinkClick(result);
  },

  /**
   * Finds pushes with checked boxes in the UI, gets the first revision number
   * from each, and opens mconnors talos compare script in a new window.
   *
   * Usage:
   * - Selecting two pushes will trigger the comparison.
   *
   * TODO:
   * - allow to select multiple revs, show them somewhere in the ui with a
   *   button that does the compare
   */
  _installComparisonClickHandler: function UserInterface__installComparisonClickHandler(context) {
    $(".revsToCompare", context).bind("click", function clickRevsToCompare(e) {
      // get selected revisions
      var revs = $(".revsToCompare").map(function() {
        return this.checked ? this.value : null;
      }).get();
      // the new rev is first in the dom

      if (revs.length < 2)
        return;

      // I dont like popups, but I dont see a better way right now
      var perfwin = window.open("http://perf.snarkfest.net/compare-talos/index.php?oldRevs=" +
                                revs.slice(1).join(",") + "&newRev=" + revs[0] + "&tests=" +
                                Config.talosTestNames.join(",") + "&submit=true");
      perfwin.focus();
    });
  },

  _installTooltips: function UserInterface__installTooltips(context) {
    $(".patches > li", context).bind("mouseenter", function startFadeInTimeout() {
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
      fadeInTimer = setTimeout(function afterFadeIn() {
        self.unbind("mouseleave", clearFadeInTimeout);
        self.bind("mouseleave", startFadeOutTimeout);
        popup = div.clone().addClass("hovering").insertBefore(div).fadeIn(200);
      }, 500);
      function startFadeOutTimeout() {
        self.unbind("mouseleave", startFadeOutTimeout);
        self.bind("mouseenter", clearFadeOutTimeout);
        fadeOutTimer = setTimeout(function afterMouseLeft() {
          popup.fadeOut(200);
          fadeOutTimer = setTimeout(function afterFadeOut() {
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
  },

  _clickNowhere: function UserInterface__clickNowhere(e) {
    if (!$(e.target).is("a, #pushes"))
      this._setActiveResult("");
  },
  
  _resultLinkClick: function UserInterface__resultLinkClick(link) {
    var resultID = link.getAttribute("resultID");
    this._setActiveResult(resultID, true);
    AddCommentUI.clearAutoStarBugs();
  },
  
  _markActiveResultLinks: function UserInterface__markActiveResultLinks() {
    if (this._activeResult)
      $('.machineResult[resultID="' + this._activeResult + '"]').attr("active", "true");
  },
  
  _setActiveResult: function UserInterface__setActiveResult(resultID, scroll) {
    SummaryLoader._abortOutstandingSummaryLoadings();
    SummaryLoader._abortOutstandingSummaryLoadings = function deactivateActiveResult() {};
    if (this._activeResult) {
      $('.machineResult[resultID="' + this._activeResult + '"]').removeAttr("active");
    }
    this._activeResult = resultID;
    this._markActiveResultLinks();
    this._displayResult();
    if (this._activeResult) {
      var activeA = $('.results .machineResult[resultID="' + this._activeResult + '"]').get(0);
      if (activeA && scroll) {
        this._scrollElemIntoView(activeA, document.getElementById("pushes"), 20);
      }
    }
  },
  
  _scrollElemIntoView: function UserInterface__scrollElemIntoView(elem, box, margin) {
    var boxBox = box.getBoundingClientRect();
    var elemBox = elem.getBoundingClientRect();
    if (elemBox.top < boxBox.top) {
      // over the scrollport
      this._animateScroll(box, box.scrollTop - (boxBox.top - elemBox.top) - margin, 150);
    } else if (elemBox.bottom > boxBox.bottom) {
      // under the scrollport
      this._animateScroll(box, box.scrollTop + (elemBox.bottom - boxBox.bottom) + margin, 150);
    }
  },

  _animateScroll: function UserInterface__animateScroll(scrollBox, end, duration) {
    var startTime = Date.now();
    var start = scrollBox.scrollTop;
    var timer = setInterval(function animatedScrollTimerIntervalCallback() {
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
  },

  _durationDisplay: function UserInterface__durationDisplay(result) {
    return 'started ' + this._getDisplayTime(result.startTime) +
      ', ' + (result.state == "running" ? 'still running... ' : 'finished ' +
      this._getDisplayTime(result.endTime) + ', ') + this._timeString(result);
  },
  
  _displayResult: function UserInterface__displayResult() {
    var self = this;
    var result = this._data.getMachineResult(this._activeResult);
    var box = $("#details");
    var body = $("body");
    if (!result) {
      body.removeClass("details");
      box.removeAttr("state");
      box.empty();
      return;
    }

    body.addClass("details");
    box.attr("state", result.state);
    box.removeClass("hasStar");
    if (result.note)
      box.addClass("hasStar");
    box.html((function htmlForResultInBottomBar() {
      var revs = result.revs;
      return '<div><h3>' + result.machine.name +
      ' [<span class="state ' + result.state + '">' + result.state + '</span>]</h3>\n' +
      '<span>using revision' + (Controller.keysFromObject(revs).length != 1 ? 's' : '') + ': ' + (function(){
        var ret = [];
        for(var repo in revs) {
          ret.push('<a href="http://hg.mozilla.org/' + repo + '/rev/' + revs[repo] + '">' + repo + '/' + revs[repo] + '</a>');
        }
        return ret;
      })().join(', ') + '</span>' +
      '<a href="' + result.briefLogURL + '">view brief log</a>' +
      '<a href="' + result.fullLogURL + '">view full log</a>' +
      '<div id="autoStar"></div>' +
      '<a class="addNote" href="http://tinderbox.mozilla.org/addnote.cgi?log=' + self._treeName + '/' + result.runID + '">add a comment</a>' +
      '<span class="duration">' + self._durationDisplay(result) + '</span></div>' +
      (function htmlForTestResults() {
        var testResults = result.getTestResults();
        if (!testResults.length)
          return '';
        return '<ul id="results">\n' +
        testResults.map(function htmlForTestResultEntry(r) {
          return '<li>' + r.name +
            (r.result ? ': ' + (r.resultURL ? '<a href="' + r.resultURL.replace(/"/g, "&quot;") +
                                              '">' + r.result + '</a>'
                                            : r.result)
                      : '') +
            (r.detailsURL ? ' (<a href="' + r.detailsURL.replace(/"/g, "&quot;") +
                            '">details</a>)'
                          : '') +
            '</li>';
        }).join("") +
        '</ul>';
      })() +
      (function htmlForPopup() {
        return '<div class="stars">' +
        (function htmlForNoteInPopup() {
          if (!result.note)
            return '';
          return '<div class="note">' +
          self._linkBugs(result.note) + '</div>';
        })() + '<div class="summary"><span id="summaryLoader"></span></div></div>';
      })();
    })());
    AddCommentUI.updateUI();
    SummaryLoader.setupSummaryLoader(result, box.get(0));
  },

};
