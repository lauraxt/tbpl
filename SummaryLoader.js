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
      $(".stars .summary").get(0).innerHTML = summary.replace(/ALSA.*device\n/g, "").replace(/\n/g, "<br>\n");
      result.suggestions = [];
      var suggestions = $(".stars .summary [data-bugid]");
      for (var i = 0; i < suggestions.length; ++i) {
        var item = $(suggestions[i]);
        var suggestion = {
          id: item.attr("data-bugid"),
          summary: item.attr("data-summary"),
          status: item.attr("data-status")
        };
        result.suggestions.push(suggestion);
        item.html('<a href="https://bugzilla.mozilla.org/show_bug.cgi?id=' +
          item.attr("data-bugid") + '" target="_blank">' + item.html() + '</a>');
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
    var req = NetUtils.loadText("summaries/get.php?tree=" + tree + "&id=" + runID + "&starred=" + (isStarred ? "true" : "false"),
                                onLoad, failCallback, timeoutCallback);
    var oldAbort = this._abortOutstandingSummaryLoadings;
    this._abortOutstandingSummaryLoadings = function abortThisLoadWhenAborting() {
      if (req)
        req.abort();
      oldAbort();
    }
  },

}
