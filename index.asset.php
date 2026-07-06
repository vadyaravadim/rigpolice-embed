<?php
/**
 * Hand-written asset manifest (no build step). WP reads this alongside index.js (referenced by block.json
 * `editorScript: file:./index.js`) to enqueue the editor script with the right WordPress package deps
 * loaded first, so `window.wp.blocks` / `wp.element` / etc. exist before index.js runs.
 *
 * @package RigPolice\Embed
 */

return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
	'version'      => '1.1.0',
);
