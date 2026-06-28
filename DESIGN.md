---
name: Feed Menu
description: A cross-browser extension popup that wears each browser's native skin.
colors:
  accent-chrome: "#1a73e8"
  accent-chrome-text: "#1967d2"
  accent-firefox: "#0060df"
  accent-safari: "#007aff"
  accent-safari-text: "#0067d6"
  ink: "#202124"
  muted: "#5f6368"
  bg: "#ffffff"
  surface: "#ffffff"
  surface-hover: "#f1f3f4"
  settings-bg: "#f8f9fa"
  border: "#dadce0"
  error: "#c5221f"
typography:
  title:
    fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  meta:
    fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.5px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  feed-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  feed-item-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.accent-chrome-text}"
  menu-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  reload-button:
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "6px"
  switch-on:
    backgroundColor: "{colors.accent-chrome}"
    rounded: "22px"
    width: "38px"
    height: "22px"
  error-state:
    textColor: "{colors.error}"
    typography: "{typography.body}"
---

# Design System: Feed Menu

## 1. Overview

**Creative North Star: "One Voice, Three Dialects"**

Feed Menu is a single popup structure that speaks three browser-native dialects. The markup, the spacing rhythm, the component vocabulary, and the interaction model are shared and constant; only a set of semantic design tokens swaps at runtime, keyed off a `[data-platform]` attribute set before first paint. On Safari it speaks macOS glass (translucent surfaces, backdrop blur, the SF system font, Apple blue). On Chrome it speaks Material-flat (opaque surfaces, hairline borders, a subtle elevation on hover, Google blue). On Firefox it speaks Photon (flatter still, tighter 4px corners, borders carrying all the depth, Firefox blue). The user never sees a "brand" — they see something that looks like it shipped with their browser.

This is a **product** system, not a brand surface: the design serves a 30-second task inside a 320px panel and then disappears. Density is moderate, hierarchy is quiet, and color is reserved for action and state. The whole thing is built to be self-explanatory to a mainstream user who may not know what a "feed" even is — so empty, loading, and error states are first-class, and nothing decorative competes with the list of feeds.

It explicitly rejects the things that make extension popups feel cheap or foreign: cluttered enterprise chrome, novelty animation, decorative glass on browsers that don't use glass, and any single "house style" forced onto all three browsers. The macOS glass look is correct **on Safari only**; shipping it to Chrome or Firefox would read as a transplanted Mac artifact.

**Key Characteristics:**
- One structure, three runtime-selected skins (Safari glass / Chrome Material / Firefox Photon).
- Light and dark for every skin, via `prefers-color-scheme`.
- Restrained color: one host-native accent, used only for action, selection, and state.
- Flat by default; depth comes from hairline borders, not shadow (Safari excepted).
- Self-explanatory: loading, found, empty, and error are all distinct, designed states.

## 2. Colors

A restrained, neutral palette per skin: a near-monochrome surface-and-ink base plus exactly one host-native accent. The accent is the only saturated color on screen.

### Primary
- **Host Accent** — the single accent, sourced from the host browser: **Chrome Blue** (`#1a73e8`), **Firefox Blue** (`#0060df`), or **Safari Blue** (`#007aff`). Used for the active toggle, focus rings, the loading spinner's leading arc, and feed titles on hover. Never for decoration.
- **Accent-as-Text** — a darkened variant used *only* when the accent sits on a light surface as text: **Chrome** (`#1967d2`), **Safari** (`#0067d6`). Firefox's `#0060df` already passes as text. This exists because the fill accent (notably Apple blue at ~3.9:1) fails AA as body text.

### Neutral
- **Ink** (`#202124` Chrome / `#15141a` Firefox / `#1d1d1f` Safari): primary text — titles, feed names, descriptions.
- **Muted** (`#5f6368` Chrome / `#5b5b66` Firefox / `#6e6e73` Safari): secondary text — URLs, the site hostname, helper copy. Every muted value is tuned to clear 4.5:1 on its own surface; Safari's was darkened from the original `#86868b` (which failed).
- **Surface / Background** (`#ffffff` opaque on Chrome & Firefox; translucent `rgba(255,255,255,0.72)` on Safari): the panel and the feed rows.
- **Border** (`#dadce0` Chrome / `#d7d7db` Firefox / `rgba(0,0,0,0.08)` Safari): hairline 1px dividers and row outlines. On the flat skins, this *is* the depth.
- **Settings Surface** (`#f8f9fa` Chrome / `#f9f9fb` Firefox): the slightly recessed footer band holding the discovery toggle.

### Semantic
- **Error** (`#c5221f` Chrome / `#d70022` Firefox / `#d70015` Safari): the alert glyph in the error state. The only red in the system. Dark-mode variants lighten (`#f28b82` / `#ff6a75` / `#ff453a`).

### Named Rules
**The Host-Dialect Rule.** Surface, border, accent, radius, and font are sourced from the host browser via `[data-platform]`. Never ship one browser's accent or surface treatment to another; a Google-blue toggle in Firefox is a bug.

**The AA-Text Rule.** When the accent is rendered as *text* on a light surface, use the `accent-text` token, never the fill accent. The fill accent is for backgrounds, icons, and borders.

## 3. Typography

**Font:** the host operating system's UI font, always. `-apple-system` / SF on Safari; `system-ui` (Segoe UI, Roboto, …) on Chrome and Firefox. There is no display font and no bundled webfont — the system font *is* what makes the popup feel native.

**Character:** functional and invisible. One family, three weights (400/500/600). Type carries hierarchy through size and weight only, never through a second face.

