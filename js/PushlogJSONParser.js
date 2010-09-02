var PushlogJSONParser = {

  load: function PushlogJSONParser_load(repoName, timeOffset, loadCallback, failCallback) {
    var self = this;
    $.getJSON(this._getLogUrl(repoName, timeOffset), function(data) {
      var pushes = [];
      // data is keyed by a numerical ID which increases in chronological order.
      // However, data isn't sorted by that ID, so we need to do it here.
      var sorted = [];
      for (var pushID in data)
        sorted.push(+pushID);
      sorted.sort(function(a, b){ return a - b; });
      sorted.forEach(function addPush(pushID) {
        var push = data[pushID];
        var patches = [];
        for (var i in push.changesets) {
          var patch = push.changesets[i];
          // dont show the default branch and tag
          var tags = $(patch.tags).map(function() {
            return this != 'tip' ? {type: 'tagtag', name: this} : null;
          });
          if (patch.branch != 'default')
            tags.push({type: 'inbranchtag', name: patch.branch});
          
          // The new json output includes the email adress in <brackets>
          var author = $.trim(/([^<]+)/.exec(patch.author)[1]);

          // Revert the order because we want most recent pushes / patches to
          // come first.
          patches.unshift({rev: patch.node.substr(0,12), author: author,
                  desc: Controller.stripTags(patch.desc), tags: tags});
        }
        pushes.unshift({pusher: push.user, date: new Date(push.date * 1000), toprev: patches[0].rev, patches: patches});
      });
      loadCallback(pushes);
    });
  },

  _getLogUrl: function PushlogJSONParser__getLogUrl(repoName, timeOffset) {
    var startDate = timeOffset ? this._formattedDate(new Date((timeOffset - 12 * 3600) * 1000)) : '12+hours+ago';
    var endDate = timeOffset ? this._formattedDate(new Date(timeOffset * 1000)) : 'now';
    return "http://hg.mozilla.org/" + repoName + "/json-pushes?full=1&startdate=" + startDate + "&enddate=" + endDate;
  },

  _pad: function PushlogJSONParser__pad(n) {
    return n < 10 ? '0' + n : n;
  },

  _formattedDate: function PushlogHTMLParser__formattedDate(date) {
    var pad = this._pad;
    // this is annoying, pushlog expects the dates to be MVT time
    var hoursdiff = date.getTimezoneOffset() / 60 + Config.mvtTimezoneOffset;
    var d = new Date(date.getTime() + hoursdiff * 60 * 60 * 1000);

    var pad = this._pad;
    return pad(d.getFullYear()) + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "+" +
           pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
};
