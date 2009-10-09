var NetUtils = {

  loadDom: function(url, callback) {
    var iframe = $("<iframe></iframe>").hide().appendTo(document.body).get(0);
    iframe.contentWindow.location.href = url;
    iframe.onload = function() {
      callback(this.contentDocument);
      setTimeout(function() { $(iframe).remove(); }, 0);
    };
  },

  loadText: function(url, loadCallback, failCallback, timeoutCallback, timeout) {
    if (timeout === undefined) {
      timeout = 30; // seconds
    }

    var errorTimer;
    var req = new XMLHttpRequest();
    req.onerror = failCallback;
    req.onload = function () {
      clearInterval(errorTimer);
      loadCallback(req.responseText);
    };
    try {
      req.open("GET", url, true); 
      req.send();
    } catch (e) {
      window.tinderboxException = e;
      failCallback(e);
      return;
    }
    errorTimer = setTimeout(function () {
      window.tinderboxException = "timed out";
      req.abort();
      timeoutCallback();
    }, timeout * 1000);
    return req;
  },

  crossDomainPost: function (url, values, callback) {
    if (!arguments.callee.c)
      arguments.callee.c = 1;
    var iframeName = "iframe" + arguments.callee.c++;
    var iframe = $("<iframe></iframe>").hide().attr("name", iframeName).appendTo("body");
    var form = $("<form></form>").hide().attr({ action: url, method: "post", target: iframeName }).appendTo("body");
    for (var i in values) {
      $("<input type='hidden'>").attr({ name: i, value: values[i]}).appendTo(form);
    }
    form.get(0).submit();
    form.remove();
    iframe.get(0).onload = function () {
      callback();
      setTimeout(function () { iframe.remove(); }, 0);
    }
  },

};
