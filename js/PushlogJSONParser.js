var PushlogJSONParser = {

  load: function PushlogJSONParser_load(repoName, timeOffset, loadCallback, failCallback) {
    var self = this;
    $.getJSON(this._getLogUrl(repoName, timeOffset), function(data) {
      var pushes = [];
      for (var i in data) {
        var push = data[i];
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
          var author = /([^<]+) /.exec(patch.author)[1];
          
          // Revert the order because we want most recent pushes / patches to
          // come first.
          patches.unshift({rev: patch.node.substr(0,12), author: author,
                  desc: Controller.stripTags(patch.desc), tags: tags});
        }
        pushes.unshift({pusher: push.user, date: new Date(push.date * 1000), toprev: patches[0].rev, patches: patches});
      }
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

  _formattedDate: function PushlogJSONParser__formattedDate(d) {
    var pad = this._pad;
    return pad(d.getFullYear()) + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "+" +
           pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }
};
