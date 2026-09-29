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

## Core principle — the code carries no comments

**Where does an invariant live so it reaches whoever is about to break it?** Not in a `//` beside the
code. It goes into `.claude/rules/*.md` (path-scoped, auto-loaded when a matching file is read) or into
this file. The knowledge is not deleted, it is RELOCATED to where it is read.

Why, and it is not taste: a comment is seen only if an agent happens to open that exact line, while a
path-scoped rule enters its context BEFORE the edit. A comment also rots silently — the code moves, the
comment keeps describing the old shape, and nothing turns red. A rule is ONE place, so a stale one is
findable and fixable once.

**The rule: code contains NO comments,** enforced by the `no-comments` CI job — three real parsers, and
still **zero dependencies** (the repo has no `package.json` and must not get one):

- **JS** (`index.js`, `.github/*.mjs`) — `npx --yes eslint@10 .` against `eslint.config.mjs`, which
  imports nothing and defines the rule inline. `--fix` strips.
- **CSS** (`editor.css`) — `.github/no-comments-css.mjs`, a quote-aware scanner (`content: "/*"` is legal
  CSS, so a regex would cut from inside a string).
- **PHP** (all `*.php`) — `.github/no-comments.php` over `token_get_all()`, the real PHP tokenizer.

**The allowlist is whatever a MACHINE reads — and in WordPress that is more than elsewhere.** These are
syntax, not commentary; deleting one breaks the platform, not the style:

| Comment | Read by | If deleted |
| --- | --- | --- |
| The `/** Plugin Name: … Version: … Text Domain: … */` header in `rigpolice-embed.php` | WordPress core; `get_file_data()` (the `block_type_metadata` filter reads the version back out of it); `release.yml`'s tag-vs-version gate; Plugin Check | **WordPress stops seeing the plugin at all** |
| `// phpcs:disable` / `// phpcs:enable` in `render.php` | the Plugin Check job | Plugin Check reds the release (WPCS does not know `wp_get_script_tag()` escapes) |
| `/* translators: … */` in `index.js` | the WP i18n extractor (into the `.pot`) | translators lose the context |

