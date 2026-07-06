<?php
/**
 * Server-side render for the rigpolice/embed block.
 *
 * Dynamic on purpose: emitting the <script> here (not from a static save()) means WP's KSES never strips
 * it for non-admin editors. It outputs the existing self-locating embed.js loader snippet — one
 * <script async> that injects the tool's iframe plus a crawlable brand link and auto-resizes. embed.js
 * owns the dimensions / allow flags from its own registry, so this only carries data-tool, the optional
 * dofollow opt-in (nofollow is embed.js's default), and, for the converter, the from/to game pair.
 *
 * @var array $attributes Block attributes (tool slug, dofollow flag, from/to game slugs).
 *
 * @package RigPolice\Embed
 */

$tool = isset( $attributes['tool'] ) ? trim( (string) $attributes['tool'] ) : '';
if ( '' === $tool ) {
	return ''; // No tool picked yet — render nothing on the front end.
}

$dofollow = ! empty( $attributes['dofollow'] ) ? ' data-dofollow' : '';

// Converter game pair. Only emitted when both are set and differ (matching embed.js's own guard), so a
// non-converter tool, whose from/to are always reset to '' in the editor, never carries a stray pair.
$from = isset( $attributes['from'] ) ? trim( (string) $attributes['from'] ) : '';
$to   = isset( $attributes['to'] ) ? trim( (string) $attributes['to'] ) : '';
$pair = ( '' !== $from && '' !== $to && $from !== $to )
	? sprintf( ' data-from="%s" data-to="%s"', esc_attr( $from ), esc_attr( $to ) )
	: '';

// Optional max-width override (integer px). embed.js caps the frame's max-width; height stays auto.
$width = ( isset( $attributes['width'] ) && is_numeric( $attributes['width'] ) )
	? sprintf( ' data-width="%d"', (int) $attributes['width'] )
	: '';

printf(
	'<div %1$s><script async src="%2$s" data-tool="%3$s"%4$s%5$s%6$s></script></div>',
	get_block_wrapper_attributes(), // WP-generated attribute string (class/align), already escaped.
	esc_url( 'https://rigpolice.com/embed.js' ),
	esc_attr( $tool ),
	$pair, // ' data-from="x" data-to="y"' or '' (values escaped above).
	$width, // ' data-width="480"' or '' (cast to int).
	$dofollow // Literal ' data-dofollow' or '' (no user input).
);
