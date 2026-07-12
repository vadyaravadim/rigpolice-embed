---
paths:
  - 'render.php'
  - 'rigpolice-embed.php'
  - 'index.asset.php'
  - '.wp-env/**'
---

# RigPolice Embed — PHP (render.php / plugin entry)

- **Comments a MACHINE reads — never delete these, they are not prose.** The `/** Plugin Name: ... Version: ... Text Domain: ... */` header in `rigpolice-embed.php` (WordPress parses it to see the plugin at all, and `get_file_data()` reads `Version` back from it); the `// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped` / `// phpcs:enable` pair around the `printf` in `render.php` (the Plugin Check CI job reads them); the file-level `@package` docblock in every PHP file (WPCS / Plugin Check require it). Any `/* translators: */` comment added later is likewise load-bearing — the i18n extractor pulls it into the `.pot`.

- **`if ( ! defined( 'ABSPATH' ) ) { exit; }` tops every PHP file** — including `render.php`, `index.asset.php` and the dev mu-plugin. Blocks direct HTTP access to the file. Keep it in any new PHP file.

- **The block is DYNAMIC on purpose.** `save()` returns `null`; `render.php` emits the `embed.js` `<script>` server-side, so WP's KSES never strips it. A static `save()` output carrying a `<script>` would be filtered away for non-admin editors. Do not "simplify" this into a static save.

- **`wp_get_script_tag()` does ALL the escaping** — `esc_url` on `src`, `esc_attr` on every other attribute, boolean attributes emitted name-only. So the array passed to it needs no manual escaping, and the output carries no literal `<script>` string for KSES to touch. Author-controlled values (`tool`, `anchor`, `from`, `to`) cannot break out of their attribute.

- **WPCS does not know `wp_get_script_tag()` or `get_block_wrapper_attributes()` are escaping functions**, so the single `printf` in `render.php` is wrapped in `phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped` / `phpcs:enable`. Both outputs are already WP-escaped; the suppression is a WPCS blind spot, not a real bypass.

- **The loader is rendered per block, NOT `wp_enqueue_script()`'d** — it is a third-party loader carrying block-specific `data-*` attributes, so each block instance needs its own tag.

- **Cross-repo wire contract: the `data-*` set `embed.js` on rigpolice.com reads.** Changing any of these breaks the widget without touching this repo's tests unless you also update `.github/render-contract.php` (which pins it by running the real `render.php` through `do_blocks()` in CI, on the WP 6.3 floor and the current release):
  - `src="https://rigpolice.com/embed.js"` + `async`. The loader is self-locating: it derives the origin for the iframe + brand link from its own `<script src>`.
  - `data-tool` — the slug. `render.php` never validates it; it goes straight through. An empty `tool` returns `''`: no wrapper div, no loader with an empty `data-tool`.
  - `data-anchor` — **ALWAYS emitted, even when empty.** `embed.js` reads it with no fallback (iframe title, and the credit-link text when shown). Do NOT wrap it in an `if ( '' !== $anchor )`; an empty anchor is reachable (a tool dropped from `/embeds.json` has no row to bake one from).
  - `data-from` / `data-to` — the converter game pair, emitted **only when both are set AND differ**, mirroring `embed.js`'s own guard. A stray or half pair desyncs the block from the loader.
  - `data-width` — optional integer px, only when `> 0`. `embed.js` caps the frame's max-width; height stays auto. Absent means "use the tool's default width", so it must not be emitted when unset.
  - `data-nocredit` — emitted when `showcredit` is falsy, i.e. the host-DOM credit link is **OFF by default**. WP.org Guideline 10 requires credit links to be opt-in; dropping this attribute ships an unsolicited credit link and is a guideline violation, not a cosmetic bug. The tool's own in-frame attribution still credits RigPolice.
  - Dimensions, iframe `allow` flags, and the brand link's `rel` are owned by `embed.js`'s registry — never re-declare them here.

- **`rigpolice-embed.php` filters `block_type_metadata` to inject the plugin version into `rigpolice/embed`.** Without it `block.json` carries no `version`, `register_block_style_handle()` registers `editor.css` with `ver=false`, and `WP_Styles` falls back to the *WordPress* version — so the stylesheet URL does not change when the PLUGIN updates and browsers/CDNs keep serving stale CSS (while `index.js` gets the plugin version from `index.asset.php` and updates, i.e. new script against old CSS). Read the version BACK from the header with `get_file_data()`; do NOT add a `version` key to `block.json` — nothing verifies a third copy, so it would silently drift.

- **`index.asset.php` is a hand-written asset manifest (no build step).** WP reads it alongside `index.js` (`block.json` `editorScript: file:./index.js`) and enqueues the declared deps (`wp-blocks`, `wp-element`, `wp-block-editor`, `wp-components`, `wp-i18n`) first, so `window.wp.*` exists before `index.js` runs. Its `version` (read from the plugin header) is what drives the editor asset's `?ver=`. Use a new `wp.*` global in `index.js` → add its package to this deps array.

- **`.wp-env/rigpolice-embed-dev.php` is DEV-ONLY and no-ops unless `RIGPOLICE_EMBED_DEV_ORIGIN` is defined** (set it in the gitignored `.wp-env.override.json` `config`). Unset = the block hits PRODUCTION `rigpolice.com`, plugin untouched. The file never ships (`/.wp-env` is `export-ignore`d in `.gitattributes`, so both the `git archive` zip and the WP.org SVN trunk drop it). It repoints two things: (1) front end — a `render_block` filter `str_replace`s the prod origin in the rendered `<script src>` (the self-locating loader then pulls the iframe + brand link from the local build too); (2) editor — `wp_add_inline_script( 'wp-blocks', ..., 'before' )` on `enqueue_block_editor_assets` shims `window.fetch` so `index.js`'s hardcoded `/embeds.json` + `/games.json` reads hit the dev origin. It must attach `before` a declared dependency of `index.js` (hence `wp-blocks`) to land ahead of it.
