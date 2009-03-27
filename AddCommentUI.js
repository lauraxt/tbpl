var AddCommentUI = {

  addToBuilds: {},
  numSendingComments: 0,
  numSendingCommentChangedCallback: function () {},
  _treeName: "",
  _submitURL: "",

  init: function (treeName, submitURL) {
    var self = this;
    $("a.addNote").live("click", function () {
      self.logLinkClick();
      return false;
    });
    $("#closeAddNotePopup").bind("click", function() {
      $("#addNotePopup").fadeOut('fast', function() {
        self.reset();
      });
      return false;
    });
    $("#logNoteEmail").bind("change", function() {
      globalStorage[location.host].email = this.value;
    });
    $("#logNoteEmail").get(0).value = globalStorage[location.host].email || "";
    $("#addNotePopup").draggable({ containment: 'window', handle: 'form, h2, table, tbody, tr, th, td, label, p' });
    $("#addNoteForm").bind("submit", function () {
      self.submit();
      $("#addNotePopup").fadeOut('fast', function() {
        self.reset();
      });
      return false;
    });
    this._treeName = treeName;
    this._submitURL = submitURL;
  },

  updateUI: function () {
    this._updateBuildList();
    this._updateLogLinkText();
    this._updateSubmitButton();
  },

  reset: function () {
    $("#logNoteText").get(0).value = "";
    this.addToBuilds = {};
    this.updateUI();
  },

  submit: function () {
    var self = this;
    var email = $("#logNoteEmail").get(0).value;
    var comment = $("#logNoteText").get(0).value;
    for (var i in this.addToBuilds) {
      this._postOneComment(email, comment, machineResults[i], function () {
        self.pendingCommentsChanged(-1);
      });
      this.pendingCommentsChanged(1);
    }
  },

  logLinkClick: function () {
    var div = $("#addNotePopup").fadeIn('fast');
    if (!this.addToBuilds[activeResult]) {
      this.addToBuilds[activeResult] = true;
      ($("#logNoteEmail").get(0).value ? $("#logNoteText") : $("#logNoteEmail")).get(0).focus();
    } else {
      delete this.addToBuilds[activeResult];
    }
    this.updateUI();
  },

  pendingCommentsChanged: function (changedBy) {
    this.numSendingComments += changedBy;
    this.numSendingCommentChangedCallback();
  },

  registerNumSendingCommentChangedCallback: function(callback) {
    this.numSendingCommentChangedCallback = callback;
  },

  _updateSubmitButton: function () {
    $("#addNoteForm input[type=submit]").get(0).disabled = this._buildListIsEmpty();
  },

  _updateBuildList: function () {
    var html = "";
    for (var i in this.addToBuilds) {
      html += machineResultLink(machineResults[i])
    }
    $("#logNoteRuns").html(html ? html : "(none selected)");
    markActiveResultLinks();
  },

  _updateLogLinkText: function () {
    $("a.addNote").text(
      !this._popupIsOpen() ? "Add a comment" :
        (this.addToBuilds[activeResult] ? "Don't add the comment to this build" :
                                          "Add the comment to this build, too"));
  },

  _buildListIsEmpty: function () {
    for (var i in this.addToBuilds)
      return false;
    return true;
  },

  _popupIsOpen: function () {
    return $("#addNotePopup").is(":visible");
  },

  _postOneComment: function(email, comment, machineResult, callback) {
    NetUtils.crossDomainPost(this._submitURL, {
      buildname: machineResult.machine.name,
      buildtime: machineResult.startTime.getTime() / 1000,
      errorparser: machineResult.errorParser,
      logfile: machineResult.runID,
      tree: this._treeName,
      who: email,
      note: comment,
    }, callback);
  },

};
