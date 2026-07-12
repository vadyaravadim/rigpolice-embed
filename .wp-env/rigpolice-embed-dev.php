<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;

}

if ( ! defined( 'RIGPOLICE_EMBED_DEV_ORIGIN' ) || '' === RIGPOLICE_EMBED_DEV_ORIGIN ) {
	return;

}


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
