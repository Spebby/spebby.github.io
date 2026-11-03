/** Hash-based tab router: `/#about` shows the pane with data-page="about". */

import { updateScrollpane } from "./scroll-indicator";

export function initRouter(): void {
  const tabs = Array.from(
    document.querySelectorAll<HTMLElement>(".tab[data-page]"),
  );
  const pages = Array.from(document.querySelectorAll<HTMLElement>(".page"));
  const defaultPage = tabs[0]?.dataset.page ?? pages[0]?.dataset.page;

  if (!defaultPage) return; // no routable tabs on this page

  function route(): void {
    const wanted = (location.hash || `#${defaultPage}`).slice(1);
    const page = pages.some((p) => p.dataset.page === wanted)
      ? wanted
      : defaultPage;

    let activePage: HTMLElement | undefined;
    for (const p of pages) {
      const isActive = p.dataset.page === page;
      p.hidden = !isActive;
      if (isActive) activePage = p;
    }
    for (const tab of tabs) {
      tab.classList.toggle("active", tab.dataset.page === page);
    }

    if (activePage) {
      window.scrollTo({ top: 0, behavior: "instant" });
      const scrollpanes = activePage.classList.contains("scrollpane")
        ? [activePage]
        : Array.from(activePage.querySelectorAll(".scrollpane"));

      for (const pane of scrollpanes) updateScrollpane(pane);
    }
  }

  for (const tab of tabs) {
    const go = (): void => {
      location.hash = tab.dataset.page ?? "";
    };
    tab.addEventListener("click", go);
    tab.setAttribute("tabindex", "0");
    tab.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        go();
      }
    });
  }

  window.addEventListener("hashchange", route);
  route();
}
