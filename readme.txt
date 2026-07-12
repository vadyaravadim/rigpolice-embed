=== RigPolice Embed ===
Contributors: rigpolice
Tags: gaming, speed test, calculator, interactive, diagnostics
Requires at least: 6.3
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.4.9
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add free hands-on gear tests to any post. Readers check their mouse, keyboard, monitor, and click speed right where they read, no sign-up.

== Description ==

Add free, no-signup RigPolice test tools to any post or page. Pick a tool in the "RigPolice Tool" block, publish, and the widget loads in its own frame and auto-resizes to fit your layout. No account, and nothing tracks your readers.

Tools you can embed include the CPS test, mouse test, DPI analyzer, double-click test, polling-rate test, keyboard tester, monitor test, refresh-rate test, dead-pixel test, tone generator, internet speed test, sensitivity converter, and more. The list is pulled live from RigPolice, so new tools show up in the block automatically.

Browse every embeddable tool, grouped by section and with a live demo of each: https://rigpolice.com/embed-tools/

For the sensitivity converter, you can preset a game pair (for example CS:GO to Valorant) so the embedded widget opens on the conversion your post covers. Readers can still switch games inside the widget.

An optional credit link can be shown under the tool. It is off by default; turn it on per embed with the Show credit link toggle in the block sidebar.

The plugin is open source (GPL-2.0-or-later). Source and issues: https://github.com/vadyaravadim/rigpolice-embed

= A note from the developer =

Hi, I'm the developer behind RigPolice. I built these gear tests because I kept wanting a quick, honest way to check a mouse, keyboard, or monitor without installing anything or handing over an email, and I figured other people did too. They're free, they run entirely in your reader's browser, and this block just lets you drop them where they're actually useful, inside your own posts. That's the whole idea: no accounts, no tracking, no upsell.

If it helps you or your readers, I'd genuinely love to hear about it, and an honest review on this page means a lot to a small project like this.

Support, bugs, and ideas are all welcome:

* GitHub issues (fastest): https://github.com/vadyaravadim/rigpolice-embed/issues
* The plugin's support forum here on WordPress.org
* RigPolice site and contact: https://rigpolice.com/about/

Thanks for giving it a try. — RigPolice

== Installation ==

= Install from your WordPress dashboard (recommended) =

1. Go to Plugins > Add New and search for "RigPolice Embed".
2. Click Install Now, then Activate.

= Install manually =

1. Download the plugin ZIP, then go to Plugins > Add New > Upload Plugin and upload it (or unzip and copy the `rigpolice-embed` folder into `/wp-content/plugins/` via FTP).
2. Activate the plugin through the Plugins screen.

= Add a tool to a post =

1. Edit any post or page in the block editor and add the "RigPolice Tool" block.
2. Click the Tool field and pick a tool from the panel that opens: search the list, or narrow it to a section (mouse, keyboard, monitor, and so on). The catalog is pulled live from RigPolice. For the sensitivity converter you also pick a From and a To game the same way.
3. Publish. The widget loads in its own frame and auto-resizes to fit, with no configuration, no accounts, and nothing to set up on the RigPolice side.

The block requires the WordPress block editor (Gutenberg). On sites running the Classic Editor, switch the post to the block editor to add it.

== Frequently Asked Questions ==

= Will it slow my site down? =

No. Each tool loads in its own frame, and only when the reader scrolls near it, so your content paints first. The loader script is tiny, cached, and shared by every embed on the page.

= Do my readers get tracked? =

No. Each test runs in the reader's browser inside its own frame, with no account and no cookies set on your site.

= Does the block add a link to my site? =

Not by default. You can optionally turn on a small credit link under the tool with the Show credit link toggle in the block sidebar; it stays off unless you enable it.

== Screenshots ==

1. One block, every RigPolice test. Search the live catalog or narrow it by section — mouse, monitor, keyboard, audio, gaming, system, mobile — and new tools show up on their own.
2. Sensitivity converter: preset the From and To game, so readers land straight on the conversion your post is about.
3. Published. The test runs inside the post, right where readers already are — no download, no sign-up, and the frame resizes itself to fit.
4. Two settings, and that is the whole plugin: cap the width to match your layout, and decide whether a credit link shows under the tool. It is off unless you turn it on.

== External Services ==

