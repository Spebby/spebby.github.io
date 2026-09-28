// settings.js — persisted settings store + the ~/settings page UI.
// Load after core.js, before terrain-bg.js / sprites.js / peekers.js.
window.TUISettings = (function () {
  const KEY = "tui-settings";
  const DEFAULTS = {
    transparency: 0.65,
    blur: 0.2,
    paused: TUICore.reduceMotion,
    timeScale: 1,
    oilSize: 1,
    hue: 0,
    intensity: 1,
    bands: 1,
    critterOn: true,
    critterCount: 1,
    peekerOn: true,
    peekerCount: 3,
  };

  const values = Object.assign({}, DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    for (const k in DEFAULTS)
      if (typeof saved[k] === typeof DEFAULTS[k]) values[k] = saved[k];
  } catch (e) {}

  const listeners = [];
  function notify(key) {
    listeners.forEach((l) => {
      if (l.keys.includes(key)) l.fn(key, values[key]);
    });
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch (e) {}
  }

  // Settings that act on globals rather than on one module.
  function applyGlobal(key) {
    if (key === "transparency")
      document.documentElement.style.setProperty(
        "--transparency",
        Math.round(values.transparency * 100) + "%",
      );
    if (key == "blur")
      document.documentElement.style.setProperty(
        "--blur",
        Math.round(values.blur * 25) + "px",
      );
    if (key === "paused") TUICore.setPaused(values.paused);
    if (key === "timeScale") TUICore.setTimeScale(values.timeScale);
  }

  function set(key, v) {
    if (values[key] === v) return;
    values[key] = v;
    applyGlobal(key);
    save();
    notify(key);
  }
  function reset() {
    for (const k in DEFAULTS) set(k, DEFAULTS[k]);
  }

  for (const k in DEFAULTS) applyGlobal(k);

  /* ---------------- UI ---------------- */

  const SCHEMA = [
    {
      title: "panel",
      controls: [
        {
          key: "transparency",
          label: "panel opacity",
          type: "range",
          min: 0,
          max: 1,
          step: 0.01,
          fmt: (v) => Math.round(v * 100) + "%",
        },
        {
          key: "blur",
          label: "panel blur",
          type: "range",
          min: 0,
          max: 1,
          step: 0.01,
          fmt: (v) => Math.round(v * 25) + "px",
        },
      ],
    },
    {
      title: "time",
      controls: [
        { key: "paused", label: "pause animations", type: "toggle" },
        {
          key: "timeScale",
          label: "time scale",
          type: "range",
          min: 0.1,
          max: 3,
          step: 0.1,
          fmt: (v) => v.toFixed(1) + "x",
        },
      ],
    },
    {
      title: "shader",
      controls: [
        {
          key: "oilSize",
          label: "oil size",
          type: "range",
          min: 0.4,
          max: 2.5,
          step: 0.05,
          fmt: (v) => v.toFixed(2) + "x",
        },
        {
          key: "hue",
          label: "hue shift",
          type: "range",
          min: 0,
          max: 1,
          step: 0.01,
          fmt: (v) => Math.round(v * 360) + "°",
        },
        {
          key: "intensity",
          label: "color intensity",
          type: "range",
          min: 0,
          max: 1.6,
          step: 0.05,
          fmt: (v) => Math.round(v * 100) + "%",
        },
        {
          key: "bands",
          label: "color bands",
          type: "range",
          min: 0.3,
          max: 3,
          step: 0.05,
          fmt: (v) => v.toFixed(2) + "x",
        },
      ],
    },
    {
      title: "critters",
      desktopOnly: true,
      controls: [
        /*
        { key: "critterOn", label: "walking critter", type: "toggle" },
        {
          key: "critterCount",
          label: "critter count",
          type: "range",
          min: 1,
          max: 5,
          step: 1,
          fmt: (v) => v,
          enabledBy: "critterOn",
        },
		*/
        { key: "peekerOn", label: "peekers", type: "toggle" },
        {
          key: "peekerCount",
          label: "peeker count",
          type: "range",
          min: 1,
          max: 20,
          step: 1,
          fmt: (v) => v,
          enabledBy: "peekerOn",
        },
      ],
    },
  ];

  function buildUI(root) {
    const rows = {};

    SCHEMA.forEach((group) => {
      const sec = document.createElement("section");
      sec.className =
        "setting-group" + (group.desktopOnly ? " desktop-only" : "");
      const h = document.createElement("h2");
      h.textContent = group.title;
      sec.appendChild(h);

      group.controls.forEach((def) => {
        const row = document.createElement("label");
        row.className = "setting " + def.type;
        const name = document.createElement("span");
        name.className = "setting-label";
        name.textContent = def.label;
        const input = document.createElement("input");
        let out = null;

        if (def.type === "toggle") {
          input.type = "checkbox";
          const box = document.createElement("span");
          box.className = "box";
          input.addEventListener("change", () => set(def.key, input.checked));
          row.append(input, box, name);
        } else {
          input.type = "range";
          input.min = def.min;
          input.max = def.max;
          input.step = def.step;
          out = document.createElement("span");
          out.className = "setting-value";
          input.addEventListener("input", () =>
            set(def.key, parseFloat(input.value)),
          );
          row.append(name, input, out);
        }
        rows[def.key] = { row, input, out, def };
        sec.appendChild(row);
      });
      root.appendChild(sec);
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "resetbtn";
    resetBtn.textContent = "reset to defaults";
    resetBtn.addEventListener("click", reset);
    root.appendChild(resetBtn);

    function refresh() {
      for (const key in rows) {
        const { row, input, out, def } = rows[key];
        if (def.type === "toggle") input.checked = values[key];
        else {
          if (parseFloat(input.value) !== values[key])
            input.value = values[key];
          out.textContent = def.fmt(values[key]);
        }
        const off = def.enabledBy && !values[def.enabledBy];
        input.disabled = !!off;
        row.classList.toggle("disabled", !!off);
      }
    }
    listeners.push({ keys: Object.keys(rows), fn: refresh });
    refresh();

    // The tab router ran before this content existed; nudge the
    // "-- more --" indicators to re-measure.
    window.dispatchEvent(new Event("resize"));
  }

  const root = document.getElementById("settingsRoot");
  if (root) buildUI(root);

  return {
    get: (k) => values[k],
    set,
    reset,
    onChange: (keys, fn) => listeners.push({ keys: [].concat(keys), fn }),
  };
})();
