---
paths:
  - 'index.js'
  - 'editor.css'
  - 'index.asset.php'
  - 'block.json'
---

# RigPolice Embed — editor (index.js / editor.css)

## Cross-repo wire contract (the catalogs)

- **`embeds.json` / `games.json` are a PUBLIC wire contract owned by the rigpolice.com site repo, not by this plugin.** The editor reads `https://rigpolice.com/embeds.json` (tool rows: `slug`, `title`, `category`, `width`, `height`, `anchor`, `preset`) and `https://rigpolice.com/games.json` (game rows: `slug`, `name`). Both are consumed by field name at runtime with no schema check — a rename on the site side breaks the pickers silently, in every already-published install. Both endpoints send `Access-Control-Allow-Origin: *` for exactly this cross-origin fetch from wp-admin.
- **Nothing derived from a catalog may be hardcoded here.** `categoriesOf()` derives the section list from the catalog's own rows, and option order IS catalog order (`embeds.json` already ships tools grouped by category, matching the sections on `/embed-tools/`). Do NOT re-sort and do NOT hardcode a category list — a tool or section added on the site must appear here with no plugin release.
- **The converter's From/To pair is gated on `preset === 'pair'`** on the selected catalog row — that is the only signal that a tool takes game arguments.
- **`fetchJson()` treats a 2xx with a non-array body as a FAILURE** (`throw new Error('Unexpected payload')`), not as an empty catalog. Each catalog is a three-state cell (`null` = loading, `false` = failed, array = loaded) and it cannot tell "empty" from "broken" — an error envelope or a soft-404 HTML page that happened to parse would otherwise render a working-but-empty picker.

## Focus + the WP version floor (6.3)

- **`Dropdown`'s `focusOnMount` must stay at core's default (`'firstElement'`).** The value that means "focus the search field", `'firstInputElement'`, only exists in **WordPress 7.0**, and this plugin supports **6.3**: on older releases `useFocusOnMount` does `if (mode !== 'firstElement') focus(node)`, so an unknown string focuses the popover CONTAINER — the ComboboxControl never expands its list and the arrow keys the popover exists for do nothing. Do NOT pass `false` either: `Popover` derives `constrainTabbing` and focus-return-on-close from `focusOnMount !== false`.
- **Consequently each picker lands focus differently, and the difference is load-bearing.** A picker WITH a caption row (the tool picker) would see `'firstElement'` focus the caption's first section chip, so it passes `contentRef` (`pickerContentRef`) and focuses the input itself. A picker WITHOUT one (both game pickers) already has the input as its first tabbable, so core's default is right and no ref is needed. **Give a game picker a caption and it silently regresses to focusing a chip — hand it a `contentRef` in the same edit.**
- **`pickerContentRef` is a `useCallback` with `[]` deps — the identity MUST stay stable.** A fresh function each render makes React detach/re-attach the ref every render and steal focus back mid-keystroke. It works as a CALLBACK ref because React attaches a child's ref before its parent's, so it fires before `Popover`'s `useFocusOnMount`, which then finds focus already inside the popover and early-returns (`if (node.contains(activeElement)) return;` — unchanged 6.3 → 7.0).
- **Reach the combobox input by `input[role="combobox"]`, never by core's `components-combobox-control__input` class.** `role="combobox"` is part of the control's ARIA contract; the class is a private styling detail core renames freely, and a miss fails silently (no focus, no error).
- **Focusing that input is what expands the suggestion list**, so `focusPicker()` must run both on popover open and after a section chip is clicked.

## Why the pickers live in a POPOVER

- **A `ComboboxControl` inline in the block canvas cannot work — this is not a styling choice.** The canvas runs writing flow (`useArrowNav`, a native keydown listener on the canvas `<body>`), which reads ArrowUp/ArrowDown in a one-line input whose caret sits at its edge (an empty one always does) as "leave this field", moves focus to the nearest tabbable and calls `preventDefault()`. The control's own key handling is a React `onKeyDown`, delegated from the canvas `<html>` ABOVE that listener, so it always runs second and bails on `event.defaultPrevented` — the suggestions never move. Markup order only changes WHICH neighbour steals the keys. The editor mounts popovers in the TOP document, outside the canvas iframe and so outside writing flow's reach.

## ComboboxControl invariants

