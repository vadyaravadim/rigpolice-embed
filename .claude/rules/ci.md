---
paths:
  - '.github/**'
  - '.gitattributes'
  - '.wp-env.json'
---

# RigPolice Embed — CI gates and contract harnesses

(Release mechanics — tag-driven deploy, the two version literals, `git archive` vs rsync, the 10up SVN
action, the Playground blueprint — live in `CLAUDE.md`. This file is about the GATES.)

## The three gates (`ci.yml`)

- **All three are `workflow_call`-able and `release.yml` gates BOTH deploy jobs on them (`needs: ci`)** — a
  tag can never ship code that didn't pass the same checks a branch runs.
- **`plugin-check`** (`wordpress/plugin-check-action@v1.1.7`) — WordPress.org compliance (escaping, readme,
  i18n, guidelines). Catches the class of mistake that gets a release REJECTED by WP.org.
- **`contracts` / render-contract** (`.github/render-contract.php`) — asserts render.php's OUTPUT through
  `do_blocks()` in a REAL WordPress via `wp eval-file`. `save()` returns null, so render.php IS what readers
  get: a regression here ships.
- **`contracts` / editor-contract** (`.github/editor-contract.mjs`) — asserts the EDITOR contract by driving
  the real block editor in headless Chrome. **render-contract cannot see `index.js` at all**, and index.js is
  where this block lives (it drives core's Dropdown / Popover / ComboboxControl, whose behavior is
  WP-version-dependent). This is the ONLY gate that would have caught the **1.4.8 `focusOnMount:
  'firstInputElement'`** regression — a value that exists only in WP 7.0, so on 6.3–6.9 the popover focused
  its own container, the list never expanded, and arrow keys did nothing while every PHP gate stayed green.
  That regression is the reason the matrix exists.
- **Zero-build stays intact**: no `package.json`, no `composer.json`. wp-env + the browser harness run via
  `npx`/`node`; plugin-check brings its own WordPress.

## The matrix — two ends, not every version

