<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;

}



$rigpolice_embed_meta = get_file_data( __DIR__ . '/rigpolice-embed.php', array( 'Version' => 'Version' ) );

return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
	'version'      => $rigpolice_embed_meta['Version'],
);
