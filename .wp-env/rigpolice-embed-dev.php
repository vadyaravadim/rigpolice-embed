<?php
/**
 * DEV-ONLY helper (wp-env). Repoints the RigPolice embed block at a LOCAL build for testing WITHOUT
 * touching the shipped plugin. wp-env maps the whole `.wp-env` dir onto wp-content/mu-plugins (.wp-env.json
 * `mappings`) — a DIR map, not a single-file one, because Docker Desktop on macOS fails to bind-mount an
 * individual file into mu-plugins. It never ships: `/.wp-env` is export-ignored in .gitattributes, so both
 * the `git archive` GitHub zip and the WP.org SVN trunk drop it. Production always ships the plugin's real
 * https://rigpolice.com URLs, unmodified.
 *
 * Both redirects key off RIGPOLICE_EMBED_DEV_ORIGIN — UNSET by default, so this no-ops and the block hits
 * PRODUCTION. To point at a LOCAL build, set it in `.wp-env.override.json` (gitignored, never committed):
 *   { "config": { "RIGPOLICE_EMBED_DEV_ORIGIN": "http://localhost:8787" } }
 *   1. Front end — rewrite the prod origin in the rigpolice/embed block's rendered <script src>. The
 *      loader is self-locating, so pointing its <script src> at the dev origin loads the iframe + brand
 *      link from the local build too.
 *   2. Editor — shim window.fetch so index.js's /embeds.json + /games.json reads hit the dev origin.
 *
 * @package RigPolice\Embed\Dev
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

if ( ! defined( 'RIGPOLICE_EMBED_DEV_ORIGIN' ) || '' === RIGPOLICE_EMBED_DEV_ORIGIN ) {
	return; // No dev origin configured -> behave exactly like production (plugin untouched).
}

// 1. Front end: swap the origin in the block's rendered <script async src="https://rigpolice.com/embed.js">.
add_filter(
	'render_block',
	static function ( $content, $block ) {
		if ( isset( $block['blockName'] ) && 'rigpolice/embed' === $block['blockName'] ) {
			$content = str_replace( 'https://rigpolice.com', RIGPOLICE_EMBED_DEV_ORIGIN, $content );
		}
		return $content;
	},
	10,
	2
);

// 2. Editor: patch window.fetch before index.js runs (attached 'before' wp-blocks, a declared dependency)
// so its hardcoded prod catalog reads hit the dev build's CORS-open /embeds.json + /games.json.
add_action(
	'enqueue_block_editor_assets',
	static function () {
		$prod = wp_json_encode( 'https://rigpolice.com' );
		$dev  = wp_json_encode( RIGPOLICE_EMBED_DEV_ORIGIN );
		wp_add_inline_script(
			'wp-blocks',
			"(function(){var p={$prod},d={$dev},f=window.fetch;window.fetch=function(u,o){"
			. "return f.call(this,typeof u==='string'&&u.indexOf(p)===0?d+u.slice(p.length):u,o);};})();",
			'before'
		);
	}
);
