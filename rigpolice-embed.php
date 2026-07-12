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
	exit;

}




add_action(
	'init',
	static function () {
		register_block_type( __DIR__ );
	}
);










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
