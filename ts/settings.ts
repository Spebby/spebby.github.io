/** Persisted settings store, and the ~/settings page UI. */

import { core } from "./core";

export interface SettingValues {
  transparency: number;
  blur: number;
  paused: boolean;
  timeScale: number;
  oilSize: number;
  hue: number;
  intensity: number;
  bands: number;
  critterOn: boolean;
  critterCount: number;
  peekerOn: boolean;
  peekerCount: number;
}

export type SettingKey = keyof SettingValues;

type KeysOfType<T, V> = { [K in keyof T]: T[K] extends V ? K : never }[keyof T];
type BooleanKey = KeysOfType<SettingValues, boolean>;
type NumberKey = KeysOfType<SettingValues, number>;

const STORAGE_KEY = "tui-settings";

const DEFAULTS: Readonly<SettingValues> = {
  transparency: 0.65,
  blur: 0.2,
  paused: core.reduceMotion,
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

const KEYS = Object.keys(DEFAULTS) as SettingKey[];

const values: SettingValues = { ...DEFAULTS };

type Listener = { readonly keys: readonly SettingKey[]; readonly fn: (key: SettingKey) => void };
const listeners: Listener[] = [];

function notify(key: SettingKey): void {
  for (const listener of listeners) {
    if (listener.keys.includes(key)) listener.fn(key);
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // localStorage may be unavailable; settings still work for this visit.
  }
}

/** Takes a stored value only if it has the same type as the default. */
function restoreKey<K extends SettingKey>(key: K, candidate: unknown): void {
  if (typeof candidate === typeof DEFAULTS[key]) values[key] = candidate as SettingValues[K];
}

function loadSaved(): void {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof saved !== "object" || saved === null) return;
    const record = saved as Record<string, unknown>;
    for (const key of KEYS) restoreKey(key, record[key]);
  } catch {
    // Unreadable or unavailable storage: keep the defaults.
  }
}

/** Settings that act on globals rather than on one module. */
function applyGlobal(key: SettingKey): void {
  const root = document.documentElement.style;
  switch (key) {
    case "transparency":
      root.setProperty("--transparency", `${Math.round(values.transparency * 100)}%`);
      break;
    case "blur":
      root.setProperty("--blur", `${Math.round(values.blur * 25)}px`);
      break;
    case "paused":
      core.setPaused(values.paused);
      break;
    case "timeScale":
      core.setTimeScale(values.timeScale);
      break;
    default:
      break;
  }
}

function set<K extends SettingKey>(key: K, value: SettingValues[K]): void {
  if (values[key] === value) return;
  values[key] = value;
  applyGlobal(key);
  save();
  notify(key);
}

function resetKey<K extends SettingKey>(key: K): void {
  set(key, DEFAULTS[key]);
}

function reset(): void {
  for (const key of KEYS) resetKey(key);
}

loadSaved();
for (const key of KEYS) applyGlobal(key);

export const settings = {
  get: <K extends SettingKey>(key: K): SettingValues[K] => values[key],
  set,
  reset,
  onChange: (keys: readonly SettingKey[], fn: (key: SettingKey) => void): void => {
    listeners.push({ keys, fn });
  },
};

/* ---------------- UI ---------------- */

interface ToggleControl {
  readonly type: "toggle";
  readonly key: BooleanKey;
  readonly label: string;
  readonly enabledBy?: BooleanKey;
}

interface RangeControl {
  readonly type: "range";
  readonly key: NumberKey;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly format: (value: number) => string;
  readonly enabledBy?: BooleanKey;
}

type Control = ToggleControl | RangeControl;

interface Group {
  readonly title: string;
  readonly desktopOnly?: boolean;
  readonly controls: readonly Control[];
}

