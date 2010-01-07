var UserInterface = {

  _controller: null,
  _treeName: "",
  _data: null,
  _activeResult: "",

  init: function UserInterface_init(controller) {
    var self = this;
    this._controller = controller;
    this._treeName = controller.treeName;
    this._data = controller.getData();

    document.title = controller.treeName + " - Tinderboxpushlog";

    this._buildTreeSwitcher();

    $("#localTime").bind("click", function localTimeClick() {
      self._switchTimezone(true);
      return false;
    });

    $("#mvtTime").bind("click", function mvtTimeClick() {
      self._switchTimezone(false);
      return false;
    });

    document.getElementById("pushes").onmousedown = function pushesMouseDown(e) {
      self._clickNowhere(e);
    };

    AddCommentUI.init("http://tinderbox.mozilla.org/addnote.cgi");
    AddCommentUI.registerNumSendingCommentChangedCallback(function commentSendUpdater() {
      self.updateStatus();
    });

    this._updateTimezoneDisplay();

  },

  loadedData: function UserInterface_loadedData(kind) {
    if (kind == "machineResults")
      this._paintBoxMatrix(this._generateBoxMatrix());
    this._buildPushesList();
  },

  updateStatus: function UserInterface_updateStatus() {
    var loading = [];
    for (i in this._controller.loadStatus) {
      if (this._controller.loadStatus[i] == "loading")
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
    if (this._controller.loadStatus.tinderbox == "fail") {
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
  },
  
  _buildTreeSwitcher: function UserInterface__buildTreeSwitcher() {
    var labels = [];
    var numTrees = 3, i = 0;
    for (var tree in Config.repoNames) {
      if (i >= numTrees)
        break;
      labels.push(this._treeName == tree ? tree : "<a href='" + (i == 0 ? "./" : "?tree=" + tree) + "'>" + tree + "<" + "/a>");
      i++;
    }
    $("#treechooser").html(labels.join(" | "));
  },

  _updateTimezoneDisplay: function UserInterface__updateTimezoneDisplay() {
    document.getElementById('localTime').className =
      globalStorage[location.host].useLocalTime ? 'selected' : '';
    document.getElementById('mvtTime').className =
      !globalStorage[location.host].useLocalTime ? 'selected' : '';
  },

  _switchTimezone: function UserInterface__switchTimezone(local) {
    if (local)
      globalStorage[location.host].useLocalTime = true;
    else
      delete globalStorage[location.host].useLocalTime;

    this._updateTimezoneDisplay();
    this._buildPushesList();
  },

  _stripTags: function UserInterface__stripTags(text) {
    var div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  _linkBugs: function UserInterface__linkBugs(text) {
    return text.replace(/(bug\s*|b=)([1-9][0-9]*)\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
           .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="'+this._revURL('')+'$2">$1$2</a>');
  },
  
  _generateBoxMatrix: function UserInterface__generateBoxMatrix() {
    var boxMatrix = {};
    var machines = this._data.getMachines();
    var machineResults = this._data.getMachineResults();
    machines.forEach(function addMachineToBoxMatrix(machine) {
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
  },
  
  _paintBoxMatrix: function UserInterface__paintBoxMatrix(boxMatrix) {
    var self = this;
    var colspans = {};
    var oss = this._data.getOss();
    oss.forEach(function initColspanForOS(os) { colspans[os] = 1; });
    var groupedMachineTypes = [
      ["Build"],
      ["Leak Test"],
      ["Unit Test", "Mochitest", "Opt Mochitest", "Debug Mochitest", "Everythingelse Test", "Opt Everythingelse Test", "Debug Everythingelse Test"],
      ["Nightly"],
      ["Talos"]
    ];
    groupedMachineTypes.forEach(function calculateColspans(types) {
      for (var os in colspans) {
        var colspan = 0;
        types.forEach(function addColspanForMachineType(t) {
          if (!boxMatrix[t] || !boxMatrix[t][os])
            return;
          colspan += boxMatrix[t][os].length;
        });
        colspans[os] *= colspan ? colspan : 1;
      }
    });

    oss.forEach(function setColspansOnColumnHeaders(os) {
      document.getElementById(os + "th").setAttribute("colspan", colspans[os]);
    });
  
    var table = $("#matrix");
    table.find("tbody").remove();
    var tbody = $("<tbody></tbody>").appendTo(table);
    groupedMachineTypes.forEach(function buildBoxMatrixTableForMachineTypeGroup(types) {
      var row = $("<tr></tr>");
      var innerHTML = '<th>' + types[0] + '</th>';
      var haveAnyOfType = false;
      var typeColspan = {};
      for (var os in colspans) {
        typeColspan[os] = 0;
        types.forEach(function calculateColspanForSubtype(t) {
          if (!boxMatrix[t] || !boxMatrix[t][os])
            return;
          typeColspan[os] += boxMatrix[t][os].length;
        });
      }
      oss.forEach(function buildBoxMatrixTableCellsForOS(os) {
        types.forEach(function buildBoxMatrixTableCellsForMachineType(t) {
          if (!boxMatrix[t])
            return;
          haveAnyOfType = true;
          if (!boxMatrix[t][os]) {
            if(typeColspan[os] == 0 && t == types[0] /* XXX hack */) {
              innerHTML += '<td class="empty" colspan=' + colspans[os] + '></td>';
            }
            return;
          }
          var boxColspan = colspans[os] / typeColspan[os];
          boxMatrix[t][os].forEach(function writeHTMLForMachineTypeCell(machineResult) {
            var status = machineResult.state;
            innerHTML += '<td colspan="' + boxColspan + '"><a href="' +
                     machineResult.briefLogURL + '" class="machineResult ' + status +
                     (machineResult.note ? ' hasNote" title="(starred)' : '') +
                     '" resultID="' + machineResult.runID + '">' +
                     self._resultTitle(machineResult) + '</a></td>';
          });
        });
      });
      if (haveAnyOfType)
        row.html(innerHTML).appendTo(tbody);
    });
    table.css("visibility", "visible");
    $("a", table).get().forEach(function setupClickListenerForBoxMatrixCell(cell) {
      cell.addEventListener("click", function clickBoxMatrixCell(e) {
        self._resultLinkClick(this);
        e.preventDefault();
      }, false);
    });
  },

  _getDisplayDate: function UserInterface__getDisplayDate(date) {
    var d = date;
    var timediff = '';
    if (!globalStorage[location.host].useLocalTime) {
      var hoursdiff = date.getTimezoneOffset()/60 + Config.mvtTimezone/100;
      d = new Date(date.getTime() + hoursdiff * 60 * 60 * 1000);
      timediff = ' ' + Config.mvtTimezone;
    }
    return d.toLocaleString() + timediff;
  },
  
  _getDisplayTime: function UserInterface__getDisplayTime(date) {
    if (!date.getTime)
      return '';
    var d = date;
    if (!globalStorage[location.host].useLocalTime)
      d = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + Config.mvtTimezone/100 * 60 * 60 * 1000);
    return d.toLocaleFormat('%H:%M');
  },
  
  _revURL: function UserInterface__revURL(rev) {
    return this._data.getRevUrl(rev);
  },

  _resultTitle: function UserInterface__resultTitle(result) {
    var type = result.machine.type;
    return {
      "building": type + ' is still running, ' + this._etaString(result),
      "success": type + ' was successful',
      "testfailed": 'Tests failed on ' + type,
      "busted": type + ' is burning'
    }[result.state];
  },
  
  _etaString: function UserInterface__etaString(result) {
    if (!result.machine.averageCycleTime)
      return 'ETA unknown';
    var elapsed = Math.ceil(((new Date()).getTime() - result.startTime.getTime()) / 1000);
    if (elapsed > result.machine.averageCycleTime)
      return 'ETA any minute now';
    return 'ETA ~' + Math.ceil((result.machine.averageCycleTime - elapsed) / 60)
      + 'mins';
  },
  
  _shortNameForMachine: function UserInterface__shortNameForMachines(machine, onlyNumber) {
    if (onlyNumber)
      return this._numberForMachine(machine);
    return this._shortNameForMachineWithoutNumber(machine) + this._numberForMachine(machine);
  },

  _shortNameForMachineWithoutNumber: function UserInterface__shortNameForMachineWithoutNumber(machine) {
    switch (machine.type) {
      case "Opt Mochitest":
        return "Mo";
      case "Debug Mochitest":
        return "Md";
      case "Opt Everythingelse Test":
        return "Eo";
      case "Debug Everythingelse Test":
        return "Ed";
      default:
        return machine.type.charAt(0);
    }
  },

  _numberForMachine: function UserInterface__numberForMachine(machine) {
    var match = /([0-9]+)\/[0-9]/.exec(machine.name);
    return match ? match[1] : "";
  },

  _machineResultLink: function UserInterface__machineResultLink(machineResult, onlyNumber) {
    return '<a href="' + machineResult.briefLogURL +
    '" resultID="' + machineResult.runID +
    '" class="machineResult ' + machineResult.state +
    '" title="' + this._resultTitle(machineResult) +
    '">' + this._shortNameForMachine(machineResult.machine, onlyNumber) +
    (machineResult.note ? '*' : '') +
    '</a>';
  },

  _machineGroupResultLink: function UserInterface__machineGroupResultLink(machineResults) {
    var self = this;
    return '<span class="machineResultGroup" machineType="' +
    self._shortNameForMachineWithoutNumber(machineResults[0].machine) +
    '"> ' +
    machineResults.map(function linkMachineResult(a) { return self._machineResultLink(a, true); }).join(" ") +
    ' </span>';
  },

  _buildPushesList: function UserInterface__buildPushesList() {
    $(".patches > li").unbind();
    $(".machineResult").unbind();
    $("#goForward").unbind();
    $("#goBack").unbind();
    var self = this;
    var ul = document.getElementById("pushes");
    ul.innerHTML = this._controller.getTimeOffset() ? '<li><a id="goForward" href="#" title="go forward by 12 hours"></a></li>' : '';
    var pushes = this._data.getPushes();
    var oss = this._data.getOss();
    var machineTypes = this._data.getMachineTypes();
    var timeOffset = this._controller.getTimeOffset();
    ul.innerHTML+= pushes.map(function buildHTMLForPush(push, pushIndex) {
      return '<li>\n' +
      '<h2><span class="pusher">' + push.pusher + '</span> &ndash; ' +
      '<span class="date">' + self._getDisplayDate(push.date) + '</span></h2>\n' +
      '<ul class="results">\n' +
      oss.map(function buildHTMLForPushResults(os) {
        if (!push.results || !push.results[os])
          return '';
        var results = push.results[os];
        return '<li><span class="os ' + os + '">' +
        { "linux": "Linux", "osx": "Mac OS X", "windows": "Windows" }[os] +
        '</span><span class="osresults">' +
        machineTypes.map(function buildHTMLForPushResultsOnOS(machineType) {
          if (!results[machineType])
            return '';
          if (self._data.machineTypeIsGrouped(machineType)) {
            return self._machineGroupResultLink(results[machineType]);
          }
          return results[machineType].map(function linkMachineResults(a) { return self._machineResultLink(a); }).join(" ");
        }).join("\n") +
        '</span></li>';
      }).join("\n") +
      '</ul>' +
      '<ul class="patches">\n' +
      push.patches.map(function buildHTMLForPushPatches(patch, patchIndex) {
        return '<li>\n' +
        '<a class="revlink" href="' + self._revURL(patch.rev) + '">' + patch.rev +
        '</a>\n<div class="popup"><span><span class="author">' + patch.author + '</span> &ndash; ' +
        '<span class="desc">' + self._linkBugs(patch.desc.split("\n")[0]) + '</span></span></div>\n' +
        '</li>';
      }).join("\n") +
      '</ul>\n' +
      '</li>';
    }).join("\n") || (self._controller.everLoadedPushes ? '<li>There were no pushes between <em>' + 
      self._getDisplayDate(timeOffset ? new Date((timeOffset-12*3600)*1000) :
      new Date(((new Date()).getTime()-12*3600*1000)))+'</em> and <em>' +
      self._getDisplayDate(timeOffset ? new Date(timeOffset*1000) : new Date())+'</em></li>' : '');
    ul.innerHTML+= '<li><a id="goBack" href="#" title="go back by 12 hours"></a></li>';
    
    if (timeOffset) {
      $('#goForward').bind('click', function goForward() {
        if (!timeOffset)
          return false;
        if (timeOffset + 12 * 3600 > (new Date()).getTime() / 1000) {
          self._controller.setTimeOffset(0);
        }
        else
          self._controller.setTimeOffset(timeOffset + 12 * 3600);
        return false;
      });
    }
    $('#goBack').bind('click', function goBack() {
      self._controller.setTimeOffset(timeOffset ? timeOffset - 12 * 3600 : Math.round((new Date()).getTime() / 1000) - 12 * 3600);
      return false;
    });
    
    $(".machineResult").bind("click", function clickMachineResult(e) {
      self._resultLinkClick(this);
      e.preventDefault();
    });

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
    this._setActiveResult(this._activeResult, false);
  },
  
  _clickNowhere: function UserInterface__clickNowhere(e) {
    if (!$(e.target).is("a, #pushes"))
      this._setActiveResult("");
  },
  
  _resultLinkClick: function UserInterface__resultLinkClick(link) {
    var resultID = link.getAttribute("resultID");
    this._setActiveResult(resultID, true);
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
    if (this._activeResult) {
      var activeA = $('.results .machineResult[resultID="' + this._activeResult + '"]').get(0);
      if (activeA && scroll) {
        this._scrollElemIntoView(activeA, document.getElementById("pushes"), 20);
      }
    }
    this._displayResult();
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
  
  _displayResult: function UserInterface__displayResult() {
    var self = this;
    var result = this._data.getMachineResults()[this._activeResult];
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
    box.innerHTML = (function htmlForResultInBottomBar() {
      return '<h3><span class="machineName">' + result.machine.name +
      '</span> [<span class="state">' + result.state + '</span>] ' +
      '<span class="duration">Started ' + self._getDisplayTime(result.startTime) +
      ', ' + (result.state == "building" ? 'still running... ' + self._etaString(result)
      : 'finished ') + self._getDisplayTime(result.endTime) + '</span></h3>\n' +
      '<a class="briefLog" href="' + result.briefLogURL +
      '">View Brief Log</a> <a class="fullLog" href="' +
      result.fullLogURL + '">View Full Log</a> <a class="addNote" href="' +
      result.addNoteURL + '">Add a Comment</a> <span id="summaryLoader"></span>' +
      (function htmlForTestResults() {
        var testResults = result.getTestResults();
        if (!testResults.length)
          return '';
        return '<ul class="testResults">\n' +
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
        })() + '<div class="summary"></div></div>';
      })();
    })();
    AddCommentUI.updateUI();
    SummaryLoader.setupSummaryLoader(result, box);
  },

};
