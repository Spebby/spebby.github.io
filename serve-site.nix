{ pkgs }:
pkgs.writeShellApplication {
  name = "serve-site";
  runtimeInputs = with pkgs; [
    bash
    ruby_3_3
    rubyPackages_3_3.jekyll
    rubyPackages_3_3.jekyll-redirect-from
    rubyPackages_3_3.kramdown-parser-gfm
  ];
  text = ''
    jekyll serve
  '';
}
