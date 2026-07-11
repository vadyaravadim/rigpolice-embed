# RigPolice Embed (WordPress Gutenberg block)

A dynamic block that lets any WordPress author drop a free RigPolice gear-test tool
(mouse / keyboard / monitor / CPS / sensitivity converter) into a post. The widget loads in its own
iframe from `rigpolice.com` and auto-resizes.

**Decoupled from the RigPolice site on purpose.** Zero-build (plain `wp.*` globals, hand-written
`index.asset.php`, NO `@wordpress/scripts`, NO npm deps). It loads `embed.js` by absolute URL and depends
on nothing from the site codebase, so it ships and versions independently. It reads two public catalogs
live in the editor to fill its pickers: `rigpolice.com/embeds.json` (tools) + `rigpolice.com/games.json`
(converter games), both served with CORS.

**Dynamic block** (`save()` returns `null`): `render.php` emits the `embed.js <script>` server-side so
WP's KSES never strips it (a static `save()` output would be filtered for non-admin editors). The editor
(`index.js`) fetches the two catalogs live to fill the tool + game pickers.

## Release workflow — branch → merge → tag

Work on a feature branch (e.g. `release/x.y.z`), merge into `main` (`--no-ff` keeps the release legible),
then tag `vX.Y.Z` and push the tag. Prod deploy is driven by the **tag** (`release.yml`:
`on: push: tags: v*`), not by pushing to `main`, so the tag is what ships a release.

- **Version lives as a literal in exactly two spots** and both must equal the tag (minus the leading `v`):
  the plugin header `Version:` in `rigpolice-embed.php` and readme.txt's `Stable tag:`. `release.yml`
  fails loud on a mismatch (`block.json` omits `version`; `index.asset.php` derives it from the header, so
  those can't skew). Bump both + add a changelog entry before tagging.
- **Readme tags + short description are read from the Stable-tag version dir** (`/tags/<stable>/`), so
  shipping a metadata-only change still requires a version bump + release, not a trunk-only edit.
- Deploy: `release.yml` runs two parallel jobs on the tag — a GitHub Release, and a WordPress.org SVN
  deploy via `10up/action-wordpress-plugin-deploy` (syncs trunk scoped by `.gitattributes export-ignore`,
  copies `.wordpress-org/*` into SVN `assets/`, tags `tags/<version>`). Requires repo secrets
  `SVN_USERNAME` + `SVN_PASSWORD` (the WordPress.org SVN password, not the account password).
- **The GitHub zip is packaged with `git archive`, NOT `rsync` — keep it that way.** `.gitattributes`
  `export-ignore` is the ONE list scoping what ships, and only `git archive` (the zip) and the 10up action
  (the SVN trunk) honor it, which is what makes the two artifacts the identical set. An `rsync -a
  --exclude='.*'` only drops DOTfiles, so it silently ships export-ignored non-dotfiles (`CLAUDE.md`,
  `README.md`) in the GitHub zip while WP.org drops them — the artifacts drift and the invariant the
  comments promise quietly becomes false.

## Live Preview (WordPress.org Playground demo)

The plugin's directory page has a **Live Preview** (Playground) demo, enabled by a `blueprint.json`.

- **Location:** `.wordpress-org/blueprints/blueprint.json`. The 10up deploy action mirrors
  `.wordpress-org/*` into SVN `assets/`, so it lands at `assets/blueprints/blueprint.json` — the exact
  path Live Preview reads. It ships ONLY via a tagged release (assets sync runs in `release.yml`), not a
  trunk edit. Verify live at
  `https://plugins.svn.wordpress.org/rigpolice-embed/assets/blueprints/blueprint.json`; WordPress.org
  serves it to the preview via `.../wp-json/plugins/v1/plugin/rigpolice-embed/blueprint.json`.
- **Must include its OWN `installPlugin` as step 1.** WordPress.org auto-appends an install step for the
  current plugin ONLY if the author omits one — and it appends to the END, so a `runPHP` that creates a
  demo post would run BEFORE the plugin is active. Put
  `{ step:"installPlugin", pluginData:{ resource:"wordpress.org/plugins", slug:"rigpolice-embed" }, options:{ activate:true } }`
  first; then WordPress.org appends nothing and the order is the documented `installPlugin -> runPHP`.
- **`meta.author` is REQUIRED** by the blueprint schema (validation gate on WordPress.org); set it to the
  committer username. "Missing or invalid blueprint.json" on the Advanced View means the file failed
  schema validation or hasn't reindexed yet.
- **`wp_insert_post` gotcha:** `array('ID' => 4, ...)` makes WP treat the call as an UPDATE of post 4; on a
  fresh Playground there is no post 4, so it returns `0` and creates nothing (then `landingPage:"/?p=4"` is
  a 404). Use `'import_id' => 4` to create a new post with a fixed id.
- **runPHP path:** load WordPress by the ABSOLUTE `/wordpress/wp-load.php`. Playground moved the cwd to
  `/wordpress` and only rewrites the old relative `wordpress/wp-load.php` with a deprecation warning
  (removal is coming).
- **Enabling the preview is a MANUAL, committer-only step** in the plugin's Advanced View on
  WordPress.org (Toggle Live Preview → public). No git push flips it; deploy only delivers the blueprint
  file.

### Verify a blueprint change LOCALLY, not in prod

Debugging a blueprint by pushing a tag and clicking the live preview is slow (tag → CI → SVN →
WordPress.org REST reindex per attempt) and burns a version each time. **headless Chrome does NOT work for
Playground**: the browser Playground boots PHP-WASM in a Web Worker needing cross-origin isolation that
`--headless=new` can't provide (it hangs on "Preparing WordPress..." or dies with
`WebWorker failed to load`). Use the Node CLI engine (same PHP-WASM, no browser):

