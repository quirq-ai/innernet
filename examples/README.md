# UI templates

Choose a starting point for your personal internet. Each template is a partial JSON
override with its own identity, local header artwork, browser icons and light/dark
palettes. Templates use the same engine and index.

| Template | Vibe | Typography | Starting theme |
| --- | --- | --- | --- |
| [atlas](atlas.ui.json) | Quiet green project atlas, compact and practical. | System sans | System |
| [folio](folio.ui.json) | Warm reading room with paper tones and burgundy accents. | Instrument Serif and Newsreader | Light |
| [relay](relay.ui.json) | Focused developer console with navy and cyan. | JetBrains Mono and Inter | Dark |
| [bloom](bloom.ui.json) | Creative garden with rose, lavender and peach. | Inter and Newsreader | System |

## Previews

These previews use the same committed public index. folio is shown in light mode,
relay in dark mode, and bloom in light mode. Each also supports the other theme.

| folio | relay | bloom |
| --- | --- | --- |
| ![folio reading room in parchment and burgundy](../docs/ui/templates/folio.png) | ![relay developer console in navy and cyan](../docs/ui/templates/relay.png) | ![bloom creative garden in rose, lavender and peach](../docs/ui/templates/bloom.png) |

## Use a template

Run from the repository root, replacing `folio` with any template name:

```bash
INNERNET_UI_CONFIG=examples/folio.ui.json pnpm dev
```

To preview the public repository index instead of your local folders:

```bash
INNERNET_UI_CONFIG=examples/folio.ui.json pnpm dev:demo
```

Choose light, dark or system with the theme control. A saved reader preference takes
precedence over a template's starting theme.

Copy a template and edit its JSON to make it yours. Objects merge with the defaults;
arrays replace them, so you can change navigation order and page sections. Keep the
`$schema` path relative to your new file. Put replacement artwork in `public/` and
point the logo and icon fields at its local URL.

Saved JSON changes appear on the next full page load. Restart the server when
switching the `INNERNET_UI_CONFIG` path. There is no need to rebuild your folder index.
For a deployment, set the same repository-relative override path at build time and
runtime so its JSON file is included in the server bundle.

These presets replace the default publisher and source links and hide the footer
credit. The public demo still identifies its actual source, github.com/quirq-ai, and
indexed project names and content keep their original identity. The default innernet
theme continues to use the approved quirq artwork.

See the [UI customization guide](../docs/ui/README.md#customization) for the supported
settings, schema and asset requirements. Run `pnpm check:ui` to validate every template
and check that its bundled artwork exists.
