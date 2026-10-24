{
  description = "Dev environment for website development";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
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
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        serveSite = pkgs.callPackage ./serve-site.nix { inherit pkgs; };
      in
      {
        checks = {
          git-check = git-hooks.lib.${system}.run {
            src = ./.;
            excludes = [
              ".*/submodules/.*"
              "^submodules/.*"
            ];
            hooks = {
              flake-checker.enable = true;
              nixfmt = {
                enable = true;
                settings.width = 100;
              };
              statix = {
                enable = true;
                settings.ignore = [ "flake.lock" ];
              };
              deadnix.enable = true;
              nil.enable = true;
              shfmt.enable = true;
              typos.enable = true;
            };
          };
        };

        devShells = {
          default = pkgs.mkShell {
            packages = with pkgs; [
              git
              ruby_4_0
              rubyPackages_4_0.jekyll
              rubyPackages_4_0.jekyll-redirect-from
              rubyPackages_4_0.kramdown-parser-gfm
            ];

            shellHook = ''
              echo "Dev Env loaded."
              ${self.checks.${system}.git-check.shellHook}
            '';
          };
        };

        apps =
          let
            default = {
              type = "app";
              program = pkgs.lib.getExe serveSite;
            };
            serve-site = {
              type = "app";
              program = pkgs.lib.getExe serveSite;
            };
          in
          {
            inherit default serve-site;
            serve = serve-site;
          };
      }
    );
}
