(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page"));

  function route() {
    var wanted = (location.hash || "#home").slice(1);
    var valid = pages.some(function (p) {
      return p.dataset.page === wanted;
    });
    var page = valid ? wanted : "home";

    var activePage;
    pages.forEach(function (p) {
      var isActive = p.dataset.page === page;
      p.hidden = !isActive;
      if (isActive) activePage = p;
    });
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.dataset.page === page);
    });

    if (activePage && window.updateScrollpane) {
      var scrollpanes = activePage.classList.contains("scrollpane")
        ? [activePage]
        : Array.prototype.slice.call(
            activePage.querySelectorAll(".scrollpane"),
          );
      scrollpanes.forEach(window.updateScrollpane);
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      location.hash = t.dataset.page;
    });
    t.setAttribute("tabindex", "0");
    t.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        location.hash = t.dataset.page;
      }
    });
  });
  window.addEventListener("hashchange", route);
  route();
})();
