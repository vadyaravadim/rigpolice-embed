=== RigPolice Embed ===
Contributors: rigpolice
Tags: speed test, hardware test, gaming, calculator, interactive
Requires at least: 6.3
Tested up to: 7.0.1
Requires PHP: 7.4
Stable tag: 1.4.3
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add free hands-on gear tests to any post. Readers check their mouse, keyboard, monitor, and click speed right where they read, no sign-up.

== Description ==

Add free, no-signup RigPolice test tools to any post or page. Pick a tool in the "RigPolice Tool" block, publish, and the widget loads in its own frame and auto-resizes to fit your layout. No account, and nothing tracks your readers.

Tools you can embed include the CPS test, mouse test, DPI analyzer, double-click test, polling-rate test, keyboard tester, monitor test, refresh-rate test, dead-pixel test, tone generator, internet speed test, sensitivity converter, and more. The list is pulled live from RigPolice, so new tools show up in the block automatically.

For the sensitivity converter, you can preset a game pair (for example CS:GO to Valorant) so the embedded widget opens on the conversion your post covers. Readers can still switch games inside the widget.

An optional credit link can be shown under the tool. It is off by default; turn it on per embed with the Show credit link toggle in the block sidebar.

The plugin is open source (GPL-2.0-or-later). Source and issues: https://github.com/vadyaravadim/rigpolice-embed

== Installation ==

1. Install the ZIP via Plugins > Add New > Upload Plugin, or upload the `rigpolice-embed` folder to `/wp-content/plugins/`.
2. Activate the plugin through the Plugins screen.
3. Edit a post or page, add the "RigPolice Tool" block, and choose a tool.

== Frequently Asked Questions ==

= Will it slow my site down? =

No. Each tool loads in its own frame, and only when the reader scrolls near it, so your content paints first. The loader script is tiny, cached, and shared by every embed on the page.

= Do my readers get tracked? =

No. Each test runs in the reader's browser inside its own frame, with no account and no cookies set on your site.

= Does the block add a link to my site? =

Not by default. You can optionally turn on a small credit link under the tool with the Show credit link toggle in the block sidebar; it stays off unless you enable it.

== Screenshots ==

1. The "RigPolice Tool" block: pick a tool from the live dropdown.
2. The sensitivity converter with a From and To game pair preset.
3. The CPS test running inside a published post, right where readers land.

== External Services ==

This plugin connects to RigPolice (https://rigpolice.com), the service that hosts the test tools, so the embedded widgets always match the live site.

What it loads, and when:

* On the front end, each block outputs a script tag that loads the shared loader script `https://rigpolice.com/embed.js` in the reader's browser. That loader injects the tool's iframe (served from rigpolice.com) and resizes it to fit. The test itself runs inside that iframe, in the reader's own browser.
* In the block editor only, the block fetches `https://rigpolice.com/embeds.json` (the list of embeddable tools) and `https://rigpolice.com/games.json` (the sensitivity-converter game list) to fill the tool and game pickers.

This plugin sends no personal data about you or your readers to RigPolice. The editor requests are plain reads of public catalogs; the front-end loader only passes the tool slug you picked in the block. Nothing tracks your readers, and the plugin sets no cookies on your site.

RigPolice privacy policy: https://rigpolice.com/privacy/
RigPolice site and contact: https://rigpolice.com/about/

== Changelog ==

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
