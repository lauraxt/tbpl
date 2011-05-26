/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var AddCommentUI = {

  addToBugs: {},
  numSendingComments: 0,
  numSendingCommentChangedCallback: function empty() {},
  numSendingBugs: 0,
  numSendingBugChangedCallback: function empty() {},
  _submitURL: "",

  init: function AddCommentUI_init(submitURL) {
    this._submitURL = submitURL;
    var self = this;
    $("a.addNote").live("click", function addNoteLinkClick() {
      self.openCommentBox();
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
    $("#logNoteEmail").val(self._getEmail());
    $("#addNotePopup").draggable({ containment: 'window', handle: 'form, h2, table, tbody, tr, th, td, label, p' });

    $.event.props.push("dataTransfer");
    $("#addNotePopup").bind("dragover", function (e) { e.preventDefault(); });
    $("#addNotePopup").bind("drop", function addNoteDropHandler(e) {
      var id = e.dataTransfer.getData("text/x-tbpl-resultid");
      if (id) {
        UserInterface._selectedBuilds[id] = true;
        self.updateUI();
      } else {
        var rev = e.dataTransfer.getData("text/x-tbpl-revision");
        if (rev)
          UserInterface._toggleSelectedRev(rev, true);
      }
      return false;
    });

    $("#addNoteForm").bind("submit", function addNoteFormSubmit() {
      self.submit();
      $("#addNotePopup").fadeOut('fast', function afterAddNotePopupFadeOutAfterSubmit() {
        self.reset();
        UserInterface._markSelected();
      });
      return false;
    });

    // Defeat the keep-text-on-reload feature, because it results in
    // comments containing changesets that are no longer selected.
    $("#logNoteText").val('');
  },

  updateUI: function AddCommentUI_updateUI() {
    this._updateBuildList();
    this._updateLogLinkText();
    this._updateSubmitButton();
    this._updateSuggestions();
  },

  reset: function AddCommentUI_reset() {
    $("#logNoteText").val('');
    UserInterface._selectedBuilds = {};
    UserInterface._selectedRevs = {};
    this.addToBugs = {};
    this.updateUI();
  },

  submit: function AddCommentUI_submit() {
    var self = this;
    var data = Controller.getData();
    var email = $("#logNoteEmail").val();
    var comment = $("#logNoteText").val();
    var builds = Object.keys(UserInterface._selectedBuilds);
    builds.forEach(function(id) {
      var result = data.getMachineResult(id);
      self._postOneComment(email, comment, result, function oneLessCommentPending() {
        self.pendingCommentsChanged(-1, result);
      });
      self.pendingCommentsChanged(1);
    });
    var bugsSubmitData = {};
    builds.forEach(function (i) {
      var machineResult = data.getMachineResult(i);
      if (!machineResult.suggestions)
        return;
      for (var j = 0; j < machineResult.suggestions.length; ++j) {
        var suggestion = machineResult.suggestions[j];
        if (!(suggestion.id in self.addToBugs))
          continue;
        bugsSubmitData[suggestion.id] = {
          header: suggestion.signature,
          log: suggestion.log,
          email: email.replace("@", "%"),
          logLink: 'http://tinderbox.mozilla.org/showlog.cgi?log=' + Controller.treeName + '/' + machineResult.runID
        };
      }
    });
    for (var id in bugsSubmitData) {
      this._postOneBug(id, bugsSubmitData[id].header, bugsSubmitData[id].logLink,
                       bugsSubmitData[id].email, bugsSubmitData[id].log,
                       function oneLessBugPending() {
        self.pendingBugsChanged(-1);
      });
      this.pendingBugsChanged(1);
    }
    this.clearAutoStarBugs();
    this.reset();
  },

  openCommentBox: function AddCommentUI_openCommentBox() {
    $("#addNotePopup").fadeIn('fast');
    if (UserInterface._activeResult)
      UserInterface._toggleSelectedBuild(UserInterface._activeResult);
    var focusTextfield = ($("#logNoteEmail").val() ? $("#logNoteText") : $("#logNoteEmail")).get(0);
    focusTextfield.focus();
    focusTextfield.select();
    this.updateUI();
  },

  commentWithoutUI: function AddCommentUI_commentWithoutUI() {
    if (this._popupIsOpen() || !$("#autoStar").hasClass("active"))
      return;
    UserInterface._selectedBuilds[UserInterface._activeResult] = true;
    this.updateUI();
    var submit = $("#addNoteForm input[type=submit]");
    if (!submit.get(0).disabled) {
      this.submit();
      $("#autoStar").removeClass("active");
    }
  },

  clearAutoStarBugs: function AddCommentUI_clearAutoStarBugs() {
    for (var bugid in this.addToBugs) {
      this.removeFromBug(bugid);
    }
  },

  shouldAutoStarBug: function AddCommentUI_shouldAutoStarBug(bugid) {
    return bugid in this.addToBugs;
  },

  updateAutoStarState: function AddCommentUI_updateAutoStarState() {
    var autoStar = $("#autoStar");
    if (Object.keys(this.addToBugs).length) {
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

  markSuggestedBug: function AddCommentUI_markSuggestedBug(bugid) {
    var commentSuggestion = $('#logNoteSuggestions a[data-id=' + bugid + ']');
    var resultSuggestion = $(".stars .summary [data-bugid=" + bugid + "] .starSuggestion");
    if (bugid in this.addToBugs) {
      commentSuggestion.addClass('added');
      resultSuggestion.addClass('active');
    } else {
      commentSuggestion.removeClass('added');
      resultSuggestion.removeClass('active');
    }
    this.updateAutoStarState();
  },

  addToBug: function AddCommentUI_addToBug(bugid) {
    this.addToBugs[bugid] = true;

    var box = $("#logNoteText");
    var comment = box.val();
    if (comment == '')
      box.val("Bug " + bugid);
    else
      box.val(comment + ", bug " + bugid);

    this.markSuggestedBug(bugid);
  },

  removeFromBug: function AddCommentUI_removeFromBug(bugid) {
    delete this.addToBugs[bugid];

    var box = $("#logNoteText");
    var comment = box.val();
    box.val(comment.replace(new RegExp("(, )?[bB]ug " + bugid), ""));

    this.markSuggestedBug(bugid);
  },

  toggleSuggestion: function AddCommentUI_toggleSuggestion(id) {
    if (id in this.addToBugs)
      this.removeFromBug(id);
    else
      this.addToBug(id);
  },

  _getEmail: function AddCommentUI__getEmail() {
    return storage.email || "";
  },

  _setEmail: function AddCommentUI__setEmail(email) {
    storage.email = email;
  },

  _updateSubmitButton: function AddCommentUI__updateSubmitButton() {
    $("#addNoteForm input[type=submit]").get(0).disabled = this._buildListIsEmpty();
  },

  _updateBuildList: function AddCommentUI__updateBuildList() {
    var html = "";
    for (var i in UserInterface._selectedBuilds) {
      // Ignore jobs that have not finished
      var result = Controller.getData().getMachineResult(i);
      if (result)
        html += UserInterface._machineResultLink(result);
    }
    html = html ? html + "&nbsp;(drag additional builds here)"
                : "(none selected - drag builds here)";
    $("#logNoteRuns").html(html);
    UserInterface._markActiveResultLinks();
    UserInterface._markSelected();
  },

  _updateSuggestions: function AddCommentUI__updateSuggestions() {
    $("#logNoteSuggestions").empty();
    var added = false;
    for (var i in UserInterface._selectedBuilds) {
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
        (UserInterface._selectedBuilds[UserInterface._activeResult] ? "don't add the comment to this build" :
                                          "add the comment to this build, too"));
  },

  _buildListIsEmpty: function AddCommentUI__buildListIsEmpty() {
    for (var i in UserInterface._selectedBuilds)
      return false;
    return true;
  },

  addRevToComment: function AddCommentUI_addRevToComment(rev) {
    // Add the revision hash to the comment on a line by itself, but only if it
    // does not appear in the comment already
    var box = $("#logNoteText");
    var text = box.val();
    if (text.indexOf(rev) == -1) {
      if (text.match(/[^\n]$/))
        box.val(text + "\n" + rev + "\n");
      else
        box.val(text + rev + "\n");
    }
  },

  removeRevFromComment: function AddCommentUI_removeRevFromComment(rev) {
    // Remove whole line containing the given rev, if it exists
    var box = $("#logNoteText");
    // Note that /./ never matches a newline in JS
    box.val(box.val().replace(new RegExp(".*" + rev + ".*\n?", ""), ""));
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
      date: d.getUTCFullYear() + "-" +
            (d.getUTCMonth() < 9 ? "0" : "") + (d.getUTCMonth() + 1) + "-" +
            (d.getUTCDate() < 10 ? "0" : "") + d.getUTCDate(),
      type: machineResult.machine.type,
      debug: machineResult.machine.debug,
      starttime: machineResult.startTime.getTime() / 1000,
      logfile: machineResult.runID,
      tree: Config.treeInfo[machineResult.tree].primaryRepo,
      rev: machineResult.revs[Config.treeInfo[machineResult.tree].primaryRepo],
      who: email,
      comment: comment,
      timestamp: Math.ceil((new Date()).getTime()/1000),
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
    machineResult.note += "[<b>" + email + "</b>]<br>" + comment;
  },

  _postOneBug: function AddCommentUI__postOneBug(id, header, logLink, email, summary, callback) {
    NetUtils.crossDomainPost(Config.baseURL + "php/submitBugzillaComment.php", {
      id: id,
      comment: email + "\n" + logLink + "\n" + header + "\n\n" + summary,
    }, callback);
  },

};
