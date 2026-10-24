{ pkgs }:
let
  gems = pkgs.ruby_4_0.withPackages (
    ps: with ps; [
      jekyll
      jekyll-redirect-from
      kramdown-parser-gfm
    ]
  );
in
pkgs.writeShellApplication {
  name = "serve-site";

  runtimeInputs = [ gems ];

  text = ''
    exec jekyll serve
  '';
}
