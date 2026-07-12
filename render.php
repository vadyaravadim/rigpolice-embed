<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;

}

$tool = isset( $attributes['tool'] ) ? trim( (string) $attributes['tool'] ) : '';
if ( '' === $tool ) {
	return '';

}

$anchor = isset( $attributes['anchor'] ) ? trim( (string) $attributes['anchor'] ) : '';
$from   = isset( $attributes['from'] ) ? trim( (string) $attributes['from'] ) : '';
$to     = isset( $attributes['to'] ) ? trim( (string) $attributes['to'] ) : '';
$width  = ( isset( $attributes['width'] ) && is_numeric( $attributes['width'] ) ) ? (int) $attributes['width'] : 0;




$script_attributes = array(
	'src'   => 'https://rigpolice.com/embed.js',
	'async' => true,


	'data-tool'   => $tool,
	'data-anchor' => $anchor,
);



if ( '' !== $from && '' !== $to && $from !== $to ) {
	$script_attributes['data-from'] = $from;
	$script_attributes['data-to']   = $to;
}


if ( $width > 0 ) {
	$script_attributes['data-width'] = (string) $width;
}




if ( empty( $attributes['showcredit'] ) ) {
	$script_attributes['data-nocredit'] = true;
}






// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped -- get_block_wrapper_attributes() + wp_get_script_tag() return WP-escaped output.
printf(
	'<div %1$s>%2$s</div>',
	get_block_wrapper_attributes(),
	wp_get_script_tag( $script_attributes )
);
// phpcs:enable WordPress.Security.EscapeOutput.OutputNotEscaped
