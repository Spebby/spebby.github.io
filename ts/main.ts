import "./core";
import { initClock } from "./clock";
import { startPeekers } from "./peekers";
import { loadProjects } from "./projects";
import { initRouter } from "./router";
import { initScrollIndicators } from "./scroll-indicator";
import { mountSettings } from "./settings";
import { startTerrain } from "./terrain";
import { initThemes } from "./themes";

// The same order the pages' scripts used to load in. Modules are deferred, so the DOM is
// already parsed by the time this runs.
void initThemes();
initScrollIndicators();
initRouter();
initClock();

const settingsRoot = document.getElementById("settingsRoot");
if (settingsRoot) mountSettings(settingsRoot);

startTerrain();
startPeekers();
void loadProjects();
