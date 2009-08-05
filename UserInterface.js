var UserInterface = {

  _controller: null,
  _treeName: "",
  _data: null,
  _activeResult: "",

  init: function(controller) {
    var self = this;
    this._controller = controller;
    this._treeName = controller.treeName;
    this._data = controller.getData();

    document.title = controller.treeName + " - Tinderboxpushlog";

    this._buildTreeSwitcher();

    $("#localTime").bind("click", function () {
      self._switchTimezone(true);
      return false;
    });

    $("#mvtTime").bind("click", function () {
      self._switchTimezone(false);
      return false;
    });

    document.getElementById("pushes").onmousedown = function(e) {
      self._clickNowhere(e);
    };
    $(".machineResult").live("click", function(e) {
      self._resultLinkClick(this);
      e.preventDefault();
    });

    AddCommentUI.init("http://tinderbox.mozilla.org/addnote.cgi");
    AddCommentUI.registerNumSendingCommentChangedCallback(function() {
      self.updateStatus();
    });

    this._updateTimezoneDisplay();

  },

  loadedData: function(kind) {
    if (kind == "machineResults")
      this._paintBoxMatrix(this._generateBoxMatrix());
    this._buildPushesList();
  },

  updateStatus: function() {
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
  
  _buildTreeSwitcher: function() {
    var innerHTML = "";
    if (this._treeName == "Firefox3.5")
      innerHTML += "FF3.5 | ";
    else
      innerHTML += "<a href='?tree=Firefox3.5'>FF3.5<" + "/a> | ";
  
    if (this._treeName == "Firefox")
      innerHTML += "FF3.6";
    else
      innerHTML += "<a href='./'>FF3.6<" + "/a>";
  
    $("#treechooser").html(innerHTML);
  },

  _updateTimezoneDisplay: function() {
    document.getElementById('localTime').className =
      globalStorage[location.host].useLocalTime ? 'selected' : '';
    document.getElementById('mvtTime').className =
      !globalStorage[location.host].useLocalTime ? 'selected' : '';
  },

  _switchTimezone: function(local) {
    if (local)
      globalStorage[location.host].useLocalTime = true;
    else
      delete globalStorage[location.host].useLocalTime;

    this._updateTimezoneDisplay();
    this._buildPushesList();
  },

  _stripTags: function(text) {
    var div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

  _linkBugs: function(text) {
    return text.replace(/(bug\s*|b=)([1-9][0-9]*)\b/ig, '<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=$2">$1$2</a>')
           .replace(/(changeset\s*)?([0-9a-f]{12})\b/ig, '<a href="'+this._revURL('')+'$2">$1$2</a>');
  },
  
  _generateBoxMatrix: function() {
    var boxMatrix = {};
    var machines = this._data.getMachines();
    var machineResults = this._data.getMachineResults();
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
  },
  
  _paintBoxMatrix: function(boxMatrix) {
    var self = this;
    var colspans = { "linux": 1, "osx": 1, "windows": 1 };
    var groupedMachineTypes = [
      ["Build"],
      ["Leak Test"],
      ["Unit Test", "Mochitest", "Everythingelse Test"],
      ["Nightly"],
      ["Talos"]
    ];
    groupedMachineTypes.forEach(function(types) {
      for (var os in colspans) {
        var colspan = 0;
        types.forEach(function(t) {
          if (!boxMatrix[t] || !boxMatrix[t][os])
            return;
          colspan += boxMatrix[t][os].length;
        });
        colspans[os] *= colspan ? colspan : 1;
      }
    });

    var oss = this._data.getOss();
    oss.forEach(function(os) {
      document.getElementById(os + "th").setAttribute("colspan", colspans[os]);
    });
  
    var table = $("#matrix");
    table.find("tbody").remove();
    var tbody = $("<tbody></tbody>").appendTo(table);
    groupedMachineTypes.forEach(function(types) {
      var row = $("<tr></tr>");
      var innerHTML = '<th>' + types[0] + '</th>';
      var haveAnyOfType = false;
      var typeColspan = {};
      for (var os in colspans) {
        typeColspan[os] = 0;
        types.forEach(function(t) {
          if (!boxMatrix[t] || !boxMatrix[t][os])
            return;
          typeColspan[os] += boxMatrix[t][os].length;
        });
      }
      oss.forEach(function(os) {
        types.forEach(function(t) {
          if (!boxMatrix[t])
            return;
          haveAnyOfType = true;
          if (!boxMatrix[t][os]) {
            innerHTML += '<td class="empty" colspan=' + colspans[os] + '></td>';
            return;
          }
          var boxColspan = colspans[os] / typeColspan[os];
          boxMatrix[t][os].forEach(function(machineResult) {
            var status = machineResult.state;
            innerHTML += '<td colspan="' + boxColspan + '"><a href="' +
                     machineResult.briefLogURL + '" class="machineResult ' + status +
                     (machineResult.note ? " hasNote" : "") +
                     '" resultID="' + machineResult.runID + '">' +
                     self._resultTitle(machineResult) + '</a></td>';
          });
        });
      });
      if (haveAnyOfType)
        row.html(innerHTML).appendTo(tbody);
    });
    table.css("visibility", "visible");
    $("a", table).get().forEach(function(cell) {
      cell.addEventListener("click", function(e) {
        self._resultLinkClick(this);
        e.preventDefault();
      }, false);
    });
  },

  _getDisplayDate: function(date) {
    var d = date;
    var timediff = '';
    if (!globalStorage[location.host].useLocalTime) {
      var hoursdiff = date.getTimezoneOffset()/60 + Config.mvtTimezone/100;
      d = new Date(date.getTime() + hoursdiff * 60 * 60 * 1000);
      // properly display half-hour timezones with sign and leading zero
      var absdiff = Math.abs(hoursdiff);
      timediff = ' ' + (hoursdiff < 0 ? '-' : '') +
        (absdiff < 10 ? '0' : '') + (Math.floor(absdiff) * 100 + 60 * (absdiff -
        Math.floor(absdiff)));
    }
    return d.toLocaleString() + timediff;
  },
  
  _getDisplayTime: function(date) {
    if (!date.getTime)
      return '';
    var d = date;
    if (!globalStorage[location.host].useLocalTime)
      d = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000 + Config.mvtTimezone/100 * 60 * 60 * 1000);
    return d.toLocaleFormat('%H:%M');
  },
  
  _revURL: function(rev) {
    return this._data.getRevUrl(rev);
  },

  _resultTitle: function(result) {
    var type = result.machine.type;
    return {
      "building": type + ' is still running, ' + this._etaString(result),
      "success": type + ' was successful',
      "testfailed": 'Tests failed on ' + type,
      "busted": type + ' is burning'
    }[result.state];
  },
  
  _etaString: function(result) {
    if (!result.machine.averageCycleTime)
      return 'ETA unknown';
    var elapsed = Math.ceil(((new Date()).getTime() - result.startTime.getTime()) / 1000);
    if (elapsed > result.machine.averageCycleTime)
      return 'ETA any minute now';
    return 'ETA ~' + Math.ceil((result.machine.averageCycleTime - elapsed) / 60)
      + 'mins';
  },
  
  _machineResultLink: function(machineResult) {
    return '<a href="' + machineResult.briefLogURL +
    '" resultID="' + machineResult.runID +
    '" class="machineResult ' + machineResult.state +
    '" title="' + this._resultTitle(machineResult) +
    '">' + machineResult.machine.type.charAt(0) +
    (machineResult.note ? '*' : '') +
    '</a>';
  },

  _buildPushesList: function() {
    $(".patches > li").unbind();
    var self = this;
    var ul = document.getElementById("pushes");
    ul.innerHTML = this._controller.getTimeOffset() ? '<li><a id="goForward" href="#" title="go forward by 12 hours"></a></li>' : '';
    var pushes = this._data.getPushes();
    var oss = this._data.getOss();
    var machineTypes = this._data.getMachineTypes();
    var timeOffset = this._controller.getTimeOffset();
    ul.innerHTML+= pushes.map(function(push, pushIndex) {
      return '<li>\n' +
      '<h2><span class="pusher">' + push.pusher + '</span> &ndash; ' +
      '<span class="date">' + self._getDisplayDate(push.date) + '</span></h2>\n' +
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
          return results[machineType].map(function (a) { return self._machineResultLink(a); }).join(" ");
        }).join("\n") +
        '</span></li>';
      }).join("\n") +
      '</ul>' +
      '<ul class="patches">\n' +
      push.patches.map(function(patch, patchIndex) {
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
    this._setActiveResult(this._activeResult, false);
  },
  
  _clickNowhere: function(e) {
    if (!$(e.target).is("a, #pushes"))
      this._setActiveResult("");
  },
  
  _resultLinkClick: function(link) {
    var resultID = link.getAttribute("resultID");
    this._setActiveResult(resultID, true);
  },
  
  _markActiveResultLinks: function() {
    if (this._activeResult)
      $('.machineResult[resultID="' + this._activeResult + '"]').attr("active", "true");
  },
  
  _setActiveResult: function(resultID, scroll) {
    SummaryLoader._abortOutstandingSummaryLoadings();
    SummaryLoader._abortOutstandingSummaryLoadings = function () {};
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
  
  _scrollElemIntoView: function(elem, box, margin) {
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

  _animateScroll: function(scrollBox, end, duration) {
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
  },
  
  _displayResult: function() {
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
    box.innerHTML = (function () {
      return '<h3><span class="machineName">' + result.machine.name +
      '</span> [<span class="state">' + result.state + '</span>] ' +
      '<span class="duration">Started ' + self._getDisplayTime(result.startTime) +
      ', ' + (result.state == "building" ? 'still running... ' + self._etaString(result)
      : 'finished ') + self._getDisplayTime(result.endTime) + '</span></h3>\n' +
      '<a class="briefLog" href="' + result.briefLogURL +
      '">View Brief Log</a> <a class="fullLog" href="' +
      result.fullLogURL + '">View Full Log</a> <a class="addNote" href="' +
      result.addNoteURL + '">Add a Comment</a> <span id="summaryLoader"></span>' +
      (function () {
        if (!result.testResults.length)
          return '';
        return '<ul class="testResults">\n' +
        result.testResults.map(function(r) {
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
      (function () {
        return '<div class="stars">' +
        (function() {
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
