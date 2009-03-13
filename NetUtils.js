var NetUtils = {
    loadDom: function(url, callback) {
        var iframe = $("<iframe/>").hide().appendTo(document.documentElement).get(0);
        iframe.contentWindow.location.href = url;
        iframe.onload = function() {
            callback(this.contentDocument);
            $(this).remove();
        }
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
            failCallback();
            return;
        }
        errorTimer = setTimeout(function () {
            req.abort();
            timeoutCallback();
        }, timeout * 1000);
        return req;
    },
};