- **`toolOptions` / `gameOptions` MUST stay `useMemo`'d — this is correctness, not a micro-optimisation.** ComboboxControl memoizes its filtered suggestions on the `options` IDENTITY, then locates the highlighted row with `indexOf()` on the option OBJECT. A fresh array every render makes the author's arrow-key selection unfindable: the highlight snaps back to row one and the result count is re-announced on ANY unrelated re-render while a picker is open (dragging Max width is enough). Both memos are hoisted above the catalog branches because hooks cannot run conditionally.
- **A controlled `value` with no matching option renders the field BLANK.** Two rules follow, and neither may be dropped: the section filter never hides the SELECTED tool, and every saved-but-orphaned slug (`orphanSlugs()` — a slug the fresh catalog no longer has) gets a synthetic "(no longer in the catalog)" option. Otherwise the author sees no selection while `render.php` still embeds the slug.
- **BOTH game ends list EVERY game, from one shared `gameOptions`.** Filtering the other end's game out of each list (as 1.4.8 did) makes a SWAP unreachable: turning `from=A,to=B` into `from=B,to=A` requires each end to pass through the value the other still holds. So the pair is allowed to go through a transient `from === to`, and the error line names it.
- **Reset is `value === null` and keeps the popover open** (the author is clearing to choose again); only a real pick calls `picker.onClose()`.

## `render.php` draws the validity line — the editor only mirrors it

- **Tool is REQUIRED:** with no tool `render.php` returns `''` and the block publishes nothing. Hence the field's own error line rather than a soft hint.
- **The game pair is emitted only when both are set AND they differ** (matching embed.js's own guard). A half-filled or repeated pair is not "a partial preset" — it is silently NO preset, so both states are ERRORED on rather than made unpickable.
- **The picked tool's `anchor` is baked into the block at pick time** (`next.anchor = picked.anchor`) because embed.js reads `data-anchor` with NO fallback for the iframe title. An ORPHANED slug has no catalog row, so re-selecting it from its synthetic option must KEEP the anchor the block already carries — blanking it ships `data-anchor=""`.
- **Re-picking the already-selected tool is a guarded no-op** (`if (value === tool) return;`). Without it, reopening the picker just to browse and confirming the same converter wipes an already-configured game pair, and the pair's error line then blames the author for it.
- **An orphaned slug is WARNED about, not errored on** — it still embeds. The guidance is "pick a replacement, or remove the block", never "reset the field": core renders the combobox's reset (X) only while the control is COLLAPSED, but the popover opens with the field focused and so expanded.
- **`showcredit` defaults to `false` in `block.json` by WordPress.org Guideline 10** (host-DOM credit links must be opt-in). The tool's in-frame branding is unaffected, so brand visibility never depends on the toggle.

## Accessibility contracts

- **A picker's label is a plain `<span>`, NOT a `<label for>`.** What it names is a Button that opens the real field: a `<label>` would hand the button its accessible name (colliding with the `aria-label` that carries the value) and route a click on the label into a click on the button.
- **The toggle Button's `aria-label` is the sprintf'd `"%1$s: %2$s"` (field name + value).** The label sits outside the button, and on their own two game buttons would both announce just "Choose a game". The visible text must stay inside the name (WCAG 2.5.3, Label in Name) — keep the value in both.
- **Error lines carry `role="alert"` (WCAG 4.1.3, Status Messages)**: a reset leaves the popover open, so the field goes invalid while focus is elsewhere, and `aria-describedby` alone is only read once the toggle is re-focused. The game pair shares ONE error line (the rule is about the pair) which both buttons point at via `describedBy`; a field's own line uses `error`.
- **Error-line ids are per-block (`'rigpolice-embed-' + props.clientId`)** — two of these blocks on one page would otherwise share an id.
- **Section chips use `aria-current`, not `aria-pressed`** (the active section is the current view, not a pushed toggle) — and `Button` turns `aria-pressed` into its `is-pressed` class, which core paints as a solid dark fill, rendering a link-variant button's label as a black box.
- **The chips are NOT passed as the ComboboxControl's `label` prop.** That renders inside BaseControl's `<label for>`, where a chip click would also be routed to the input and a screen reader would read every section name as part of the field's name. The row is drawn separately; the control keeps its own `hideLabelFromVision` label for its accessible name.
- **`createInterpolateElement` with an `ExternalLink`, not a concatenated raw `<a>`** — translators get the whole sentence with the link in place, and ExternalLink carries core's `target`/`rel`, the icon and the screen-reader "(opens in a new tab)" text.

## Zero-build consequences

- **`index.asset.php`'s `dependencies` array is the load-order contract for the `window.wp.*` globals `index.js` reads at IIFE time** (`wp-blocks`, `wp-element`, `wp-block-editor`, `wp-components`, `wp-i18n`). Use a new `wp.*` namespace in `index.js` and its handle MUST be added here, or it is `undefined` at runtime. Its `version` is read back from the plugin header via `get_file_data()` (drives the editor asset's `?ver=`); `block.json` omits `version` on purpose.
- **`CHEVRON_DOWN` is core's own chevron copied inline** (24px viewBox + path): `@wordpress/icons` has no script handle to read it from and a zero-build plugin has no bundler to import it with, so the glyph is duplicated rather than approximated.
- **The section filter (`category`) is editor-only `useState`, deliberately NOT a block attribute** — it is how the author browses the picker, not what gets published. Picking a tool clears it.

