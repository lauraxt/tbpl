var SummaryLoader = {


  _abortOutstandingSummaryLoadings: function () {},
  _cachedSummaries: {},

  setupSummaryLoader: function(result, box) {
    if (result.state == "building" || result.state == "success")
      return;
  
    var summaryLoader = $("#summaryLoader").get(0);
    summaryLoader.innerHTML = "Retrieving summary..."
    summaryLoader.className = "loading";
    this._fetchSummary(result.runID, result.tree, function(summary) {
      summaryLoader.innerHTML = summary ? "" : "Summary is empty.";
      summaryLoader.className = "";
      if (summary)
        box.className += " hasSummary";
      $(".stars .summary").get(0).innerHTML = summary.replace(/ALSA.*device\n/g, "").replace(/\n/g, "<br>\n");
    }, function() {
      summaryLoader.innerHTML = "Fetching summary failed.";
      summaryLoader.className = "";
    }, function() {
      summaryLoader.innerHTML = "Fetching summary timed out.";
      summaryLoader.className = "";
    });
  },

  _fetchSummary: function(runID, tree, loadCallback, failCallback, timeoutCallback) {
    var self = this;
    if (this._cachedSummaries[runID]) {
      loadCallback(this._cachedSummaries[runID]);
      return;
    }
    var onLoad = function(summary) {
      self._cachedSummaries[runID] = summary;
      loadCallback(summary);
    };
    var req = NetUtils.loadText("summaries/get.php?tree=" + tree + "&id=" + runID, onLoad, failCallback, timeoutCallback);
    var oldAbort = this._abortOutstandingSummaryLoadings;
    this._abortOutstandingSummaryLoadings = function () {
      if (req)
        req.abort();
      oldAbort();
    }
  },

}