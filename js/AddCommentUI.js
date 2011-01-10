/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var AddCommentUI = {

  addToBuilds: {},
  addToBugs: {},
  numSendingComments: 0,
  numSendingCommentChangedCallback: function empty() {},
  numSendingBugs: 0,
  numSendingBugChangedCallback: function empty() {},
  _submitURL: "",
  _storage: {},
  _autoStarBugs: {},

  init: function AddCommentUI_init(submitURL, storage) {
    this._submitURL = submitURL;
    this._storage = storage;
    var self = this;
    $("a.addNote").live("click", function addNoteLinkClick() {
      self.logLinkClick();
      return false;
    });
    $("#autoStar").live("click", function autoStarClick() {
      self.commentWithoutUI();
    });
    this.updateAutoStarState();
    $("#closeAddNotePopup").bind("click", function closeAddNotePopupClick() {
      $("#addNotePopup").fadeOut('fast', function afterAddNotePopupFadeOut() {
        self.reset();
      });
      return false;
    });
    $("#logNoteEmail").bind("change", function logNoteEmailChange() {
      self._setEmail(this.value);
    });
    $("#logNoteEmail").get(0).value = self._getEmail();
    $("#addNotePopup").draggable({ containment: 'window', handle: 'form, h2, table, tbody, tr, th, td, label, p' });
    $("#addNoteForm").bind("submit", function addNoteFormSubmit() {
      self.submit();
      $("#addNotePopup").fadeOut('fast', function afterAddNotePopupFadeOutAfterSubmit() {
        self.reset();
      });
      return false;
    });
  },

  updateUI: function AddCommentUI_updateUI() {
    this._updateBuildList();
    this._updateLogLinkText();
    this._updateSubmitButton();
    this._updateSuggestions();
  },

  reset: function AddCommentUI_resut() {
    $("#logNoteText").get(0).value = "";
    this.addToBuilds = {};
    this.addToBugs = {};
    this.updateUI();
  },

  submit: function AddCommentUI_submit() {
    var self = this;
    var data = Controller.getData();
    var email = $("#logNoteEmail").get(0).value;
    var comment = $("#logNoteText").get(0).value;
    Controller.keysFromObject(this.addToBuilds).forEach(function(id) {
      var result = data.getMachineResult(id);
      self._postOneComment(email, comment, result, function oneLessCommentPending() {
        self.pendingCommentsChanged(-1, result);
      });
      self.pendingCommentsChanged(1);
    });
    var bugsSubmitData = {};
    for (var i in this.addToBuilds) {
      var machineResult = data.getMachineResult(i);
      if (!machineResult.suggestions)
        continue;
      for (var j = 0; j < machineResult.suggestions.length; ++j) {
        var suggestion = machineResult.suggestions[j];
        if (!(suggestion.id in this.addToBugs))
          continue;
        bugsSubmitData[suggestion.id] = {
          header: suggestion.signature,
          log: suggestion.log,
          email: email.replace("@", "%"),
          logLink: 'http://tinderbox.mozilla.org/showlog.cgi?log=' + Controller.treeName + '/' + machineResult.runID
        };
      }
    }
    for (var id in bugsSubmitData) {
      this._postOneBug(id, bugsSubmitData[id].header, bugsSubmitData[id].logLink,
                       bugsSubmitData[id].email, bugsSubmitData[id].log,
                       function oneLessBugPending() {
        self.pendingBugsChanged(-1);
      });
      this.pendingBugsChanged(1);
    }
    this.clearAutoStarBugs();
  },

  logLinkClick: function AddCommentUI_logLinkClick() {
    // XXX fix activeResult
    var div = $("#addNotePopup").fadeIn('fast');
    if (!this.addToBuilds[UserInterface._activeResult]) {
      this.addToBuilds[UserInterface._activeResult] = true;
      var focusTextfield = ($("#logNoteEmail").get(0).value ? $("#logNoteText") : $("#logNoteEmail")).get(0);
      focusTextfield.focus();
      focusTextfield.select();
    } else {
      delete this.addToBuilds[UserInterface._activeResult];
    }
    this.updateUI();
  },

  commentWithoutUI: function AddCommentUI_commentWithoutUI() {
    if (this._popupIsOpen() || !$("#autoStar").hasClass("active"))
      return;
    if (!this.addToBuilds[UserInterface._activeResult]) {
      this.addToBuilds[UserInterface._activeResult] = true;
    }
    this.updateUI();
    var submit = $("#addNoteForm input[type=submit]");
    if (!submit.get(0).disabled) {
      this.submit();
      $("#autoStar").removeClass("active");
    }
  },

  toggleAutoStarBug: function AddCommentUI_toggleAutoStarBug(bugid) {
    if (bugid in this._autoStarBugs) {
      delete this._autoStarBugs[bugid];
    } else {
      this._autoStarBugs[bugid] = true;
    }
  },

  clearAutoStarBugs: function AddCommentUI_clearAutoStarBugs() {
    this._autoStarBugs = {};
  },

  shouldAutoStarBug: function AddCommentUI_shouldAutoStarBug(bugid) {
    return bugid in this._autoStarBugs;
  },

  updateAutoStarState: function AddCommentUI_updateAutoStarState() {
    var autoStar = $("#autoStar");
    if (Controller.keysFromObject(this._autoStarBugs).length) {
      autoStar.addClass("active");
      autoStar.attr("title", "Click to star this orange using the suggestions selected");
    } else {
      autoStar.removeClass("active");
      autoStar.attr("title", "Select an orange, click on the star icons next to " +
                             "suggestions, and click this icon to star the orange " +
                             "using those suggestions in one step");
    }
  },

  pendingCommentsChanged: function AddCommentUI_pendingCommentsChanged(changedBy, result) {
    this.numSendingComments += changedBy;
    this.numSendingCommentChangedCallback(result);
  },

  registerNumSendingCommentChangedCallback: function AddCommentUI_registerNumSendingCommentChangedCallback(callback) {
    this.numSendingCommentChangedCallback = callback;
  },

  pendingBugsChanged: function AddCommentUI_pendingBugsChanged(changedBy) {
    this.numSendingBugs += changedBy;
    this.numSendingBugChangedCallback();
  },

  registerNumSendingBugChangedCallback: function AddCommentUI_registerNumSendingBugChangedCallback(callback) {
    this.numSendingBugChangedCallback = callback;
  },

  toggleSuggestion: function AddCommentUI_toggleSuggestion(id, link) {
    var box = $("#logNoteText").get(0);
    if (box.value == "") {
      this.addToBugs[id] = true;
      box.value = link.textContent;
      $(link).addClass("added");
    } else {
      if (box.value.indexOf(link.textContent) >= 0) {
        delete this.addToBugs[id];
        box.value = box.value.replace(new RegExp("(, )?" + link.textContent), "");
        $(link).removeClass("added");
      } else {
        this.addToBugs[id] = true;
        box.value += ", " + link.textContent;
        $(link).addClass("added");
      }
    }
  },

  _getEmail: function AddCommentUI__getEmail() {
    return this._storage.email || "";
  },

  _setEmail: function AddCommentUI__setEmail(email) {
    this._storage.email = email;
  },

  _updateSubmitButton: function AddCommentUI__updateSubmitButton() {
    $("#addNoteForm input[type=submit]").get(0).disabled = this._buildListIsEmpty();
  },

  _updateBuildList: function AddCommentUI__updateBuildList() {
    var html = "";
    for (var i in this.addToBuilds) {
      html += UserInterface._machineResultLink(Controller.getData().getMachineResult(i))
    }
    $("#logNoteRuns").html(html ? html : "(none selected)");
    UserInterface._markActiveResultLinks(); // XXX fix this
  },

  _updateSuggestions: function AddCommentUI__updateSuggestions() {
    $("#logNoteSuggestions").empty();
    var added = false;
    for (var i in this.addToBuilds) {
      added = true;
      UserInterface._addSuggestionLink(Controller.getData().getMachineResult(i),
                                       $("#logNoteSuggestions"));
    }
    if (added)
      $("#suggestions").show();
    else
      $("#suggestions").hide();
  },

  _updateLogLinkText: function AddCommentUI__updateLogLinkText() {
    $("a.addNote").text(
      !this._popupIsOpen() ? "add a comment" :
        (this.addToBuilds[UserInterface._activeResult] ? "don't add the comment to this build" :
                                          "add the comment to this build, too"));
  },

  _buildListIsEmpty: function AddCommentUI__buildListIsEmpty() {
    for (var i in this.addToBuilds)
      return false;
    return true;
  },

  _popupIsOpen: function AddCommentUI__popupIsOpen() {
    return $("#addNotePopup").is(":visible");
  },

  _postOneComment: function AddCommentUI__postOneComment(email, comment, machineResult, callback) {
    var machinename = "";
    for (var i = 0; i < machineResult._scrape.length; i++) {
      if (machineResult._scrape[i].indexOf("s: ") > -1) {
        machinename = machineResult._scrape[i].substring(machineResult._scrape[i].indexOf("s: ") + 3);
      }
    }
    var d = machineResult.startTime;
    NetUtils.crossDomainPost(Config.wooBugURL, {
      buildname: machineResult.machine.name,
      machinename: machinename,
      os: machineResult.machine.os,
      date: d.getFullYear() + "-" +
            (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1) + "-" +
            (d.getDate() < 10 ? "0" : "") + d.getDate(),
      type: machineResult.machine.type,
      debug: machineResult.machine.debug,
      starttime: machineResult.startTime.getTime() / 1000,
      logfile: machineResult.runID,
      tree: Config.repoNames[machineResult.tree],
      rev: machineResult.revs[Config.repoNames[machineResult.tree]],
      who: email,
      comment: comment,
    }, function() { /* dummy callback */ });

    NetUtils.crossDomainPost(this._submitURL, {
      buildname: machineResult.machine.name,
      buildtime: machineResult.startTime.getTime() / 1000,
      errorparser: machineResult.errorParser,
      logfile: machineResult.runID,
      tree: machineResult.tree,
      who: email,
      note: comment,
    }, callback);
    machineResult.note += "[<b><a href=mailto:" + email + ">" + email + "</a></b>]<br>" + comment;
  },

  _postOneBug: function AddCommentUI__postOneBug(id, header, logLink, email, summary, callback) {
    NetUtils.crossDomainPost(Config.baseURL + "php/submitBugzillaComment.php", {
      id: id,
      comment: email + "\n" + logLink + "\n" + header + "\n\n" + summary,
    }, callback);
  },

};
