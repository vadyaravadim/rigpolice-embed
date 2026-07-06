=== RigPolice Embed ===
Contributors: rigpolice
Tags: embed, gaming, hardware test, mouse test, widget
Requires at least: 6.3
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed free RigPolice gear-test tools with a block: mouse, monitor, keyboard, click, and network testers.

== Description ==

Add free, no-signup RigPolice test tools to any post or page. Pick a tool in the "RigPolice Tool" block, publish, and the widget loads in its own frame and auto-resizes to fit your layout. No account, and nothing tracks your readers.

Tools you can embed include the CPS test, mouse test, DPI analyzer, double-click test, polling-rate test, keyboard tester, monitor test, refresh-rate test, dead-pixel test, tone generator, internet speed test, sensitivity converter, and more. The list is pulled live from RigPolice, so new tools show up in the block automatically.

For the sensitivity converter, you can preset a game pair (for example CS:GO to Valorant) so the embedded widget opens on the conversion your post covers. Readers can still switch games inside the widget.

The block adds a small credit link under each tool. It is nofollow by default; you can switch it to dofollow in the block's Link settings.

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

= Is there a backlink? =

The block adds a small credit link under the tool, nofollow by default. Switch it to dofollow in the block's Link settings if you want.

== Changelog ==

= 1.0.0 =
* First release: live tool picker, size preview, sensitivity converter game-pair preset, and a nofollow/dofollow credit-link toggle.
