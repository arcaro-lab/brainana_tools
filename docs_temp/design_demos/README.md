# Brainana Viewer — UI direction: Graphite + Amber

The viewer's visual identity is **Refined Instrument · Graphite + Amber** — a deliberate warm-neutral
instrument palette, one confident amber accent (spent only on active/focus), a humanist UI face
(Source Sans 3) with a monospace face (IBM Plex Mono) for every number, and crisp hairline seams.

This was chosen from three explored variations (Slate + Cyan, Graphite + Amber, Deep-space + Signal);
**Graphite + Amber won and the other two were dropped.** The direction is **shipped** in the real app —
this folder is kept only as the living reference.

## View it

Open in any browser — self-contained, no build step:

```bash
xdg-open index.html        # Linux
open index.html            # macOS
```

- **`index.html`** — one-page summary of the chosen identity, linking the reference.
- **`refined-b-graphite-amber.html`** — the reference: an **identity board** (color tokens, type
  specimen, component recipes) plus an **applied dashboard** at true density, with a CSS/Canvas
  placeholder standing in for the live NiiVue brain render.

Fonts load from Google Fonts over the network; offline, each falls back to a tuned system stack.

## Where it lives in the app

The identity is fully ported and has since grown into a proper design system:

- `viewer/src/style.css` — the `:root` token block now carries a full **spacing / radius / type /
  semantic-color / motion** scale (not just raw palette values), plus crafted range sliders, one unified
  "active/selected" language across every button and chip, and styled recipes for the colormap picker,
  range control, and colorbar.
- `viewer/src/ui/visualFieldPlot.ts` — the retinotopy plot's canvas colors and font read the same theme
  tokens (no hardcoded literals).

The throughline: neutrals biased slightly toward the accent (never flat grey), the accent spent only on
active/focus, every coordinate/id/threshold in monospace with `tabular-nums`, and semantic colors
(region gold `--gold`, error red `--danger`, local-green `--ok` / remote-amber `--warn` source badges)
kept separate from the accent.
