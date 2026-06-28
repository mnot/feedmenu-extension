# Product

## Register

product

## Users

Curious, mainstream browser users — not necessarily feed/RSS experts. They land
on a site, wonder "does this have a feed I can follow?", and click the toolbar
icon to find out. Their context is a quick, in-the-moment check inside a small
popup, often without prior knowledge of what a "feed" even is. The design must
be self-explanatory: the popup, onboarding, and empty states carry the
explanation so a newcomer is never stranded. Power users (existing RSS readers)
are served too, but they are not the primary audience to optimize for.

The job to be done: *"Show me the feeds this site offers, and let me open or
subscribe to one with a single click."*

## Product Purpose

A cross-browser (Chrome / Firefox / Safari, Manifest V3) extension that surfaces
a site's available feeds from `/.well-known/feed-menu.json`, implementing
[draft-nottingham-feed-menu](https://datatracker.ietf.org/doc/draft-nottingham-feed-menu).
It can also auto-discover feeds (opt-in permission) and highlight the toolbar
icon when a site offers them.

Success looks like: a newcomer clicks the icon, immediately understands what
they're seeing, and gets to a feed (or a clear "none here") in one glance — with
zero feed-format jargon required.

## Brand Personality

Quiet, trustworthy, utilitarian. A well-made native tool that gets out of the
way. Three words: **calm, clear, dependable.** It should feel like part of the
browser, not a branded app demanding attention — native *to each platform*
rather than carrying one identity everywhere. On Safari/macOS, "native" means
the platform's own look (SF system font, translucent glass, Apple-blue); on
Chrome and Firefox it means a restrained, neutral treatment that blends into
those browsers. One structure, platform-selected skins (see Design Principles).

## Anti-references

- **Not cluttered or heavy.** No dense, busy, enterprise-extension chrome.
  Minimal and quiet wins.
- **Not gimmicky.** No mascots, no heavy gradients, no novelty animation. It is
  a utility people trust with their browsing.
- **Not over-glassy.** Decorative blur-for-its-own-sake is out. (The current
  implementation leans hard into Apple/macOS glassmorphism; the intended
  direction is more restrained and platform-neutral — glass only where it
  genuinely earns its place.)
- **Not one-skin-fits-all.** Do not ship the Apple/macOS glass aesthetic to
  Chrome and Firefox, where it reads as a foreign Mac transplant. The glass look
  is correct *on Safari only*; the other browsers get the neutral skin.

## Design Principles

1. **Self-explanatory by default.** A first-time, non-technical user should
   understand the popup without a tutorial. Empty states and onboarding do the
   teaching; the main view stays uncluttered.
2. **Native to each platform, not branded.** Blend into the *host* browser's
   chrome. One shared structure with platform-selected skins: Safari gets the
   macOS glass look; Chrome/Firefox get a restrained neutral skin. Detect the
   platform at runtime (`navigator.vendor`) and key styling off a
   `[data-platform]` attribute set before first paint. Restraint over identity —
   the extension earns trust by feeling like it belongs.
3. **One glance, one click.** Optimize for the speed of the core task: see the
   feeds, act on one. Nothing competes with that.
4. **Earn every effect.** Blur, motion, and color are used only where they aid
   comprehension or affordance — never decoration.
5. **Honest about state.** Loading, found, empty, and error states are all
   first-class and clearly distinguished.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**: body text ≥4.5:1 contrast, large text ≥3:1, including
inside the translucent popup surfaces (verify against the actual rendered
backdrop, not the token alone). Full keyboard navigation for the feed list,
reload, and discovery toggle, with visible focus states. Honor
`prefers-reduced-motion` — provide a crossfade/instant alternative for every
animation (spinner, slide-down submenu, fade-in). Respect `prefers-color-scheme`
for light/dark, which the project already does.