- `matrix.wp: [ '6.3', '7.0' ]` = the **floor** (`Requires at least: 6.3` in BOTH `rigpolice-embed.php` and
  `readme.txt`) and the **ceiling** (readme's `Tested up to`). In-between versions buy almost nothing: core
  only ADDS component APIs across a range like this, so what bites is using something too NEW — which the
  floor catches.
- **Move each end honestly**: raise the floor only by raising `Requires at least` in BOTH manifests; move the
  ceiling when `Tested up to` moves.
- `fail-fast: false` — "the floor is broken, the current one is fine" is the whole point; fail-fast would hide
  it behind the first red.
- **`WP_ENV_CORE`** overrides `.wp-env.json`'s `core` per matrix entry, so the local stand keeps its own pin
  and no file changes. It points at the **zip** (`wordpress.org/wordpress-<v>.zip`, ~30 MB), not the
  `WordPress/WordPress#<ref>` git source the local stand uses (that partial-clones ~440 MB).
- **The `Confirm the WordPress under test really is <v>` step is load-bearing, not decorative.** wp-env
  silently falls back to the WordPress bundled in its Docker image when it believes it is offline, so an
  ignored `WP_ENV_CORE` would run the SAME WordPress on every matrix leg and report all-green — a matrix that
  tests one version while claiming to test the range. The step greps `wp core version` and `exit 1`s on
  mismatch.
- **`WP_ENV_PHP_VERSION: '8.1'`** — one PHP across the whole range, and it must be one they all support: WP
  6.3 predates PHP 8.3 (wp-env's default) and the plugin floor is `Requires PHP: 7.4`. 8.1 sits inside every
  supported set, so a red is the plugin's fault, not the interpreter's.
- **`node-version: '24'` is a REQUIREMENT, not a preference** — the CDP harness talks over Node's BUILT-IN
  `WebSocket` global (no puppeteer, no playwright), stable only from Node 22.
- `@wordpress/env@11.10.0` is PINNED like every action here — an unpinned toolchain reds every open branch on
  an upstream release with nobody having changed code.

## The two guards that read backwards

- **`ignore-codes: ${{ !inputs.strict-readme && 'outdated_tested_upto_header' || '' }}` is NEGATED on
  purpose.** GH Actions treats `''` as FALSY, so the natural-reading `strict && '' || 'code'` would fall
  THROUGH to the code and MUTE the check at the one gate meant to enforce it. Written negated, strict mode
  lands on the `||` branch and yields `''`.
  On `push`/`pull_request` the **`inputs` context does not exist at all** (a `workflow_call` `default:` is
  applied by the CALLER): `inputs.strict-readme` → `''` → falsy → negated true → the code is passed → check
  muted. Which is exactly what branch runs want — `release.yml` passes `strict-readme: true`, because a stale
  `Tested up to` must block the RELEASE, not turn every open branch red the day WordPress ships a version.
- **`concurrency.cancel-in-progress: ${{ !startsWith( github.ref, 'refs/tags/' ) }}`** — each contracts leg
  boots its own WordPress + browser, so a superseded push must not keep paying for it; **tags are EXEMPT** (a
  release run must never be cancelled by a later push).

## `plugin-check` input = the shipped set, not the working tree

- The job runs `git archive --format=tar --prefix=rigpolice-embed/ HEAD | tar -xf - -C build` and points
  `build-dir` at `./build/rigpolice-embed`. So the checker sees exactly what ships, scoped by the ONE list
  (`.gitattributes` `export-ignore`) — the same command `release.yml` packages the zip with.
- Pointing it at the working tree would make it see `CLAUDE.md` / `.github` / `.wp-env` (files that never
  ship) and force a SECOND exclude list here, free to drift from the first.
- `.gitattributes`: everything NOT listed **does ship** (LICENSE, readme.txt, rigpolice-embed.php, render.php,
  block.json, index.js, index.asset.php, editor.css). `.wordpress-org` is export-ignored from trunk on purpose
  — the 10up action copies it into SVN `assets/`, so trunk would duplicate it.

## `catalog-alive` — a SIGNAL, never a gate

- `continue-on-error: true`. The editor fills its pickers from the two live catalogs, so a dead/malformed one
  breaks the editor with no plugin change — worth knowing, but it is not the PR's fault and a network hiccup
  must never block a merge.
- **The editor contract does not depend on it**: `editor-contract.mjs` stubs BOTH catalogs at the network
  layer (CDP `Fetch.enable` on `*rigpolice.com/*.json*` → `Fetch.fulfillRequest` with fixture bodies), so it
  tests the BLOCK against CORE's components, not rigpolice.com.
- `curl -fsSL`: **`-L` because `index.js` uses `fetch()`, which FOLLOWS redirects** — without it a 301
  (origin→CDN, http→https) would warn about a catalog the editor loads fine.
- `jq -e 'type == "array"'`, **not grep**: `index.js` treats a 2xx non-array body as a failure (error envelope,
  soft-404 HTML that parsed), not as an empty catalog. `grep '^\s*\['` matches any LINE opening a bracket, so
  a nested array inside an error envelope would pass; jq asserts the WHOLE body is an array, which is what
  `Array.isArray` does.

## `render-contract.php` invariants

- **Slugs are FICTIONAL on purpose** (`test-tool`, `test-converter`). render.php never validates a slug — it
  passes it straight into `data-tool` — so a real catalog slug proves nothing extra and would red the suite
  whenever a tool is renamed on rigpolice.com.
- **Assertions match SUBSTRINGS, never a whole tag**: `wp_get_script_tag()` SORTS the attributes it emits
  (async, data-anchor, data-nocredit, data-tool, src) and that order is core's business.
- **Tallies live in a `static`, NOT in globals.** `wp eval-file` runs the file inside a function scope, so a
  top-level `$failures` is a local there and a `global` here would bind to an empty global — counts stay 0 and
  the script exits 0 no matter what failed (a test that cannot go red).
- Pinned output contract: empty `tool` renders NOTHING (no bare wrapper, no empty `data-tool`); the loader
  carries `src="https://rigpolice.com/embed.js"` + `data-tool` + `data-anchor` + `async`; `data-nocredit` is
  present BY DEFAULT (credit link is opt-in — **WP.org Guideline 10**, so dropping it is a guideline violation,
  not a cosmetic bug) and `showcredit` drops it; `data-from`/`data-to` are emitted only when both games are set
  AND differ (the same guard embed.js applies); absent `width` emits NO `data-width` (embed.js falls back to
  the tool's default only when the attribute is missing); a quote in `tool`/`anchor` cannot break out
  (`esc_attr` via `wp_get_script_tag()`).
- **`data-anchor` is asserted present even when EMPTY** — embed.js reads it with no fallback, an empty anchor
  is reachable (a tool dropped from the catalog has no row to bake one from), and every OTHER assertion passes
  a non-empty anchor, so without this case a regression wrapping it in `if ( '' !== $anchor )` would go
  unnoticed.

## `editor-contract.mjs` invariants

- Zero deps by design: headless Chrome (preinstalled on `ubuntu-latest`; `CHROME_BIN` overrides) driven over
  CDP on Node's built-in `WebSocket`. `WP_BASE_URL` defaults to `http://localhost:9400` (the wp-env port).
- **Throwaway profile + `--remote-debugging-port=0`, port read back from `DevToolsActivePort`.** A FIXED port
  silently attaches to a leftover browser from an earlier run, and the script then waits forever on a page that
  will never navigate.
- **A gate that HANGS is worse than one that fails** (CI sits on it to the job timeout with no output): a 240 s
  unref'd watchdog fails the run loudly.
- Drives `wp.data` (`insertBlock`) instead of clicking the inserter, but only AFTER `iframe[name="editor-canvas"]`
  exists — the canvas iframe is the signal the editor has actually MOUNTED; dispatching earlier lands in a store
  the editor re-initialises from the post and the block vanishes. It also disables the `welcomeGuide` preference
  (the modal steals focus and covers the canvas).
- Pickers live in the canvas IFRAME; the popover they open lives in the TOP document — clicks into the iframe
  must offset by the frame's own `getBoundingClientRect()`.
- The four focus assertions are the 1.4.8 regression pinned: the popover opens; **focus lands in the search
  `input[role=combobox]`, not on a section chip**; a **discriminator** assertion proves a chip really IS the
  popover's first tabbable (so core's own `focusOnMount` would land there and the test can actually fail); and
  the suggestion list is expanded on open with no typing. Then ArrowDown moves `aria-activedescendant`, and
  Enter commits both `tool` and `anchor` into the block attributes.
- The tool-picker wait is wrapped so a timeout reports WHY (block registered? blocks in editor? canvas found?
  placeholder text?) — a bare "timed out" is almost always either an unregistered block or a stub that didn't
  take.
