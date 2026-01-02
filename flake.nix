{
  description = "Dev environment for website development";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    pre-commit-hooks = {
      url = "github:cachix/pre-commit-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      pre-commit-hooks,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        checks = {
          pre-commit-check = pre-commit-hooks.lib.${system}.run {
            src = ./.;
            excludes = [
              ".*/submodules/.*"
              "^submodules/.*"
            ];
            hooks = {
              flake-checker.enable = true;
              nixfmt-rfc-style = {
                enable = true;
                settings.width = 100;
              };
              statix = {
                enable = true;
                settings.ignore = [ "flake.lock" ];
              };
              deadnix.enable = true;
              nil.enable = true;
              shellcheck.enable = true;
              shfmt.enable = true;
              typos.enable = true;
            };
          };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            git
            ruby_3_3
            rubyPackages_3_3.jekyll
            rubyPackages_3_3.jekyll-redirect-from
            rubyPackages_3_3.kramdown-parser-gfm
          ];

          shellHook = ''
            		echo "Dev Env loaded."
            		${self.checks.${system}.pre-commit-check.shellHook}
          '';
        };
      }
    );
}
