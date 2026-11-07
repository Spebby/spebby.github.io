/** Base16 theme manager. Themes live in a plain-text file (static/data/themes.txt). */

const STORAGE_KEY = "tui-theme";
const DEFAULT_THEMES_URL = "/data/themes.txt";
const SLOT_COUNT = 16;

export interface Theme {
  readonly name: string;
  /** `colors[n]` is base0n, as "#rrggbb". Slots a theme does not define are undefined. */
  readonly colors: (string | undefined)[];
}

const COLOR_LINE = /^(base(0[0-9a-f]|1[0-5])|color(1[0-5]|[0-9]))\s*(?:=|:|\s)\s*(#[0-9a-f]{6})$/i;

function baseName(slot: number): string {
  return `base${slot.toString(16).padStart(2, "0").toUpperCase()}`;
}

/**
 * Parses a simple Base16 theme file:
 *
 *   [theme name]
 *   base00: #1a1b26
 *   ...
 *   base0F: #db4b4b
 *
 * Comments begin with # on their own line. Also accepted: `base0a #112233`,
 * `base00 = #112233`, and `color0` ... `color15` in place of `base00` ... `base0F`.
 */
export function parseThemes(text: string): Theme[] {
  const themes: Theme[] = [];
  let current: { name: string; colors: (string | undefined)[] } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const section = line.match(/^\[(.+)\]$/);
    if (section?.[1] !== undefined) {
      current = { name: section[1].trim(), colors: new Array<string | undefined>(SLOT_COUNT) };
      themes.push(current);
      continue;
    }

    const color = COLOR_LINE.exec(line);
    if (!color || !current) continue;

    const hex = color[4];
    // base00..base0F carry the slot as hex in group 2, color0..color15 as decimal in group 3.
    const slot =
      color[2] !== undefined ? Number.parseInt(color[2], 16) : Number.parseInt(color[3] ?? "", 10);
    if (hex !== undefined && Number.isInteger(slot)) current.colors[slot] = hex.toLowerCase();
  }

  return themes;
}

function isComplete(theme: Theme): boolean {
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    if (!theme.colors[slot]) return false;
  }
  return true;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement.style;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const value = theme.colors[slot];
    if (value) root.setProperty(`--${baseName(slot)}`, value);
  }

  const button = document.getElementById("themeBtn");
  if (button) button.textContent = `theme: ${theme.name}`;

  try {
    localStorage.setItem(STORAGE_KEY, theme.name);
  } catch {
    // localStorage may be unavailable; the theme still applies for this visit.
  }
}

function savedIndex(themes: readonly Theme[]): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const index = themes.findIndex((theme) => theme.name === saved);
      if (index >= 0) return index;
    }
  } catch {
    // Ignore localStorage errors.
  }
  return 0;
}

export async function initThemes(): Promise<void> {
  const url = document.body.dataset.themesUrl ?? DEFAULT_THEMES_URL;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load themes (${response.status}) from ${url}`);

    const themes = parseThemes(await response.text()).filter(isComplete);
    if (themes.length === 0) throw new Error("No valid Base16 themes found.");

    let index = savedIndex(themes);
    const first = themes[index];
    if (first) applyTheme(first);

    document.getElementById("themeBtn")?.addEventListener("click", () => {
      index = (index + 1) % themes.length;
      const next = themes[index];
      if (next) applyTheme(next);
    });
  } catch (error) {
    console.error("Theme manager:", error);
  }
}
