var PushlogHTMLParser = {
  load: function (repoName, loadCallback, failCallback) {
    var self = this;
    NetUtils.loadDom("fetchraw.php?site=pushlog&url=" + repoNames[treeName] + "/pushloghtml?startdate=14+hours+ago&enddate=now", function (doc) {
      try {
        loadCallback(self._parsePushlog(doc));
      } catch (e) {
        console.log(e);
        failCallback();
      }
    });
  },
  _parsePushlog: function (doc) {
    if (!doc.getElementsByTagName("table").length)
      throw "Parsing pushlog failed.";

    var self = this;
    var pushes = [];
    var table = doc.getElementsByTagName("table")[0];
    $("td:first-child cite", table).each(function () {
      var matches = /.*id([0-9]*)/.exec(this.parentNode.parentNode.className);
      var pusher = this.firstChild.data;
      var date = new Date($(".date", this).get(0).innerHTML);
      var numPatches = this.getAttribute("rowspan") * 1;
      var patches = [];
      $("tr.id"+matches[1], table).each(function () {
        var rev = $("td.age a", this).get(0).textContent;
        var strong = this.lastChild.firstChild.innerHTML;
        var dashpos = strong.indexOf(String.fromCharCode(8212));
        var author = strong.substring(0, dashpos - 1);
        var desc = strong.substring(dashpos + 2);
        patches.push({
          "rev": rev,
          "author": author,
          "desc": linkBugs(self._stripTags(desc))
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
  _stripTags: function (text) {
    var div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
};