### Hierarchy
- **Title** (600, 18px, 1.2): the popup's `h1` — the feed-menu name, or "Feed Menu". One per popup.
- **Body** (500, 14px, 1.4): feed titles, the submenu toggle label, the settings row label. The workhorse.
- **Caption** (400, 12px, 1.4): feed descriptions. Wraps; `overflow-wrap: break-word`.
- **Meta** (400, 11px, 1.3): feed URLs and the site hostname. Single-line, ellipsis-truncated.
- **Label** (600, 10px, +0.5px, uppercase): the transient "Opening in Reader…" status badge. The only uppercase text in the system; reserved for ephemeral status.

### Named Rules
**The System-Font Rule.** Always the host's system font; never a bundled or web-loaded typeface. The font is part of the native disguise.

## 4. Elevation

Flat by default. On Chrome and Firefox, surfaces are flat at rest and depth is read from 1px hairline borders and a faintly recessed settings band — not from shadow. Shadow appears only as a *response to state*: a feed row lifts on hover (Chrome only; Firefox stays flat and darkens its border instead). Safari is the one exception to flatness: it uses real translucency (`backdrop-filter: blur(20px) saturate(180%)`) and a soft ambient hover shadow, because that *is* the native macOS material.

### Shadow Vocabulary
- **Hover Lift — Chrome** (`box-shadow: 0 1px 2px rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)`): Material elevation on a hovered feed row.
- **Hover Lift — Safari** (`box-shadow: 0 4px 16px rgba(0,0,0,.12)`): soft ambient glow under a hovered row on glass.
- **Firefox** — none. Hover shifts the border color (`#d7d7db` → `#b1b1b9`); the surface never lifts.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow is a state response (hover), never an ambient decoration. If a skin is flat (Firefox), it stays flat — express hover through border and background, not elevation.

**The Glass-Is-Safari-Only Rule.** `backdrop-filter` and translucent surfaces appear on Safari and nowhere else. On Chrome and Firefox, every surface is opaque.

## 5. Components

Every interactive element shares one shape language (the skin's `--radius`) and one accent. All affordances are reachable by mouse, keyboard, and touch alike.

### Buttons
- **Shape:** the skin radius — 8px (Chrome), 4px (Firefox), 10px (Safari).
- **Reload (icon button):** a muted 14px refresh glyph, padding 6px. Hover fills with `surface-hover` and shifts to `ink`. Spins (`spin 1s linear`) while loading and is `disabled` during a fetch. Focus shows a 2px accent outline, offset 2px.
- **Submenu toggle:** a full-width `<button>` (not a div) carrying the menu label and a chevron. Click toggles `aria-expanded` and an `.open` class; the chevron rotates 90°. Hover tints the label with `accent-text`.

### Feed Row (signature component)
- **Corner Style:** skin radius.
- **Background:** `surface`, 1px `border`.
- **Hover:** background → `surface-hover`, border → `border-hover`, title → `accent-text`, plus the skin's Hover Lift shadow (Chrome/Safari) or border darkening (Firefox).
- **Focus:** `:focus-within` shifts the border to the accent; the inner link shows a 2px accent outline (inset).
- **Internal Padding:** 10px 12px. Rows hold a 14px title, an optional 12px description, and an 11px truncated URL.

### Toggle Switch
- **Track:** 38×22px pill, `border` background at rest, 1px border. **On:** fills with the host accent. The 16px white knob translates 16px on check. Focus shows a 2px accent outline. Transitions are 220ms.

### Status States
- **Loading:** a 22px ring spinner (border `border`, top arc `accent`) above "Searching for feeds…", centered. `role="status"`, `aria-live="polite"`.
- **Error:** a 24px `error`-colored alert glyph above the message, centered. `role="alert"`. Visually distinct from loading — no spinner — so a failure never reads as a stalled load.
- **Empty:** centered "No feed menu found on this site." with an 11px muted "Checked /.well-known/feed-menu.json".

### Named Rules
**The No-Hover-Only Rule.** No affordance may depend on `:hover`. Submenus open on click/keyboard; hover is enhancement only. (The previous hover-only submenu was unreachable by keyboard — forbidden.)

**The Honest-State Rule.** Loading, found, empty, and error are four visually distinct states. An error must never reuse the loading slot.

## 6. Do's and Don'ts

### Do:
- **Do** source every visible token (accent, surface, border, radius, font) from the host browser via `[data-platform]`. Make a Firefox build look like Firefox.
- **Do** keep surfaces flat by default; let 1px hairline borders carry structure. Shadow is a hover response only.
- **Do** use the host system font, always.
- **Do** use the darker `accent-text` token whenever the accent is text on a light surface.
- **Do** keep all four states (loading / found / empty / error) visually distinct, and keep every affordance keyboard-reachable.
- **Do** honor `prefers-color-scheme` and `prefers-reduced-motion` in every skin.

### Don't:
- **Don't** be cluttered or heavy. No dense, busy, enterprise-extension chrome. *(PRODUCT.md: "Not cluttered or heavy.")*
- **Don't** be gimmicky. No mascots, no heavy gradients, no novelty animation. *(PRODUCT.md: "Not gimmicky.")*
- **Don't** be over-glassy. `backdrop-filter` is Safari-only; decorative blur is forbidden. *(PRODUCT.md: "Not over-glassy.")*
- **Don't** ship one skin to all browsers. The macOS glass look on Chrome or Firefox reads as a foreign Mac transplant. *(PRODUCT.md: "Not one-skin-fits-all.")*
- **Don't** use the fill accent as body text (Apple blue `#007aff` is ~3.9:1 — fails AA).
- **Don't** use `border-left`/`border-right` greater than 1px as a colored accent stripe. Full hairline borders only.
- **Don't** gate any function on `:hover`. If it only works on hover, it's broken for keyboard and touch.
- **Don't** let an error state look like a stalled load. Distinct glyph, distinct color, no spinner.
