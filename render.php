<?php
/**
 * Server-side render for the rigpolice/embed block.
 *
 * Dynamic on purpose: emitting the <script> here (not from a static save()) means WP's KSES never strips
 * it for non-admin editors. It outputs the existing self-locating embed.js loader snippet — one
 * <script async> that injects the tool's iframe plus a crawlable brand link and auto-resizes. embed.js
 * owns the dimensions / allow flags / the brand link's rel from its own registry, so this carries
 * data-tool, the varied data-anchor, an opt-in data-nocredit (host-DOM credit link off by default per
 * WP.org Guideline 10), and the from/to game pair for the converter.
 *
 * @var array $attributes Block attributes (tool slug, anchor, showcredit flag, from/to game slugs, optional max width).
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

$anchor = isset( $attributes['anchor'] ) ? trim( (string) $attributes['anchor'] ) : '';
$from   = isset( $attributes['from'] ) ? trim( (string) $attributes['from'] ) : '';
$to     = isset( $attributes['to'] ) ? trim( (string) $attributes['to'] ) : '';
$width  = ( isset( $attributes['width'] ) && is_numeric( $attributes['width'] ) ) ? (int) $attributes['width'] : 0;

// Build the loader <script> attributes. wp_get_script_tag() escapes them all (esc_url for src, esc_attr
// for the rest, boolean attributes name-only), so the output below needs no manual escaping and carries no
// literal <script> for KSES to strip.
$script_attributes = array(
	'src'   => 'https://rigpolice.com/embed.js',
	'async' => true,
	// data-anchor is ALWAYS emitted: embed.js reads it with no fallback for the iframe title and (when the
	// credit link is shown) its text. Baked into the block at pick time from the /embeds.json catalog.
	'data-tool'   => $tool,
	'data-anchor' => $anchor,
);

// Converter game pair: only when both are set and differ (matching embed.js's own guard), so a
// non-converter tool (from/to reset to '' in the editor) never carries a stray pair.
if ( '' !== $from && '' !== $to && $from !== $to ) {
	$script_attributes['data-from'] = $from;
	$script_attributes['data-to']   = $to;
}

// Optional max-width override (integer px). embed.js caps the frame's max-width; height stays auto.
if ( $width > 0 ) {
	$script_attributes['data-width'] = (string) $width;
}

// Host-DOM credit link is OFF by default — WP.org Guideline 10 requires credit links to be opt-in.
// data-nocredit tells embed.js not to inject it; the "Show credit link" toggle drops the flag to opt in.
// The tool's own in-frame attribution still credits RigPolice, so brand visibility never depends on this.
if ( empty( $attributes['showcredit'] ) ) {
	$script_attributes['data-nocredit'] = true;
}

// The block wrapper output is WP-escaped; wp_get_script_tag() escapes the loader tag (esc_url on src,
// esc_attr on the rest). WPCS recognizes neither function as an escaping function, so the EscapeOutput
// sniff is suppressed for this single printf. The script is a per-block third-party loader carrying
// block-specific data-* attributes, so it's rendered here (not wp_enqueue_script()'d) — emitting it
// server-side, not from a static save(), also keeps WP's KSES from stripping it for non-admin editors.
// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped -- get_block_wrapper_attributes() + wp_get_script_tag() return WP-escaped output.
printf(
	'<div %1$s>%2$s</div>',
	get_block_wrapper_attributes(),
	wp_get_script_tag( $script_attributes )
);
// phpcs:enable WordPress.Security.EscapeOutput.OutputNotEscaped
