var NetUtils = {
    loadDom: function(url, callback) {
        var iframe = $("<iframe/>").hide().appendTo(document.documentElement).get(0);
        iframe.contentWindow.location.href = url;
        iframe.onload = function() {
            callback(this.contentDocument);
            $(this).remove();
        }
    }
};