This plugin connects to RigPolice (https://rigpolice.com), the service that hosts the test tools, so the embedded widgets always match the live site.

What it loads, and when:

* On the front end, each block outputs a script tag that loads the shared loader script `https://rigpolice.com/embed.js` in the reader's browser. That loader injects the tool's iframe (served from rigpolice.com) and resizes it to fit. The test itself runs inside that iframe, in the reader's own browser.
* In the block editor only, the block fetches `https://rigpolice.com/embeds.json` (the list of embeddable tools) and `https://rigpolice.com/games.json` (the sensitivity-converter game list) to fill the tool and game pickers.

This plugin sends no personal data about you or your readers to RigPolice. The editor requests are plain reads of public catalogs; the front-end loader only passes the tool slug you picked in the block. Nothing tracks your readers, and the plugin sets no cookies on your site.

RigPolice privacy policy: https://rigpolice.com/privacy/
RigPolice site and contact: https://rigpolice.com/about/

== Changelog ==

= 1.4.9 =
* Fixed the block growing a strip of empty space in the editor once the sensitivity converter had both of its games picked: the two game fields stretched to twice their height for no reason. Editor-only, nothing about the embedded tool changed.
* The tool picker now spans the full width of the block, lining up with the converter's game fields underneath it.

= 1.4.8 =
* Fixed the pickers ignoring the arrow keys: Up and Down now walk the suggestion list instead of throwing focus out of the field. Each picker is now a button showing what you picked, and it opens its searchable list in a panel of its own.
* Fixed a tool that RigPolice has renamed or removed losing its title when you re-picked it in the editor: the block kept embedding the tool but quietly dropped the label the widget uses to name its frame. Re-picking the tool you already had no longer wipes the sensitivity converter's game pair either.
* Fixed a game that RigPolice has renamed or removed vanishing from the sensitivity converter's picker: the pair was still saved on the block, but the field looked empty, as if you had never set it. The game now stays in the field, marked as no longer in the catalog, the way a renamed or removed tool already was.
* Added a section filter to the tool picker: click mouse, keyboard, monitor, and so on to narrow the list to that section, and click it again to see everything. The sections come from RigPolice, so a new one appears on its own.
* Made the tool picker easier to scan: each entry now reads "Tool name • section", so the tools group visibly by section the way they do on the RigPolice embed page.
* The tool is now marked required, and so are both games on the sensitivity converter: the block tells you what is still missing instead of quietly publishing nothing, or a converter with no preset pair. Both sides list every game, so you can swap a pair around, and the block says so if you land on the same game twice — the widget needs two different games to open on a conversion.
* Added a link under the picker to the RigPolice embed page, where every tool is listed by section with a live demo, so you can see what a tool does before picking it.

= 1.4.7 =
* Fixed two ways the editor could mislead you about which tool is embedded: if the tool list fails to load you now get the error notice instead of an empty picker, and a tool that was renamed or removed on RigPolice now shows a warning instead of leaving the picker blank.
* Rewrote the Installation tab: install from the WordPress dashboard is now the primary path, manual ZIP/FTP is a fallback, and the steps run through to a published, working tool. No change to how the block works.
* Added a short note from the developer with support and contact links (GitHub issues, support forum, RigPolice site). No change to how the block works.

= 1.4.6 =
* Fixed the Live Preview demo post so the CPS test actually shows: the blueprint now creates the post with a real id and loads WordPress by an absolute path. Verified end to end in a local Playground run. No change to how the block works.

= 1.4.5 =
* Fixed the Live Preview demo: the blueprint now installs the plugin before creating the demo post, so the CPS test renders instead of erroring. No change to how the block works.

= 1.4.4 =
* Added a WordPress Playground blueprint so the plugin's Live Preview opens a published post with a working CPS test. No change to how the block works.
* Swapped the hardware-test tag for tags that the directory actually shows and browses. No change to how the block works.

= 1.4.3 =
* Retargeted the directory search tags so the plugin surfaces under the terms people actually browse. No change to how the block works.

= 1.4.2 =
* Refreshed the directory screenshots (now a single walkthrough post, front end included) and retargeted the search tags. No change to how the block works.

= 1.4.1 =
* Fix a small alignment glitch in the block editor: the "RigPolice Tool" block label no longer sits slightly indented.

= 1.4.0 =
* The credit link under the tool is now off by default. Turn it on per embed with the new "Show credit link" toggle in the block sidebar.

= 1.3.2 =
* Housekeeping: direct-access hardening, cleaner output escaping, and WordPress 7.0 compatibility. No change to how the block works.

= 1.3.1 =
* Fix the editor's tool and game pickers: the dropdown no longer covers the search box, and the control no longer changes width or wraps long tool names as you type.

= 1.3.0 =
* Fix the editor jumping when a picker opens: the suggestions now float over the block instead of pushing it down.

= 1.2.0 =
* The tool and game pickers are now searchable: type to filter instead of scrolling the list.

= 1.1.0 =
* Add a Max width control in the block sidebar (height still fits the content automatically).
* Make the credit link under the tool a small, unobtrusive line instead of a large link.

= 1.0.0 =
* First release: live tool picker, size preview, sensitivity converter game-pair preset, and a nofollow/dofollow credit-link toggle.
