/** Shows or hides the "-- more --" indicator at the bottom of scrollable panes. */

function updateIndicator(pane: Element): void {
  const indicator = pane.querySelector(":scope > .more-indicator");
  if (!indicator) return;

  const overflowing = pane.scrollHeight > pane.clientHeight + 1;
  const atBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 2;

  indicator.classList.toggle("visible", overflowing && !atBottom);
}

/** Scrolls a pane back to the top and refreshes its indicator. */
export function updateScrollpane(pane: Element): void {
  pane.scrollTop = 0;
  updateIndicator(pane);
}

export function initScrollIndicators(): void {
  const panes = Array.from(document.querySelectorAll(".scrollpane"));

  for (const pane of panes) {
    pane.addEventListener("scroll", () => updateIndicator(pane), { passive: true });
  }

  window.addEventListener("resize", () => {
    for (const pane of panes) updateIndicator(pane);
  });

  // Watch the content, because its size can change without changing the
  // scrollpane's own size.
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const pane = entry.target.closest(".scrollpane");
      if (pane) updateIndicator(pane);
    }
  });

  for (const pane of panes) {
    for (const child of Array.from(pane.children)) observer.observe(child);
  }

  for (const pane of panes) updateIndicator(pane);
}
