function checkPreqs() {
  return true; // XXX need to check what we really need and which browsers support it.
}

document.body.className = "withJavaScript " + (checkPreqs() ? "with" : "no") + "Firefox3";
