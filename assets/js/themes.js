// Theme manager
// Theme manager
(function () {
  "use strict";

  var THEME_FILE = "/assets/data/themes.txt";
  var STORAGE_KEY = "tui-theme";

  var themes = [];
  var currentIndex = 0;

  /* Parse a simple Base16 theme file:
   *
   * [theme name]
   * base00 #1a1b26
   * base01 #16161e
   * ...
   * base0F #db4b4b
   *
   * Comments begin with # on their own line.
   */
  function parseThemes(text) {
    var result = [];
    var current = null;

    text.split(/\r?\n/).forEach(function (rawLine) {
      var line = rawLine.trim();

      // Ignore blank lines and comments.
      if (!line || line.charAt(0) === "#") {
        return;
      }

      // [Theme Name]
      var section = line.match(/^\[(.+)\]$/);

      if (section) {
        current = {
          name: section[1].trim(),
        };

        result.push(current);
        return;
      }

      /*
       * Accept:
       *
       * base00 #112233
       * base0A #112233
       * base0f #112233
       *
       * color0 #112233
       * color9 #112233
       * color10 #112233
       * color15 #112233
       *
       * Also accepts = or : as separators.
       */
      var color = line.match(
        /^(base(0[0-9a-f]|1[0-5])|color(1[0-5]|[0-9]))\s*(?:=|:|\s)\s*(#[0-9a-f]{6})$/i,
      );

      if (!color || !current) {
        return;
      }

      var index;

      if (color[2] !== undefined) {
        // base00 ... base0F
        index = parseInt(color[2], 16);
      } else {
        // color0 ... color15
        index = parseInt(color[3], 10);
      }

      var key = "base" + index.toString(16).padStart(2, "0");

      current[key] = color[4].toLowerCase();
    });

    return result;
  }

  function isValidTheme(theme) {
    for (var i = 0; i <= 15; i++) {
      var key = "base" + i.toString(16).padStart(2, "0");

      if (!theme[key]) {
        return false;
      }
    }

    return true;
  }

  function applyTheme(theme) {
    var root = document.documentElement.style;

    for (var i = 0; i <= 15; i++) {
      var hex = i.toString(16).toUpperCase();
      var key = "base" + (i < 10 ? "0" + i : hex);
      var value = theme[key.toLowerCase()];

      root.setProperty("--" + key, value);
    }

    var button = document.getElementById("themeBtn");
    if (button) {
      button.textContent = "theme: " + theme.name;
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme.name);
    } catch (e) {
      // localStorage may be unavailable; theme still works.
    }
  }

  function loadSavedTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) return;

      for (var i = 0; i < themes.length; i++) {
        if (themes[i].name === saved) {
          currentIndex = i;
          return;
        }
      }
    } catch (e) {
      // Ignore localStorage errors.
    }
  }

  function nextTheme() {
    if (!themes.length) return;

    currentIndex = (currentIndex + 1) % themes.length;
    applyTheme(themes[currentIndex]);
  }

  function init() {
    fetch(THEME_FILE)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(
            "Failed to load themes.txt (" + response.status + ")",
          );
        }

        return response.text();
      })
      .then(function (text) {
        themes = parseThemes(text);
        themes = themes.filter(isValidTheme);

        if (!themes.length) {
          throw new Error("No valid Base16 themes found.");
        }

        loadSavedTheme();
        applyTheme(themes[currentIndex]);

        var button = document.getElementById("themeBtn");

        if (button) {
          button.addEventListener("click", nextTheme);
        }
      })
      .catch(function (error) {
        console.error("Theme manager:", error);
      });
  }

  /*
   * Wait until the DOM exists because themeBtn may not exist
   * when this script executes.
   */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