## editor.css

- **Popover rules key off `.rigpolice-embed__picker`, NEVER `.wp-block-rigpolice-embed`.** The editor mounts popovers in the TOP document, outside the canvas iframe and so outside the block's wrapper — a `.wp-block-*` selector only ever matches in the canvas. `.rigpolice-embed__field-label` is scoped to NEITHER document on purpose: it names a button in the block AND the search field inside the popover.
- **Turning the fieldset into a column MUST also reset core's `flex-wrap: wrap` to `nowrap` — the two together are a layout bug, not a redundancy.** Core lays the fieldset out as a wrapping ROW; we flip it to `column` and its `wrap` survives, making it a **column-wrap** container. In one, Chromium sizes a nested wrapping flex child (`.rigpolice-embed__pair`) as if its lines had broken — the pair reports `59.4 + 4 + 59.4 = 122.8px` for two fields that visibly sit side by side on ONE line, then `align-content: stretch` inflates the fields to fill it and the block grows ~64px. It surfaces on the converter with BOTH games picked, because that is the only state where the pair has no error line (a neutral probe of two fixed 59px children reproduces it with no involvement of ours). The fieldset must never wrap into columns anyway, so `nowrap` is what completes the row→column flip.

- **Selectors that fight the Placeholder must carry `.components-placeholder__fieldset`.** A NARROW placeholder (core adds `is-medium` / `is-small`) hands every `.components-button` inside it `justify-content: center`, and centers every direct child of the fieldset — right for its own button rows, wrong for a field (value left, chevron right) and for the pair row. Core's rules are three classes deep, so a shorter selector here loses (or wins only by load order, which is not a thing to rely on).
- **The width cap (`max-width: 656px`) lives on the FIELDSET and nowhere else.** The fields carry none: the fieldset is a column flex with `align-items: stretch`, so the tool field fills the cap (full width) and the pair row gets exactly the same line to split. 656 is not arbitrary — it is `2 × 320 + 16` (the pair's `column-gap`), i.e. two SelectControl-width game fields. Cap a field instead and the number has to be repeated on the pair row to keep the two rows flush, and the copies drift.

- **`flex: 1 1 200px` on a field is scoped to `.rigpolice-embed__pair` ONLY.** The fieldset is a COLUMN flex everywhere else, where a `flex-basis` is read as a HEIGHT and stretches the field down the page. `min-width: 0` lets a long game name truncate instead of pushing the field past the block.
- **The picker popover's width is pinned (`320px`).** The suggestions list renders in flow, so an auto-width popover would resize on every keystroke as the list filters. The suggestions list also overrides core's ~9em cap to `240px` — here the list IS the panel.
- **The chip separator bullet is drawn by the item WRAPPER's `::after`, never the button's.** A `::after` on the button renders inside the button's box, so the separator joins the click target and the focus ring and underline stretch through it.
- **The picker button carries no `variant` and is keyed to SelectControl's look** (border / radius / text color, chevron as the affordance) — core's variants are all accent-blue or filled, which reads as "do something" rather than "a field holding a value". Height and focus ring still come from core's Button.
