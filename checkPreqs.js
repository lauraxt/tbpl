function checkPreqs() {
  return Date.prototype.toLocaleFormat !== undefined;
}

document.body.className = "withJavaScript " + (checkPreqs() ? "with" : "no") + "Firefox3";
