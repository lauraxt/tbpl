try {
  if (checkPreqs())
    Controller.init();
} catch(e) {
  if (e == "wrongtree") {
    location.href = "wrongtree.html" + location.search;
  }
}
