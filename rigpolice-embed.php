<?php
/**
 * Plugin Name:       RigPolice Embed
 * Plugin URI:        https://rigpolice.com/embed-tools/
 * Description:        Let your readers test their gaming gear inside any post. Pick a free mouse, keyboard, monitor, or click-speed test in the block, publish, and the widget loads in its own frame and auto-resizes.
 * Version:           1.4.8
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            RigPolice
 * Author URI:        https://rigpolice.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       rigpolice-embed
 *
 * @package RigPolice\Embed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

// Register the block from block.json (editor script + dynamic render are wired there). Dynamic on
// purpose: render.php outputs the <script> server-side so WP's KSES never strips it (a static save()
// would be filtered for non-admin editors).
add_action(
	'init',
	static function () {
		register_block_type( __DIR__ );
	}
);

// Give editor.css a cache-busting version. block.json carries no `version`, so register_block_style_handle()
// registers the style with ver=false and WP_Styles falls back to the WORDPRESS version — meaning the
// stylesheet's URL does not change when the PLUGIN updates, and browsers/CDNs keep serving the old file.
// index.js has no such problem (index.asset.php hands it the plugin version), so an update can load the new
// script against the previous release's CSS.
//
// The version is READ BACK from the plugin header rather than written into block.json: it must live as a
// literal in exactly two places (that header + readme.txt's Stable tag, which release.yml checks against the
// tag). A third copy in block.json is one nothing verifies, so it would silently drift.
add_filter(
	'block_type_metadata',
	static function ( $metadata ) {
		if ( isset( $metadata['name'] ) && 'rigpolice/embed' === $metadata['name'] ) {
			$rigpolice_embed_meta = get_file_data( __FILE__, array( 'Version' => 'Version' ) );

			$metadata['version'] = $rigpolice_embed_meta['Version'];
		}

		return $metadata;
	}
);
