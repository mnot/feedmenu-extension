# Design Context

This project has a `PRODUCT.md` at the root capturing strategic design intent
(register, users, purpose, brand personality, anti-references, design
principles, accessibility). Read it before any UI work.

Key points:

- **Register:** product (the design serves the tool, not a marketing surface).
- **Users:** curious, mainstream browser users — not feed/RSS experts. The UI
  must be self-explanatory.
- **Platform-adaptive skins:** one shared `popup.html`/`style.css` structure,
  two skins selected at runtime. Safari/macOS gets the native glass look (SF
  font, backdrop blur, Apple-blue); Chrome and Firefox get a restrained neutral
  skin. Detect via `navigator.vendor` and key CSS off a `[data-platform]`
  attribute set before first paint. Do NOT ship the glass aesthetic to
  Chrome/Firefox.
- **Anti-references:** not cluttered, not gimmicky, not over-glassy,
  not one-skin-fits-all.
- **Accessibility:** WCAG 2.1 AA contrast (verify against translucent
  backdrops), full keyboard nav, honor `prefers-reduced-motion` and
  `prefers-color-scheme`.

For design/UI tasks, use the `/impeccable` skill, which reads `PRODUCT.md`
(and `DESIGN.md` once it exists).
