# Feed Menu Browser Extension

A browser extension that displays a curated list of feeds available on a website, as defined in [draft-nottingham-feed-menu](https://datatracker.ietf.org/doc/draft-nottingham-feed-menu).

## Installation

This project uses a `Makefile` to manage builds for different browsers.

### Safari
To generate the Safari Web Extension Xcode project:
```bash
make safari
```
Then, open the generated `build/safari/Feed Menu/Feed Menu.xcodeproj` and build in Xcode.

### Firefox
To package the Firefox version:
```bash
make firefox
```
The build will be available in `build/firefox/`. Load it via `about:debugging`.

### Chrome
1.  Open `chrome://extensions/` in your browser.
2.  Enable **Developer Mode** (top right).
3.  Click **Load Unpacked**.
4.  Select this project directory.


---

## Notes

- **CORS & CSP Security**: The extension performs the fetch from the **Page Context** (Same-Origin) via script injection. This means the server at `/.well-known/` does **not** need `Access-Control-Allow-Origin` headers.
- **CSP Compatibility**: Most sites allow same-origin fetches in their Content Security Policy. If a site specifically blocks `'self'` in `connect-src`, the fetch may fail, but this is rare for public feed menus.

## Privacy Disclosure
This extension uses the `activeTab` and `scripting` permissions. 
- It **cannot** see which websites you visit in the background.
- It **cannot** read your cookies or form data.
- It only runs the fetch script for the duration of the "click" event.
- It requires **no permanent host permissions** to function.