const SCHEMA: readonly Group[] = [
  {
    title: "panel",
    controls: [
      {
        type: "range",
        key: "transparency",
        label: "panel opacity",
        min: 0,
        max: 1,
        step: 0.01,
        format: (v) => `${Math.round(v * 100)}%`,
      },
      {
        type: "range",
        key: "blur",
        label: "panel blur",
        min: 0,
        max: 1,
        step: 0.01,
        format: (v) => `${Math.round(v * 25)}px`,
      },
    ],
  },
  {
    title: "time",
    controls: [
      { type: "toggle", key: "paused", label: "pause animations" },
      {
        type: "range",
        key: "timeScale",
        label: "time scale",
        min: 0.1,
        max: 3,
        step: 0.1,
        format: (v) => `${v.toFixed(1)}x`,
      },
    ],
  },
  {
    title: "shader",
    controls: [
      {
        type: "range",
        key: "oilSize",
        label: "oil size",
        min: 0.4,
        max: 2.5,
        step: 0.05,
        format: (v) => `${v.toFixed(2)}x`,
      },
      {
        type: "range",
        key: "hue",
        label: "hue shift",
        min: 0,
        max: 1,
        step: 0.01,
        format: (v) => `${Math.round(v * 360)}°`,
      },
      {
        type: "range",
        key: "intensity",
        label: "color intensity",
        min: 0,
        max: 1.6,
        step: 0.05,
        format: (v) => `${Math.round(v * 100)}%`,
      },
      {
        type: "range",
        key: "bands",
        label: "color bands",
        min: 0.3,
        max: 3,
        step: 0.05,
        format: (v) => `${v.toFixed(2)}x`,
      },
    ],
  },
  {
    title: "critters",
    desktopOnly: true,
    controls: [
      // The walking critter (sprites.ts) is not wired up, so its controls are not listed.
      { type: "toggle", key: "peekerOn", label: "peekers" },
      {
        type: "range",
        key: "peekerCount",
        label: "peeker count",
        min: 1,
        max: 20,
        step: 1,
        format: (v) => String(v),
        enabledBy: "peekerOn",
      },
    ],
  },
];

interface Row {
  readonly row: HTMLLabelElement;
  readonly input: HTMLInputElement;
  readonly output: HTMLSpanElement | null;
  readonly control: Control;
}

function buildRow(control: Control): Row {
  const row = document.createElement("label");
  row.className = `setting ${control.type}`;

  const name = document.createElement("span");
  name.className = "setting-label";
  name.textContent = control.label;

  const input = document.createElement("input");
  let output: HTMLSpanElement | null = null;

  if (control.type === "toggle") {
    input.type = "checkbox";
    const box = document.createElement("span");
    box.className = "box";
    input.addEventListener("change", () => set(control.key, input.checked));
    row.append(input, box, name);
  } else {
    input.type = "range";
    input.min = String(control.min);
    input.max = String(control.max);
    input.step = String(control.step);
    output = document.createElement("span");
    output.className = "setting-value";
    input.addEventListener("input", () => set(control.key, Number.parseFloat(input.value)));
    row.append(name, input, output);
  }

  return { row, input, output, control };
}

function refreshRow({ row, input, output, control }: Row): void {
  if (control.type === "toggle") {
    input.checked = values[control.key];
  } else {
    const value = values[control.key];
    if (Number.parseFloat(input.value) !== value) input.value = String(value);
    if (output) output.textContent = control.format(value);
  }
  const off = control.enabledBy !== undefined && !values[control.enabledBy];
  input.disabled = off;
  row.classList.toggle("disabled", off);
}

/** Builds the settings controls into `root`. */
export function mountSettings(root: HTMLElement): void {
  const rows: Row[] = [];

  for (const group of SCHEMA) {
    const section = document.createElement("section");
    section.className = `setting-group${group.desktopOnly ? " desktop-only" : ""}`;
    const heading = document.createElement("h2");
    heading.textContent = group.title;
    section.appendChild(heading);

    for (const control of group.controls) {
      const row = buildRow(control);
      rows.push(row);
      section.appendChild(row.row);
    }
    root.appendChild(section);
  }

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "resetbtn";
  resetButton.textContent = "reset to defaults";
  resetButton.addEventListener("click", reset);
  root.appendChild(resetButton);

  const refresh = (): void => {
    for (const row of rows) refreshRow(row);
  };
  listeners.push({ keys: rows.map((row) => row.control.key), fn: refresh });
  refresh();

  // The tab router ran before this content existed; nudge the "-- more --"
  // indicators to re-measure.
  window.dispatchEvent(new Event("resize"));
}
