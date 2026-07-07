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

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

$tool = isset( $attributes['tool'] ) ? trim( (string) $attributes['tool'] ) : '';
if ( '' === $tool ) {
	return ''; // No tool picked yet — render nothing on the front end.
}

$from  = isset( $attributes['from'] ) ? trim( (string) $attributes['from'] ) : '';
$to    = isset( $attributes['to'] ) ? trim( (string) $attributes['to'] ) : '';
$width = ( isset( $attributes['width'] ) && is_numeric( $attributes['width'] ) ) ? (int) $attributes['width'] : 0;

// Assemble the loader's data-* attributes. Every value is escaped/cast HERE, so the printf below is safe.
$attrs = sprintf( ' data-tool="%s"', esc_attr( $tool ) );

// Converter game pair: only when both are set and differ (matching embed.js's own guard), so a
// non-converter tool (from/to reset to '' in the editor) never carries a stray pair.
if ( '' !== $from && '' !== $to && $from !== $to ) {
	$attrs .= sprintf( ' data-from="%s" data-to="%s"', esc_attr( $from ), esc_attr( $to ) );
}

// Optional max-width override (integer px). embed.js caps the frame's max-width; height stays auto.
if ( $width > 0 ) {
	$attrs .= sprintf( ' data-width="%d"', $width );
}

// dofollow opt-in (nofollow is embed.js's default). Literal, no user input.
if ( ! empty( $attributes['dofollow'] ) ) {
	$attrs .= ' data-dofollow';
}

// Dynamic render on purpose: printing the loader <script> server-side (not from a static save()) is what
// stops WP's KSES from stripping it. Every interpolated value is escaped/cast above and
// get_block_wrapper_attributes() returns WP-escaped output; wp_kses() can't be used here because it would
// strip the required <script> tag.
// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped, WordPress.WP.EnqueuedResources.NonEnqueuedScript
printf(
	'<div %1$s><script async src="%2$s"%3$s></script></div>',
	get_block_wrapper_attributes(),
	esc_url( 'https://rigpolice.com/embed.js' ),
	$attrs
);
// phpcs:enable WordPress.Security.EscapeOutput.OutputNotEscaped, WordPress.WP.EnqueuedResources.NonEnqueuedScript
