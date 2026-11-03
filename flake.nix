{
  description = "spebby.net website (Zola)";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      git-hooks,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        inherit (nixpkgs) lib;

        help = pkgs.writeShellApplication {
          name = "help";
          text = ''
            cat <<'EOF'
            spebby.net development commands

            Build:
              nix run .#build    Bundle TypeScript and build the Zola site
              nix run build      ditto
              nix run            Run the default build app (ditto)

            Development:
              nix develop        Enter the development shell
              dev                Start esbuild watch mode & Zola's dev server

            Checks:
              nix run .#preview  Build & serve a local production preview
              nix flake check    Run all flake checks
              nix fmt            Format Nix files
              tsc -p .           Type-check TypeScript
              biome ci .         Run Biome checks

            Help:
              nix run .#help     Print available commands
            EOF
          '';
        };

        # Only what is strictly necessary to build the site.
        siteSource = lib.fileset.toSource {
          root = ./.;
          fileset = lib.fileset.unions [
            ./config.toml
            ./content
            ./static
            ./templates
            ./ts
            ./tsconfig.json
          ];
        };

        # All repository files used by lint checks.
        repoSource = lib.fileset.toSource {
          root = ./.;
          fileset = lib.fileset.difference ./. (lib.fileset.maybeMissing ./.git);
        };

        # Bundle TypeScript and import GLSL files as text.
        esbuildFlags = lib.escapeShellArgs [
          "ts/main.ts"
          "--bundle"
          "--minify"
          "--target=es2022"
          "--loader:.glsl=text"
          "--outfile=static/js/main.js"
        ];

        buildSite = pkgs.writeShellApplication {
          name = "build-site";
          runtimeInputs = with pkgs; [
            esbuild
            zola
          ];
          text = ''
            set -e
            esbuild ${esbuildFlags}
            zola build "$@"
          '';
        };

        # Shared site derivation.
        site = pkgs.stdenvNoCC.mkDerivation {
          pname = "spebby.net";
          version = "4.0";
          src = siteSource;

          nativeBuildInputs = with pkgs; [
            esbuild
            zola
          ];

          buildPhase = ''
            runHook preBuild
            esbuild ${esbuildFlags}
            zola build --output-dir "$out"
            runHook postBuild
          '';

          doCheck = true;
          checkPhase = ''
            runHook preCheck
            zola check --skip-external-links
            runHook postCheck
          '';

          dontInstall = true;
        };

        preview = pkgs.writeShellApplication {
          name = "preview";
          runtimeInputs = [ pkgs.python3 ];
          text = ''
            tmpdir="$(mktemp -d)"
            trap 'rm -rf "$tmpdir"' EXIT

            ${buildSite}/bin/build-site \
              --base-url "http://127.0.0.1:8000/spebbynet" \
              --output-dir "$tmpdir/spebbynet"

            echo "Preview available at http://127.0.0.1:8000/spebbynet"

            python3 -m http.server 8000 \
              --bind 127.0.0.1 \
              --directory "$tmpdir"
          '';
        };

        lint =
          name: tools: script:
          pkgs.runCommand name { nativeBuildInputs = tools; } ''
            export HOME="$TMPDIR"
            cd ${repoSource}
            ${script}
            touch "$out"
          '';

        dev = pkgs.writeShellApplication {
          name = "dev";
          runtimeInputs = with pkgs; [
            esbuild
            zola
          ];

          text = ''
            esbuild ${esbuildFlags}
            esbuild ${esbuildFlags} --watch=forever --log-level=warning &
            trap 'kill 0' EXIT
            zola serve
          '';
        };

        gitHooks = git-hooks.lib.${system}.run {
          src = ./.;
          excludes = [ ];
          hooks = {
            flake-checker.enable = true;
            nixfmt = {
              enable = true;
              settings.width = 100;
            };
            shfmt.enable = true;
            typos.enable = true;
          };
        };
      in
      {
        packages = {
          inherit site;
          default = site;
        };

        apps = {
          build = {
            type = "app";
            program = "${buildSite}/bin/build-site";
            meta.description = "Build the website";
          };

          help = {
            type = "app";
            program = "${help}/bin/help";
            meta.description = "Show available project commands";
          };

          preview = {
            type = "app";
            program = "${preview}/bin/preview";
            meta.description = "Build and serve a local production preview";
          };

          default = self.apps.${system}.build;
        };

        checks = {
          inherit site;

          # Things outside the page content that must survive the build.
          site-files =
            let
              files = [
                "CNAME"
                ".well-known/discord"
                "favicon.ico"
                "downloads/CV_Thom_Mott.pdf"
                "downloads/UCSC_Unofficial_Transcript.pdf"
                "downloads/Writing_Sample_Thom_Mott.pdf"
                "icons/github.svg"
                "icons/linkedin.svg"
                "icons/orcid.svg"
                "icons/bluesky.svg"
                "icons/instagram.svg"
              ];

              legacyPages = [
                "About"
                "Bio"
                "CV"
                "Contact"
                "Endless-Runner"
                "EndlessRunner"
                "Home"
                "Landing"
                "Portfolio"
                "Projects"
                "Resume"
                "SBZ"
                "Settings"
                "Work"
                "about"
                "bio"
                "cv"
                "endless-runner"
                "endlessrunner"
                "flyby"
                "home"
                "landing"
                "portfolio"
                "projects"
                "sbz"
                "settings"
                "work"
              ];

              expected = files ++ map (page: "${page}/index.html") legacyPages;
            in
            pkgs.runCommand "site-files" { } ''
              cd ${site}
              ${lib.concatMapStringsSep "\n" (path: "test -f ${lib.escapeShellArg path}") expected}
              touch "$out"
            '';

          nixfmt = lint "nixfmt" [ pkgs.nixfmt ] "nixfmt --strict --check flake.nix";
          statix = lint "statix" [ pkgs.statix ] "statix check .";
          deadnix = lint "deadnix" [ pkgs.deadnix ] "deadnix --fail .";
          typecheck = lint "typecheck" [ pkgs.typescript ] "tsc -p .";
          biome = lint "biome" [ pkgs.biome ] "biome ci .";
          typos = lint "typos" [ pkgs.typos ] "typos";

          actionlint = lint "actionlint" [
            pkgs.actionlint
          ] "actionlint -color=false .github/workflows/*.yml";

          zizmor = lint "zizmor" [
            pkgs.zizmor
          ] "zizmor --pedantic --min-severity medium --no-online-audits .";
        }
        // pkgs.lib.optionalAttrs pkgs.stdenv.isLinux { git-check = gitHooks; };

        formatter = pkgs.nixfmt;

        devShells.default = pkgs.mkShell {
          inherit gitHooks;
          packages = [
            dev
            pkgs.actionlint
            pkgs.biome
            pkgs.deadnix
            pkgs.esbuild
            pkgs.nil
            pkgs.nixfmt
            pkgs.statix
            pkgs.typescript
            pkgs.typos
            pkgs.zizmor
            pkgs.zola
          ]
          ++ gitHooks.enabledPackages;

          shellHook = ''
            ${gitHooks.shellHook}
            nix run .#help
          '';
        };
      }
    );
}
