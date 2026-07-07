<?php
/**
 * Hand-written asset manifest (no build step). WP reads this alongside index.js (referenced by block.json
 * `editorScript: file:./index.js`) to enqueue the editor script with the right WordPress package deps
 * loaded first, so `window.wp.blocks` / `wp.element` / etc. exist before index.js runs.
 *
 * @package RigPolice\Embed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

// Version is the single-source plugin header, read back here so a release bumps it only there (+ readme
// Stable tag). block.json omits `version` (no runtime effect); this value drives the editor asset ?ver=.
$rigpolice_embed_meta = get_file_data( __DIR__ . '/rigpolice-embed.php', array( 'Version' => 'Version' ) );

return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
	'version'      => $rigpolice_embed_meta['Version'],
);
