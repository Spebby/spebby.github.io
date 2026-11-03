# spebby.net

Static site built with [Zola](https://www.getzola.org/), with a TypeScript/WebGL front end. Tooling is pinned by the Nix flake; there is no npm.

## Commands

```sh
nix develop          # or `direnv allow`
dev                  # esbuild watch + zola serve, with live reload
nix build            # production build to ./result
nix flake check      # build, type check, required files, and all linters (what CI runs)
nix fmt              # format Nix files
biome check --write  # format and fix ts/
```

## Layout

- `config.toml`: site settings and the stylesheet list (load order matters)
- `content/_index.md`: the home page and the tab list (`[[extra.tabs]]`)
- `content/<tab>.md`: one file per other tab; the Markdown body is the pane's text
- `content/redirects/`: legacy URLs that redirect to sibling sites on this domain
- `templates/`: `base.html`, `index.html` (the single-page shell), `partials/pane.html`, `redirect.html`, `internal/alias.html`, `sitemap.xml`
- `ts/`: the front end, bundled by esbuild into `static/js/main.js` (generated, not committed)
  - `ts/shaders/`: terrain shaders, imported as text
- `static/`: copied to the site root as-is
  - `css/`, `data/` (project JSON, `themes.txt`), `icons/`, `img/cards/`, `downloads/`, `favicon.ico`, `CNAME`, `.well-known/`

## Adding things

- **Tab:** add `content/<slug>.md` (`template = "redirect.html"`, `extra.layout = "scroll"`, optional `aliases`), then a `[[extra.tabs]]` entry in `content/_index.md`.
- **Project card:** add an entry to `static/data/projFull.json`, and to `projFeat.json` to show it on the home page.
- **Theme:** add a `[name]` block of `base00`...`base0F` colours to `static/data/themes.txt`.
- **Setting:** add the default and a control in `ts/settings.ts`.
- **Legacy redirect:** add `content/redirects/<name>.md` with `path = "<name>"` and `extra.to`.

## Deployment

Pushes to `main` run `nix flake check`; when it passes, the deploy job publishes to GitHub Pages. In the repository settings, Pages must use the "GitHub Actions" source.
