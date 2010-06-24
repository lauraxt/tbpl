var SummaryLoader = {


  _abortOutstandingSummaryLoadings: function empty() {},
  _cachedSummaries: {},

  setupSummaryLoader: function SummaryLoader_setupSummaryLoader(result, box) {
    if (result.state == "building" || result.state == "success")
      return;
  
    var summaryLoader = $("#summaryLoader").get(0);
    summaryLoader.innerHTML = "Retrieving summary..."
    summaryLoader.className = "loading";
    this._fetchSummary(result.runID, result.tree, !!result.note, function fetchSummaryLoadCallback(summary) {
      summaryLoader.innerHTML = summary ? "" : "Summary is empty.";
      summaryLoader.className = "";
      if (summary)
        box.className += " hasSummary";
      var summaryPlaceholder = $(".stars .summary").get(0);
      summaryPlaceholder.innerHTML = summary.replace(/ALSA.*device\n/g, "").replace(/\n/g, "<br>\n");
      result.suggestions = [];
      var log = $(summaryPlaceholder)
                .contents().filter(function () { return this.nodeType == this.TEXT_NODE; })
                .map(function() { return this.textContent.trim() || null; })
                .get().join("\n");
      var suggestions = $(".stars .summary [data-bugid]");
      for (var i = 0; i < suggestions.length; ++i) {
        var item = $(suggestions[i]);
        var suggestion = {
          id: item.attr("data-bugid"),
          summary: item.attr("data-summary"),
          log: log,
          signature: item.attr("data-signature"),
          status: item.attr("data-status")
        };
        result.suggestions.push(suggestion);
        var highlightTokens = item.attr("data-logline").split(/[^a-zA-Z0-9_-]+/);
        highlightTokens.sort(function(a, b) {
          return b.length - a.length;
        });
        var summary = item.attr("data-summary");
        highlightTokens.forEach(function(token) {
          if (token.length > 0)
            summary = summary.replace(new RegExp(token, "gi"), "<span class=\"highlight\">" + token + "</span>");
        });
        item.html('<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=' +
          item.attr("data-bugid") + '" target="_blank">Bug ' +
          item.attr("data-bugid") + ' - ' + summary + '</a>');
        item.attr("title", item.attr("data-status"));
      }
      AddCommentUI.updateUI();
    }, function fetchSummaryFailCallback() {
      summaryLoader.innerHTML = "Fetching summary failed.";
      summaryLoader.className = "";
    }, function fetchSummaryTimeoutCallback() {
      summaryLoader.innerHTML = "Fetching summary timed out.";
      summaryLoader.className = "";
    });
  },

  _fetchSummary: function SummaryLoader__fetchSummary(runID, tree, isStarred, loadCallback, failCallback, timeoutCallback) {
    var self = this;
    if (this._cachedSummaries[runID]) {
      loadCallback(this._cachedSummaries[runID]);
      return;
    }
    var onLoad = function onSummaryLoad(summary) {
      self._cachedSummaries[runID] = summary;
      loadCallback(summary);
    };
    var req = NetUtils.loadText(Config.baseURL + "php/getSummary.php?tree=" + tree + "&id=" + runID + "&starred=" + (isStarred ? "true" : "false"),
                                onLoad, failCallback, timeoutCallback);
    var oldAbort = this._abortOutstandingSummaryLoadings;
    this._abortOutstandingSummaryLoadings = function abortThisLoadWhenAborting() {
      if (req)
        req.abort();
      oldAbort();
    }
  },

}
