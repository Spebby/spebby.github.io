{ pkgs }:
let
  gems = pkgs.ruby_3_3.withPackages (
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
