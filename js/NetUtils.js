/* -*- Mode: JS; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set sw=2 ts=2 et tw=80 : */

var NetUtils = {
  loadText: function NetUtils_loadText(url, loadCallback, failCallback, timeoutCallback, timeout) {
    if (timeout === undefined) {
      timeout = 30; // seconds
    }

    var errorTimer;
    var req = new XMLHttpRequest();
    req.onerror = failCallback;
    req.onload = function requestLoaded() {
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
    errorTimer = setTimeout(function requestTimedOut() {
      window.tinderboxException = "timed out";
      req.abort();
      timeoutCallback();
    }, timeout * 1000);
    return req;
  },

  crossDomainPost: function NetUtils_crossDomainPost(url, values, callback) {
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
    iframe.get(0).onload = function crossDomainIframeLoaded() {
      callback();
      setTimeout(function () { iframe.remove(); }, 0);
    }
  },

};
