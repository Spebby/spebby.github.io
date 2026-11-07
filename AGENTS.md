# Agents

Static site built with Zola, with a TypeScript/WebGL front end. Tooling comes from the Nix flake; there is no npm or Bun.

## Commands

```sh
nix develop            # dev shell (or `direnv allow`)
dev                    # esbuild watch + zola serve
nix flake check        # everything CI runs
nix fmt                # format Nix files
biome check --write    # format and fix ts/
```

Run `nix flake check` before finishing any change.

## Conventions

- The site is one page. Tabs are panes in `templates/index.html`; `/<tab>/` URLs are redirect shims to `/#<tab>`.
- The tab list is `[[extra.tabs]]` in `content/_index.md`. Each other tab's text is `content/<slug>.md`.
- Pane layout is set by `extra.layout` (`split`, `scroll`, or `settings`) and rendered by `templates/partials/pane.html`.
- Asset URLs in templates, CSS and data are root-relative (`/img/...`). Do not use `get_url` for them: `zola serve` rewrites `base_url`, and a cross-origin module script or CSS mask is blocked.
- Stylesheets are listed in `config.toml` and load in that order. `mobile.css` sits fifth, not last.
- Front end: ES modules in `ts/` with no `window` globals. `core.ts` owns the frame loop and pointer, `settings.ts` the settings store and UI, `themes.ts` the Base16 themes. `terrain.ts`, `peekers.ts` and `sprites.ts` are animations.
- `sprites.ts` is not started by `main.ts`.
- Shaders are `.glsl` files in `ts/shaders/`, imported as text by esbuild.
- `static/js/` is generated; never edit or commit it.
- `static/` is copied as-is, including dot-paths (`.well-known/`). `nix flake check` fails if `CNAME`, `.well-known/discord`, the icons, downloads, favicon, or any legacy redirect page is missing.
- `templates/internal/alias.html` overrides Zola's alias pages. It only receives `url`, so it reads the tab list through `get_section`.
