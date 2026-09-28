// Handles the visibility of any scrolling indicators on the page.
(function () {
  function updateIndicator(pane) {
    var indicator = pane.querySelector(":scope > .more-indicator");
    if (!indicator) return;

    var overflowing = pane.scrollHeight > pane.clientHeight + 1;
    var atBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2;

    indicator.classList.toggle("visible", overflowing && !atBottom);
  }

  var panes = Array.prototype.slice.call(
    document.querySelectorAll(".scrollpane"),
  );

  panes.forEach(function (pane) {
    pane.addEventListener(
      "scroll",
      function () {
        updateIndicator(pane);
      },
      { passive: true },
    );
  });

  window.addEventListener("resize", function () {
    panes.forEach(updateIndicator);
  });

  // Watch the content, because its size can change without
  // changing the scrollpane's own size.
  var observer = new ResizeObserver(function (entries) {
    entries.forEach(function (entry) {
      updateIndicator(entry.target.closest(".scrollpane"));
    });
  });

  panes.forEach(function (pane) {
    Array.prototype.forEach.call(pane.children, function (child) {
      observer.observe(child);
    });
  });

  window.updateScrollpane = function (pane) {
    pane.scrollTop = 0;
    updateIndicator(pane);
  };

  panes.forEach(updateIndicator);
})();
