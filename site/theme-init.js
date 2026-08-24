// Applies the saved theme before first paint. "system" (or no saved value)
// leaves the attribute off so prefers-color-scheme decides.
(function () {
  try {
    var t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) { /* storage unavailable — system theme applies */ }
})();
