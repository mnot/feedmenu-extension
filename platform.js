// Sets data-platform on <html> before first paint so the stylesheet can render
// the browser-native skin (no flash of the wrong skin). Loaded as a blocking
// <script> in <head>; must be an external file because the extension CSP
// forbids inline script.
//
// Detection: Safari is the only engine that reports an "Apple" vendor; Firefox
// is the only one with "Firefox" in its UA. Everything else (Chrome, Edge, and
// other Chromium browsers) falls through to the neutral Chrome skin.
(function () {
  var platform = "chrome";
  if (navigator.vendor && navigator.vendor.indexOf("Apple") !== -1) {
    platform = "safari";
  } else if (navigator.userAgent.indexOf("Firefox") !== -1) {
    platform = "firefox";
  }
  document.documentElement.setAttribute("data-platform", platform);
})();