```
npx --yes @wp-playground/cli@<ver> run-blueprint \
  --blueprint=<test-blueprint.json> \
  --mount-before-install=<local-plugin-dir>:/wordpress/wp-content/plugins/rigpolice-embed \
  --mount=<host-out-dir>:/out \
  --verbosity=quiet
```

- Build the TEST blueprint from the REAL file, swapping its `installPlugin` (resource
  `wordpress.org/plugins`, which the CLI can't fetch for an UNRELEASED plugin) for a local
  `{ step:"activatePlugin", pluginPath:"rigpolice-embed/rigpolice-embed.php" }`; mount the plugin source
  with `--mount-before-install`. Do NOT edit the runPHP itself.
- `runPHP` `echo` is NOT surfaced to stdout by `run-blueprint`. Have the PHP
  `file_put_contents('/out/result.txt', ...)` into a `--mount`ed host dir, then read it on the host.
- Assert the real goal: `get_post(4)` created, then `do_blocks($post->post_content)` actually renders the
  `embed.js <script>` with the right `data-tool`. Dump the raw rendered HTML too — a hand-rolled
  `substr_count('<p>')` false-alarms 0 because WP renders `<p class="wp-block-paragraph">`.
- Get a RED local repro first (e.g. `INSERT_RESULT=0`, `POST_4_EXISTS=no`), apply the fix, get GREEN
  locally, THEN release.

## Local dev stand (wp-env) — for e2e testing the block

`npx @wordpress/env start` boots WP on `localhost:9400` (admin/password) with the plugin mounted live from
the working tree, so editor edits show up on reload with no build step. Drive the real editor with
`wp.data` (`insertBlock` / `updateBlockAttributes`) rather than clicking the inserter, and create
front-end fixtures with `wp post create --post_content='<!-- wp:rigpolice/embed {...} /-->'` — far faster
and more precise than driving the UI for every permutation. Both catalogs are CORS-open, so the editor's
pickers work against PROD `rigpolice.com` out of the box; the dev mu-plugin no-ops unless
`RIGPOLICE_EMBED_DEV_ORIGIN` is set.

- **`mappings` maps the `.wp-env` DIR onto `mu-plugins`, not the single file — do NOT "tidy" it back to a
  file map.** Docker Desktop on macOS (virtiofs) fails to bind-mount an INDIVIDUAL file into a container
  path that doesn't exist yet, and `wp-env start` dies with
  `mountpoint ... is outside of rootfs`. A directory map mounts reliably; `.wp-env/` holds only the dev
  mu-plugin, so nothing extra leaks into `mu-plugins/`.
- Assert `render.php`'s real output server-side (`wp eval 'echo do_blocks(get_post(N)->post_content);'`)
  instead of eyeballing the page — it shows the exact `data-*` set, and `wp_get_script_tag()` escapes every
  attribute (`esc_attr`), so injected quotes in `tool`/`anchor`/`from` cannot break out.

## Tools that are intentionally NOT embeddable

`system-info`, `webcam-test`, `microphone-test`, `spatial-audio-test` are deliberately excluded from the
embeddable set. They require `allow="camera"` / `allow="microphone"` on the iframe; most browsers block
cross-origin permission prompts inside iframes, and an unexpected camera/mic dialog from an embedded
widget is alarming or silently fails. Do NOT add them without reconsidering that UX trade-off.
