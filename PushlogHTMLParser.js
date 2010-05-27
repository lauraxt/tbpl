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
    }, failCallback, failCallback, 120);
  },

  _getLogUrl: function PushlogHTMLParser__getLogUrl(repoName, timeOffset) {
    var startDate = timeOffset ? this._formattedDate(new Date((timeOffset - 12 * 3600) * 1000)) : '12+hours+ago';
    var endDate = timeOffset ? this._formattedDate(new Date(timeOffset * 1000)) : 'now';
    return Config.baseURL + "fetchraw.php?site=pushlog&url=" + repoName + "/pushloghtml%3Fstartdate=" + startDate + "%26enddate=" + endDate;
  },

  _pad: function UserInterface__pad(n) {
    return n < 10 ? '0' + n : n;
  },

  _formattedDate: function PushlogHTMLParser__formattedDate(d) {
    var pad = this._pad;
    return pad(d.getFullYear()) + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "+" +
           pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
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
      var date = self._parseDate($(".date", this).html());
      var patches = [];
      $("tr.id"+matches[1], table).each(function forEachPatch() {
        var rev = $("a", this).get(0).textContent;
        var strong = this.lastChild.firstChild.innerHTML;
        var dashpos = strong.indexOf(String.fromCharCode(8212));
        var author = strong.substring(0, dashpos - 1);
        var desc = strong.substring(dashpos + 2);
        var logtags = this.lastChild.lastChild.childNodes;
        patches.push({
          "rev": rev,
          "author": author,
          "desc": self._stripTags(desc),
          "tags": $(logtags).map(function() {
            return this.className && {
              "type": this.className,
              "name": this.textContent,
            };
          }).get(),
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

  _parseDate: function PushlogHTMLParser__parseDate(dateString) {
    var date = Date.parse(dateString);
    if (date)
      return new Date(date);

    // Webkit can't deal with the timezone offset.
    var splitString = dateString.match(/^(.*..:..:.. ....) (.*)$/);
    if (!splitString)
      return new Date();

    var dateInCurrentTimezone = Date.parse(splitString[1]);
    var offsetOfRealTimezoneFromGMT = splitString[2] / 100 * 60;
    var offsetOfCurrentTimezoneFromGMT = new Date(dateInCurrentTimezone).getTimezoneOffset();
    return new Date(dateInCurrentTimezone - (offsetOfCurrentTimezoneFromGMT + offsetOfRealTimezoneFromGMT) * 60 * 1000);
  },

  _stripTags: function PushlogHTMLParser__stripTags(text) {
    var div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },

};
