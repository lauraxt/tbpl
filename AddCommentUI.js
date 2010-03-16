var AddCommentUI = {

  addToBuilds: {},
  numSendingComments: 0,
  numSendingCommentChangedCallback: function empty() {},
  _submitURL: "",

  init: function AddCommentUI_init(submitURL) {
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
    this._submitURL = submitURL;
  },

  updateUI: function AddCommentUI_updateUI() {
    this._updateBuildList();
    this._updateLogLinkText();
    this._updateSubmitButton();
  },

  reset: function AddCommentUI_resut() {
    $("#logNoteText").get(0).value = "";
    this.addToBuilds = {};
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

  _getEmail: function AddCommentUI__getEmail() {
    return localStorage.email || "";
  },

  _setEmail: function AddCommentUI__setEmail(email) {
    localStorage.email = email;
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

};
