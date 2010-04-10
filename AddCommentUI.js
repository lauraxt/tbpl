var AddCommentUI = {

  addToBuilds: {},
  addToBugs: {},
  numSendingComments: 0,
  numSendingCommentChangedCallback: function empty() {},
  numSendingBugs: 0,
  numSendingBugChangedCallback: function empty() {},
  _submitURL: "",
  _storage: {},

  init: function AddCommentUI_init(submitURL, storage) {
    this._submitURL = submitURL;
    this._storage = storage;
    var self = this;
    $("a.addNote").live("click", function addNoteLinkClick() {
      self.logLinkClick();
      return false;
    });
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
    var machineResults = UserInterface._data.getMachineResults(); // XXX hack
    var email = $("#logNoteEmail").get(0).value;
    var comment = $("#logNoteText").get(0).value;
    for (var i in this.addToBuilds) {
      this._postOneComment(email, comment, machineResults[i], function oneLessCommentPending() {
        self.pendingCommentsChanged(-1);
      });
      this.pendingCommentsChanged(1);
    }
    var bugsSubmitData = {};
    for (var i in this.addToBuilds) {
      if (!machineResults[i].suggestions)
        continue;
      for (var j = 0; j < machineResults[i].suggestions.length; ++j) {
        var suggestion = machineResults[i].suggestions[j];
        if (!(suggestion.id in this.addToBugs))
          continue;
        bugsSubmitData[suggestion.id] = {
          header: machineResults[i].machine.name + ", " + UserInterface._durationDisplay(machineResults[i]),
          logLink: machineResults[i].briefLogURL
        };
      }
    }
    for (var id in bugsSubmitData) {
      this._postOneBug(id, bugsSubmitData[id].header, bugsSubmitData[id].logLink, function oneLessBugPending() {
        self.pendingBugsChanged(-1);
      });
      this.pendingBugsChanged(1);
    }
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

  pendingCommentsChanged: function AddCommentUI_pendingCommentsChanged(changedBy) {
    this.numSendingComments += changedBy;
    this.numSendingCommentChangedCallback();
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
      html += UserInterface._machineResultLink(Controller.getData().getMachineResults()[i])
    }
    $("#logNoteRuns").html(html ? html : "(none selected)");
    UserInterface._markActiveResultLinks(); // XXX fix this
  },

  _updateSuggestions: function AddCommentUI__updateSuggestions() {
    $("#logNoteSuggestions").empty();
    var added = false;
    for (var i in this.addToBuilds) {
      added = true;
      UserInterface._addSuggestionLink(Controller.getData().getMachineResults()[i],
                                       $("#logNoteSuggestions"));
    }
    if (added)
      $("#suggestions").show();
    else
      $("#suggestions").hide();
  },

  _updateLogLinkText: function AddCommentUI__updateLogLinkText() {
    $("a.addNote").text(
      !this._popupIsOpen() ? "Add a comment" :
        (this.addToBuilds[UserInterface._activeResult] ? "Don't add the comment to this build" :
                                          "Add the comment to this build, too"));
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
    NetUtils.crossDomainPost(this._submitURL, {
      buildname: machineResult.machine.name,
      buildtime: machineResult.startTime.getTime() / 1000,
      errorparser: machineResult.errorParser,
      logfile: machineResult.runID,
      tree: machineResult.tree,
      who: email,
      note: comment,
    }, callback);
  },

  _postOneBug: function AddCommentUI__postOneBug(id, header, logLink, callback) {
    NetUtils.loadText("submitBugzillaComment.php?id=" + id + "&comment=" + escape(logLink + "\n" + header),
                      callback, callback, callback);
  },

};
