<?php
/**
 * Plugin Name:       RigPolice Embed
 * Plugin URI:        https://rigpolice.com/embed-tools/
 * Description:        Let your readers test their gaming gear inside any post. Pick a free mouse, keyboard, monitor, or click-speed test in the block, publish, and the widget loads in its own frame and auto-resizes.
 * Version:           1.4.4
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
