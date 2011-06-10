/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

"use strict";

var HiddenBuildsAdminUI = {

  _builders: [],
  _filteredBuilders: [],
  _selectedBuilders: [],

  init: function HiddenBuildsAdminUI_init() {
    var self = this;
    $("#hideHiddenBuildsAdminUILink").bind("click", function hideHiddenBuildsAdminUI(e) {
      $("#hiddenBuildsAdminUI").fadeOut("fast", function afterFadeOut() {
        self._reset();
      });
      return false;
    });
    $("#builderSearch").bind("input", function builderSearchInput(e) {
      self._updateFilteredList();
    });
    $("#builderSearch").bind("blur", function builderSearchBlur(e) {
      self._adjustSelectionToFilter();
    });
    $("#hideBuilders").bind("click", function hideBuildersClick(e) {
      self._adjustSelectionToFilter();
      self._setHiddenStateOnSelectedBuilders(true);
    });
    $("#unhideBuilders").bind("click", function unhideBuildersClick(e) {
      self._adjustSelectionToFilter();
      self._setHiddenStateOnSelectedBuilders(false);
    });
    $("#builderList").delegate("li", "dblclick", function builderListDoubleClick(e) {
      self._toggleHiddenStateOnSelectedBuilders();
    });
    $("#saveBuilderHidings").bind("click", function openSubmitform(e) {
      $("#submitHiddenBuilderChangesPopup").fadeIn("fast");
      if (!$("#who").val())
        $("#who").val(AddCommentUI._getEmail())
      var focusTextfield = (!$("#who").val() ? $("#who") :
                              (!$("#password").val() ? $("#password") : $("#reason"))).get(0);
      focusTextfield.focus();
      focusTextfield.select();
    });
    $("#hiddenBuilderForm").bind("submit", function addNoteFormSubmit() {
      self.submit();
      return false;
    });
    $("#builderList").delegate("li", "mousedown", function builderListMouseDown(e) {
      if (e.shiftKey) {
        self._selectFromFocusedTo(this, false);
      } else if (e.metaKey || e.ctrlKey) {
        self._toggleSelectionFor($(this).attr("data-name"));
      } else {
        self._selectSingleItem(this);
      }
      var preDragSelection = self._selectedBuilders.slice();
      self._updateSelection();
      $(e.target).focus();

      $("#builderList > li").bind("mouseenter", function mouseDraggedOver() {
        // Expand / shrink the selection by dragging. We operate on the saved
        // pre-drag selection so that rows get unselected when the selection
        // window is shrunk.
        self._selectedBuilders = preDragSelection.slice();
        self._selectFromFocusedTo(this, e.metaKey || e.ctrlKey);
        self._updateSelection();
      });
      $(window).bind("mouseup", function mouseReleased(e) {
        $("#builderList > li").unbind("mouseenter");
      });
    });
  },
  
  open: function HiddenBuildsAdminUI_open(branch) {
    var self = this;
    $("#hiddenBuildsAdminUI > .loading").show();
    $("#loadedUI").hide();
    $("#hiddenBuildsAdminUI").fadeIn("fast");
    $.ajax({
      url: Config.baseURL + "php/getBuilders.php",
      type: "GET",
      data: {
        branch: branch,
      },
      success: function getBuildersSuccess(data) {
        self._builders = JSON.parse(data);
        for (var i = 0; i < self._builders.length; i++) {
          var builder = self._builders[i];
          var oldHidden = ("hidden" in builder) && !!builder.hidden;
          builder.hidden = oldHidden;
          builder.newHidden = oldHidden;
        }
        $("#hiddenBuildsAdminUI > .loading").hide();
        $("#loadedUI").show();
        self._updateFilteredList();
      },
    });
  },
  
  _selectFromFocusedTo: function HiddenBuildsAdminUI__selectFromFocusedTo(element, toggle) {
    var clickedName = $(element).attr("data-name");
    var focusedElement = $(element).parent().find(":focus").eq(0);
    if (focusedElement.length) {
      var focusedName = focusedElement.attr("data-name");
      var fromIndex = this._filteredBuilders.indexOf(this._getBuilder(focusedName));
      if (fromIndex != -1) {
        var toIndex = this._filteredBuilders.indexOf(this._getBuilder(clickedName));
        var startIndex = Math.min(fromIndex, toIndex);
        var endIndex = Math.max(fromIndex, toIndex);
        for (var i = startIndex; i <= endIndex; i++) {
          if (i == fromIndex)
            continue;
          var name = this._filteredBuilders[i].name;
          if (toggle) {
            this._toggleSelectionFor(name);
          } else if (!this._isSelected(name)) {
            this._selectedBuilders.push(name);
          }
        }
      }
    }
  },
  
  _toggleSelectionFor: function HiddenBuildsAdminUI__toggleSelectionFor(name) {
    var index = this._selectedBuilders.indexOf(name);
    if (index == -1) {
      this._selectedBuilders.push(name);
    } else {
      this._selectedBuilders.splice(index, 1);
    }
  },

  _selectSingleItem: function HiddenBuildsAdminUI__selectSingleItem(element) {
    var clickedName = $(element).attr("data-name");
    this._selectedBuilders = [clickedName];
  },

  _reset: function HiddenBuildsAdminUI__reset() {
    this._selectedBuilders = [];
    $("#builderSearch").val("");
    this._updateFilteredList();
  },

  _updateFilteredList: function HiddenBuildsAdminUI__updateFilteredList() {
    var filter = $("#builderSearch").val().toLowerCase().split(/\s+/);
    this._filteredBuilders = this._builders.filter(function builderMatchesFilter(builder) {
      var name = builder.buildername || builder.name;
      var search = name.toLowerCase() +
        " " + (builder.newHidden ? "hidden" : "visible") +
        (builder.hidden != builder.newHidden ? " changed" : "");
      return filter.every(function builderMatchesFilterTerm(filterTerm) {
        return search.indexOf(filterTerm) != -1;
      });
    });
    $("#builderList").html(this._filteredBuilders.map(function (builder) {
      var desc = builder.buildername || builder.name;
      return '<li tabindex="0" data-name="' + builder.name + '">' +
        '<span class="desc">' + desc.escapeContent() + '</span>\n' +
        '<span class="hiddenState"></span>' +
        '</li>';
    }).join("\n"));
    this._updateHiddenState();
    this._updateSelection();
  },

  _isSelected: function HiddenBuildsAdminUI__isSelected(name) {
    return this._selectedBuilders.indexOf(name) != -1;
  },

  _getBuilder: function HiddenBuildsAdminUI__getBuilder(name) {
    for (var i = 0; i < this._builders.length; i++) {
      if (this._builders[i].name == name)
        return this._builders[i];
    }
    return null;
  },

  _adjustSelectionToFilter: function HiddenBuildsAdminUI__adjustSelectionToFilter() {
    var self = this;
    this._selectedBuilders = this._selectedBuilders.filter(function (name) {
      return self._filteredBuilders.indexOf(self._getBuilder(name)) != -1;
    });
  },

  _somethingChanged: function HiddenBuildsAdminUI__somethingChanged() {
    return this._builders.some(function (builder) {
      return builder.hidden != builder.newHidden;
    });
  },

  _acceptChanges: function HiddenBuildsAdminUI__acceptChanges() {
    for (var i = 0; i < this._builders.length; i++) {
      var builder = this._builders[i];
      builder.hidden = builder.newHidden;
    }
  },

  _updateSelection: function HiddenBuildsAdminUI__updateSelection() {
    var self = this;
    $("#builderList > li").each(function () {
      var name = $(this).attr("data-name");
      $(this).toggleClass("selected", self._isSelected(name));
    });
  },

  _updateHiddenState: function HiddenBuildsAdminUI__updateHiddenState() {
    var self = this;
    $("#builderList > li").each(function () {
      var name = $(this).attr("data-name");
      var builder = self._getBuilder(name);
      $(this).find(".hiddenState")
        .toggleClass("hidden", builder.newHidden)
        .html(builder.newHidden ? "hidden" : "visible");
      var changed = builder.hidden != builder.newHidden;
      $(this).toggleClass("changed", changed);
    });
    if (this._somethingChanged()) {
      $("#saveBuilderHidings").removeAttr("disabled");
    } else {
      $("#saveBuilderHidings").attr("disabled", "disabled");
    }
  },

  _setHiddenStateOnSelectedBuilders: function HiddenBuildsAdminUI__setHiddenStateOnSelectedBuilders(state) {
    var self = this;
    self._selectedBuilders.forEach(function (name) {
      self._getBuilder(name).newHidden = state;
    });
    self._updateHiddenState();
  },

  _toggleHiddenStateOnSelectedBuilders: function HiddenBuildsAdminUI__toggleHiddenStateOnSelectedBuilders() {
    var self = this;
    self._selectedBuilders.forEach(function (name) {
      var builder = self._getBuilder(name);
      builder.newHidden = !builder.newHidden;
    });
    self._updateHiddenState();
  },

  _getSubmitActions: function HiddenBuildsAdminUI__getSubmitActions() {
    var actions = {};
    for (var i = 0; i < this._builders.length; i++) {
      var builder = this._builders[i];
      if (builder.hidden != builder.newHidden) {
        actions[builder.name] = builder.newHidden ? "hide" : "unhide";
      }
    }
    return JSON.stringify(actions);
  },

  submit: function HiddenBuildsAdminUI_submit() {
    var self = this;
    var submitPopup = $("#submitHiddenBuilderChangesPopup")
    var submitButton = submitPopup.find("input[type=submit]").get(0);
    submitButton.disabled = true;
    $.ajax({
      url: Config.baseURL + "php/updateBuilders.php",
      type: "POST",
      data: {
        who: $("#who").val(),
        password: $("#password").val(),
        reason: $("#reason").val(),
        actions: this._getSubmitActions()
      },
      success: function updateBuilderSubmitSuccess(errors) {
        if (!errors) {
          self._acceptChanges();
          self._reset();
          submitPopup.fadeOut('fast', function afterPopupFadeOutAfterSubmit() {
            $("#reason").val("");
            submitButton.disabled = false;
          });
        } else {
          try {
            var errorObj = JSON.parse(errors);
            if (("error" in errorObj) && errorObj.error == "password") {
              $("#password").val("").focus();
            }
          } catch (e) { }
          submitButton.disabled = false;
        }
      }
    });
  },

};
