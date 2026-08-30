# Kanakku — design rules

Written down so the app doesn't drift back into invented values. Anyone
working on this, human or agent, picks from these rather than making up a new
number. Adding a value is allowed; adding it *silently* is what causes the
generic, assembled-by-accident look.

An audit before this file existed found **27 different easing curves, 58
durations and 25 corner radii** in one stylesheet. That is what "vibecoded"
looks like from the inside.

---

## Colour

Never hard-code a colour. Every palette is described by five seeds in
`lib/themes.js` — page, card, ink, accent, and a gradient trio — and every
other token is mixed from those with `color-mix`. That is why 25 themes stay
coherent without anyone hand-tuning 25 sets of borders.

| Token | Use |
|---|---|
| `--paper` | the page behind everything |
| `--card` / `--card-2` | raised surfaces, and the recessed variant |
| `--ink` / `--ink-2` / `--ink-3` | primary text, secondary, muted |
| `--line` / `--line-2` | borders, and hairlines inside a card |
| `--brand` / `--brand-soft` | accent, and its tint for backgrounds |
| `--g1` `--g2` `--g3` | the gradient ramp, dark to light |

**These four carry meaning and must not be reused decoratively:**

- `--in` — money arriving. Green.
- `--out` — money leaving. Red.
- `--amber` — mixed or needing attention.
- `--brand` — interactive and selected states.

If a chart needs a fifth colour, derive it from `--g1…--g3`. Never introduce a
green that isn't `--in`.

Tokens are applied inline on `<html>` by `applyTheme()`. That is deliberate:
an inline style outranks any stylesheet rule, so a late `:root` block can't
silently override the theme. It has happened once already and broke dark mode
entirely.

## Motion

Six curves, six durations. Pick the intent, not a number.

| Curve | For |
|---|---|
| `--ease-settle` | the default; something decelerating into place |
| `--ease-glide` | softer, for large surfaces and sheets |
| `--ease-spring` | a small overshoot; things that arrive |
| `--ease-pop` | a bigger overshoot; badges, confirmations |
| `--ease-in-out` | symmetric movement, loops |
| `--ease-morph` | an element changing shape |

| Duration | For |
|---|---|
| `--t-instant` 80ms | press and hover feedback |
| `--t-quick` 120ms | toggles, chips, tabs |
| `--t-base` 180ms | the default for small elements |
| `--t-mid` 260ms | dropdowns, reveals, toasts |
| `--t-slow` 340ms | sheets, cards expanding |
| `--t-slower` 460ms | screen-level movement |

Rules that aren't negotiable:

- Animate `transform` and `opacity`. Animating `width`, `height`, `top` or
  `left` costs layout on every frame.
- Every animation needs a `prefers-reduced-motion` escape. No exceptions.
- Decorative loops pause during navigation — see `html.switching`. Ambient
  animation running under a screen transition is where dropped frames come
  from.
- `backdrop-filter` is expensive on a fixed element over a scrolling page.
  Measured cost on the nav bar: frames rendered during a tab change more than
  doubled when it was removed.

## Shape

`--r-xs` 6 · `--r-sm` 10 · `--r-md` 14 · `--r-lg` 18 · `--r-xl` 22 ·
`--r-2xl` 28 · `--r-round` 999px

Roughly: controls take `sm`, cards `lg`, sheets and the nav `2xl`.

## Type

Three families, each with a job:

- **Bricolage Grotesque** — headings and the wordmark only.
- **Figtree** — all body text and labels.
- **IBM Plex Mono** — every number, without exception.

Money is always mono. It is what makes columns of amounts line up and read as
data rather than prose. Uppercase mono labels take `letter-spacing: .11em`;
below about 10px they are unreadable without it.

## Layout

- One layout at every width. This is a phone app; there is no desktop variant.
- 18px page gutter. The nav is fixed, so scrollable areas need
  `padding-bottom: calc(150px + env(safe-area-inset-bottom))`.
- Respect `env(safe-area-inset-*)`. The gradient on Home deliberately bleeds
  past the top inset.

## Interaction

- Everything tappable is at least 34px, and responds within `--t-instant`.
- Press feedback is `scale(.95)` or thereabouts — enough to feel, not enough
  to notice.
- Destructive actions confirm, and the confirmation names what will be lost.
- Anything that can fail says what failed. "Could not read it: {reason}",
  never a bare "Error".

## Before shipping a change

1. `node /tmp/undef.mjs` — every JSX tag is imported or defined. This has
   caught a crash-on-load twice.
2. `npx next build` — compiles.
3. Check both themes. A `:root` block appended after the dark block silently
   disables dark mode.
4. Check at 390px and 380px. Seven nav tabs and a wide balance both overflow
   before you expect them to.