**Do NOT widen it beyond that.** An allowlist is a bypass hatch by construction, and a word-PREFIX match
leaks (in the sibling repo an entry for the `global` directive let a comment opening "global handler
with…" survive a full strip). Match the exact directive.

**What this obliges you to do:** write a change's rationale into the matching `.claude/rules/*.md` in the
SAME edit; never leave a comment-only block empty; never make a generator emit comments; never disable
the rule. If a fact seems to need a comment, that is the signal it belongs in a rule file.

Rules: `.claude/rules/editor.md` (index.js / editor.css), `.claude/rules/php.md` (render.php / the plugin
entry), `.claude/rules/ci.md` (the gates and the contract harnesses).

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
  `SVN_USERNAME` (`rigpolice`, case-sensitive) + `SVN_PASSWORD` (the separate WordPress.org SVN password
  from the WP.org profile → Account & Security, not the account password); run `gh secret list` before
  tagging, because a missing secret fails only the SVN job after the GitHub Release is already out. The
  action is pinned to an exact version: it publishes no floating major tag. WP.org search can take up to
  72 hours to reflect a release, so a stale listing right after a tag is not a failed deploy.
- **The GitHub zip is packaged with `git archive`, NOT `rsync` — keep it that way.** `.gitattributes`
  `export-ignore` is the ONE list scoping what ships, and only `git archive` (the zip) and the 10up action
  (the SVN trunk) honor it, which is what makes the two artifacts the identical set. An `rsync -a
  --exclude='.*'` only drops DOTfiles, so it silently ships export-ignored non-dotfiles (`CLAUDE.md`,
  `README.md`) in the GitHub zip while WP.org drops them — the artifacts drift and the invariant the
  comments promise quietly becomes false.
- **The release notes are written BY HAND after the `release` job — never left as generated.** `release.yml`
  calls `gh release create --generate-notes`, and GitHub's generator lists only merged PULL REQUESTS. Work
  here lands mostly through LOCAL `--no-ff` merges, which it cannot see: v1.4.8 shipped seven user-facing
  changes and its release body is a bare compare link. Rewrite the body from readme.txt's changelog — the
  same text WordPress.org shows, so the two cannot drift:

  ```bash
  VERSION=1.4.10
  awk -v want="= $VERSION =" '{sub(/\r$/,"")} $0==want{on=1;next} on&&/^= [0-9]+\.[0-9]+/{exit} on' readme.txt > notes.md
  gh release edit "v$VERSION" --notes-file notes.md
  ```

  **Versions skipped since the last TAG go into the same body** — v1.4.10 carried 1.4.9, which was merged to
  `main` but never tagged, so a reader of the releases page would otherwise never see it. Add the
  developer-facing changes (CI pins, matrix moves, doctrine) under a separate heading; readme.txt's changelog
  is for authors using the block and deliberately says nothing about them. The `changelog` job in
  `release.yml` guarantees the SOURCE exists — a tag whose version has no `= X.Y.Z =` section stops the
  release before either deploy runs (`.claude/rules/ci.md`) — but nothing can red on a body left as
  generated, so rewriting it is a step OF the release, not optional polish.

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

RigPolice decides the embeddable set, and this block offers exactly the rows of `embeds.json`, with no slug
hardcoded. A tool behind a camera, mic or sensor prompt, or an API a cross-origin frame restricts, stays
out of the catalog: a permission dialog from an embedded widget alarms the reader or silently fails. The
site repo pins that list in `src/lib/embeds.test.ts`, which fails on a tool that is neither embedded nor
pinned, so no copy of the list lives here.

## The readme's promises are claims about a REMOTE bundle

`readme.txt` asserts things this repo cannot enforce — "nothing tracks your readers", the frame is
lazy-loaded, the credit link is optional, the tool list. All of it lives in `embed.js` and the
`/embed/<tool>/` pages on rigpolice.com, which ship WITHOUT a plugin release. A sentence that is true today
can go false with no commit here, while the WordPress.org listing keeps carrying it. Re-verify from the
source before every release, never from memory:

- `curl -s https://rigpolice.com/embed.js` — the tool map (`k`) is HARDCODED, so a slug missing from it
  renders NOTHING (which is why the editor's orphan warning must not promise "it still embeds");
  `iframe.loading="lazy"` is what backs the performance FAQ; `hc` is appended ONLY when the host-DOM credit
  shows (brand XOR); `rel="noopener"` unless `data-nofollow`, which this plugin never sends, so the opt-in
  link is dofollow.
- `curl -sI` both catalogs — `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600` back
  the editor's cross-origin fetch and the FAQ's "cached".
- Open `/embed/<tool>/` in a REAL browser and check `window.umami` / `window.plausible`, `document.cookie`,
  `localStorage`, and the network panel. **Verified 2026-08-21 for 1.4.10: the shared site bundle DOES ship
  `analytics.*.js` (events `TestStart`, `OutboundLink`, `JSError`), but it is INERT inside the embed — both
  tracker globals are undefined, no tracker script loads, nothing is written to cookies or storage, and no
  XHR leaves the frame.** The privacy sentences hold only while that stays true: loading a tracker into the
  embed page would silently make the ALREADY-SHIPPED readme false. (`Beacon.*.js` is the logo icon, not a
  tracking beacon — read a file before believing its name.)
- What reaches rigpolice.com regardless, as with any third-party embed: the reader's IP, UA, and — under the
  response's `referrer-policy: strict-origin-when-cross-origin` — the embedding site's ORIGIN, not the post
  URL. That is why the readme scopes its promise to what **the plugin** sends. Do NOT widen it to "nothing
  is sent".
