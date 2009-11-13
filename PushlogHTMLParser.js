var PushlogHTMLParser = {

  load: function PushlogHTMLParser_load(repoName, timeOffset, loadCallback, failCallback) {
    var self = this;
    var logURL = this._getLogUrl(repoName, timeOffset);
    NetUtils.loadDom(logURL, function pushlogDomLoadCallback(doc) {
      try {
        loadCallback(self._parsePushlog(doc));
      } catch (e) {
        window.pushlogException = e;
        failCallback(e);
      }
    });
  },

  _getLogUrl: function PushlogHTMLParser__getLogUrl(repoName, timeOffset) {
    var startDate = timeOffset ? (new Date((timeOffset - 12 * 3600) * 1000)).toLocaleFormat('%Y-%m-%d+%H:%M:%S') : '12+hours+ago';
    var endDate = timeOffset ? (new Date(timeOffset * 1000)).toLocaleFormat('%Y-%m-%d+%H:%M:%S') : 'now';
    return "fetchraw.php?site=pushlog&url=" + repoName + "/pushloghtml%3Fstartdate=" + startDate + "%26enddate=" + endDate;
  },

  _parsePushlog: function PushlogHTMLParser__parsePushlog(doc) {
    if (!doc.getElementsByTagName("table").length)
      throw "Parsing pushlog failed.";

    var self = this;
    var pushes = [];
    var table = doc.getElementsByTagName("table")[0];
    $("td:first-child cite", table).each(function forEachPush() {
      var matches = /.*id([0-9]*)/.exec(this.parentNode.parentNode.className);
      var pusher = this.firstChild.data;
      var date = new Date($(".date", this).get(0).innerHTML);
      var patches = [];
      $("tr.id"+matches[1], table).each(function forEachPatch() {
        var rev = $("td.age a", this).get(0).textContent;
        var strong = this.lastChild.firstChild.innerHTML;
        var dashpos = strong.indexOf(String.fromCharCode(8212));
        var author = strong.substring(0, dashpos - 1);
        var desc = strong.substring(dashpos + 2);
        patches.push({
          "rev": rev,
          "author": author,
          "desc": self._stripTags(desc)
        });
      });
      pushes.push({
        "pusher": pusher,
        "date": date,
        "toprev": patches[0].rev,
        "patches": patches
      });
    });
    return pushes;
  },

  _stripTags: function PushlogHTMLParser__stripTags(text) {
    var div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

};
