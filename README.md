# RigPolice Embed

A **zero-build** WordPress Gutenberg block that embeds free [RigPolice](https://rigpolice.com) gear-test
tools — mouse, monitor, keyboard, click, and network testers — into any post or page. Pick a tool,
publish, and the widget loads in its own frame and auto-resizes to fit.

[![License: GPL v2+](https://img.shields.io/badge/License-GPL_v2+-blue.svg)](LICENSE)
![WordPress 6.3+](https://img.shields.io/badge/WordPress-6.3+-21759b.svg)
![PHP 7.4+](https://img.shields.io/badge/PHP-7.4+-777bb4.svg)
![Build: none](https://img.shields.io/badge/build-zero-brightgreen.svg)

## Features

- **30+ embeddable tools**, fetched **live** from `rigpolice.com` — a tool added on the site appears in
  the block automatically, so the plugin and the site can never drift.
- **Sensitivity-converter game-pair preset** (e.g. CS:GO → Valorant) so the embedded converter opens on
  the conversion your post covers.
- **Auto-resizing frame** — no fixed height, no inner scrollbar; the widget reports its height over
  `postMessage`.
- **nofollow-by-default** credit link, with a **dofollow** opt-in toggle.
- **No account, and nothing tracks your readers** — each test runs in the reader's own browser inside its
  own frame.
- **Zero build step** — no bundler, no npm dependencies, no `@wordpress/scripts`.

## Installation

### From a release (recommended)

1. Download the latest `rigpolice-embed.zip` from the [Releases](../../releases) page.
2. In WordPress: **Plugins → Add New → Upload Plugin**, choose the zip, **Install**, then **Activate**.
3. Edit a post or page, add the **“RigPolice Tool”** block, and pick a tool.

### Manual

Copy the `rigpolice-embed/` folder into `wp-content/plugins/` and activate it from the Plugins screen.

## How it works

The block is **dynamic**: `save()` returns `null` and `render.php` prints the self-locating `embed.js`
loader `<script>` on the server, so WordPress's KSES filter never strips it (a stored static `<script>`
would be removed for non-admin editors).

The emitted snippet carries only `data-tool` (plus an optional `data-dofollow`, and `data-from`/`data-to`
for the sensitivity converter). Everything else — the iframe dimensions, `allow` flags, and the
nofollow credit link — lives in `embed.js` on `rigpolice.com`, so the block stays tiny and never needs a
release to keep up with the site. The editor fetches the tool list from
[`/embeds.json`](https://rigpolice.com/embeds.json) and the converter games from
[`/games.json`](https://rigpolice.com/games.json) live (both send `Access-Control-Allow-Origin: *`).

## Development

Zero-build by design: plain `wp.*` globals in `index.js`, dependencies declared by hand in
`index.asset.php`. No bundler, no transpile step — edit and reload the editor.

| File | Role |
|------|------|
| `rigpolice-embed.php` | Plugin header + `register_block_type()` on `init`. |
| `block.json` | Block metadata (attributes, editor script, dynamic render). |
| `index.js` | Editor UI (tool picker, size preview, converter pair picker, dofollow toggle). |
| `index.asset.php` | Hand-written dependency manifest for `index.js` (version read from the plugin header). |
| `render.php` | Server render → the `embed.js` snippet. |
| `readme.txt` | WordPress.org-style readme. |

### Releasing

Releases are automated by `.github/workflows/release.yml` (tag-driven). To cut one:

1. Bump the version in **two** places — the `Version:` header in `rigpolice-embed.php` and `readme.txt`'s
   `Stable tag:` — and add a `readme.txt` changelog entry. (`block.json` has no `version`; `index.asset.php`
   reads it from the header, so both stay in sync automatically.)
2. Commit, then push a matching tag:

   ```bash
   git tag v1.3.0 && git push origin v1.3.0
   ```

The workflow verifies those two versions equal the tag (fails loud on any mismatch), packages the zip
(plugin at `rigpolice-embed/rigpolice-embed.php` inside), and publishes a GitHub Release with it. For a
one-off local test build, `zip -r rigpolice-embed.zip rigpolice-embed` from a clean checkout still works.

## Links

- Embed hub & tool catalog: <https://rigpolice.com/embed-tools/>
- For video creators: <https://rigpolice.com/for-creators/>

## License

[GPL-2.0-or-later](LICENSE). © RigPolice.
