# Brainana Viewer — UI restyle demos

Three visual-identity mockups for the Brainana Viewer, all in the **Refined Instrument**
direction (a deliberate cool-neutral instrument palette, one confident accent, a monospace
face for every number, crisp hairline seams). Built to compare side-by-side and pick one.

These are **throwaway design mockups** — nothing here changes the app. Modeled on the
existing design-system reference at
`brainana/docs_temp/update_instruction/design_system/`.

## View them

Open in any browser — self-contained, no build step:

```bash
# open the compare page (links all three)
xdg-open index.html        # Linux
open index.html            # macOS
```

- **`index.html`** — compare page with a live mini-preview of each variant.
- **`refined-a-slate-cyan.html`** — Variant A · Slate + Cyan
- **`refined-b-graphite-amber.html`** — Variant B · Graphite + Amber
- **`refined-c-deepspace-signal.html`** — Variant C · Deep-space + Signal

Each page has two parts: an **identity board** (color tokens, type specimen, component
recipes) and an **applied dashboard** — the real single-screen viewer layout at true
density, with a CSS/Canvas placeholder standing in for the live NiiVue brain render.

Fonts load from Google Fonts over the network (like the reference stylesheet); offline,
each falls back to a tuned system stack.

## The three variations

| Variant | Neutral ground | Accent | Type | Feel |
|---|---|---|---|---|
| **A · Slate + Cyan** | cool blue-slate, balanced | refined cyan | Archivo + JetBrains Mono | precise, calm — the elevated "reference" |
| **B · Graphite + Amber** | warm graphite, softer, gentle elevation | amber/gold | Source Sans 3 + IBM Plex Mono | warm lab instrument, easy for long sessions |
| **C · Deep-space + Signal** | near-black, high contrast, thin chrome | electric green | IBM Plex Sans + JetBrains Mono (mono-forward) | mission-console read-out, maximum focus |

All three share the throughline: neutrals biased slightly toward the accent (never flat
grey), the accent spent only on active/focus, every coordinate/id/threshold in monospace
with `tabular-nums`, and semantic colors (region gold, error red, local-green /
remote-amber source badges) kept separate from the accent.

## After you pick one

Porting into the real viewer (`../../brainana_viewer/`) is a stylesheet-level swap — the
DOM and class names in these demos already mirror the app:

1. Replace the token block + component rules in
   `brainana_viewer/viewer/src/style.css` with the chosen variant's `:root` tokens and
   recipes.
2. Move the hardcoded canvas mark colors in
   `brainana_viewer/viewer/src/ui/visualFieldPlot.ts` to match the new accent.
3. If keeping the linked font, embed it (or add it to the build) rather than relying on a
   CDN at runtime.

No changes to `dashboard.ts`, `roiLegend.ts`, or the panel modules are required — they
build the same class names these demos are styled against.
