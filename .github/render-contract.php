<?php
/**
 * Render contract for the rigpolice/embed block — the regression gate.
 *
 * Runs inside wp-env (`wp eval-file`), so it exercises the REAL render.php through do_blocks() against a
 * real WordPress, not a mock. It pins the front-end output contract: what a reader actually receives is
 * whatever render.php emits (save() returns null), so a regression here is a regression that ships.
 *
 * Slugs are FICTIONAL on purpose. render.php never validates a slug — it passes it straight into
 * data-tool — so a real catalog slug would prove nothing extra while making the test fail whenever a tool
 * is renamed on rigpolice.com. Catalog liveness is a separate, non-blocking signal.
 *
 * Assertions match SUBSTRINGS, never the whole tag: wp_get_script_tag() sorts the attributes it emits
 * (async, data-anchor, data-nocredit, data-tool, src), and that order is core's business, not ours.
 *
 * @package RigPolice\Embed\Tests
 */

/**
 * Render a block with the given attributes through the real block machinery.
 *
 * @param array $attrs Block attributes.
 * @return string Rendered front-end HTML.
 */
function rpe_render( array $attrs ) {
	return do_blocks( '<!-- wp:rigpolice/embed ' . wp_json_encode( $attrs ) . ' /-->' );
}

/**
 * Assert a condition, printing a TAP-ish line either way.
 *
 * Tallies live in a static, NOT in globals: `wp eval-file` runs the file inside a function scope, so
 * top-level `$failures`/`$passes` are locals there and a `global` here would bind to empty globals — the
 * counts would stay 0 and the script would exit 0 no matter what failed (a test that cannot go red).
 *
 * @param bool|null $ok   Whether the assertion held; null just reports the tally.
 * @param string    $name What was being asserted.
 * @param string    $html The rendered output, printed on failure so CI shows what it actually got.
 * @return array{passed:int,failed:int} Running tally.
 */
function rpe_ok( $ok, $name = '', $html = '' ) {
	static $tally = array(
		'passed' => 0,
		'failed' => 0,
	);

	if ( null === $ok ) {
		return $tally;
	}

	if ( $ok ) {
		++$tally['passed'];
		echo "ok   - {$name}\n";
	} else {
		++$tally['failed'];
		echo "FAIL - {$name}\n";
		if ( '' !== $html ) {
			echo "       got: {$html}\n";
		}
	}

	return $tally;
}

// 1. No tool picked -> render nothing. An empty block must not leak a bare wrapper div or a loader with an
// empty data-tool (embed.js would have no tool to mount).
$html = rpe_render( array( 'tool' => '' ) );
rpe_ok( '' === trim( $html ), 'empty tool renders nothing', $html );

// 2. The loader itself: the embed.js script, the picked tool, and the anchor embed.js reads with no
// fallback. If any of these three vanish, the widget silently never appears on the page.
$html = rpe_render( array( 'tool' => 'test-tool', 'anchor' => 'Test Tool' ) );
rpe_ok( false !== strpos( $html, 'src="https://rigpolice.com/embed.js"' ), 'emits the embed.js loader', $html );
rpe_ok( false !== strpos( $html, 'data-tool="test-tool"' ), 'carries data-tool', $html );
rpe_ok( false !== strpos( $html, 'data-anchor="Test Tool"' ), 'carries data-anchor', $html );
rpe_ok( false !== strpos( $html, 'async' ), 'loader is async', $html );

// 3. Credit link is OPT-IN (WP.org Guideline 10). Default off => data-nocredit present. A regression that
// drops data-nocredit ships an unsolicited credit link and is a guideline violation, not a cosmetic bug.
rpe_ok( false !== strpos( $html, 'data-nocredit' ), 'credit link is off by default (data-nocredit)', $html );

$html = rpe_render( array( 'tool' => 'test-tool', 'anchor' => 'A', 'showcredit' => true ) );
rpe_ok( false === strpos( $html, 'data-nocredit' ), 'showcredit drops data-nocredit', $html );

// 4. Converter game pair: emitted only when both are set AND differ — the same guard embed.js applies. A
// stray or half pair desyncs the block from the loader.
$html = rpe_render( array( 'tool' => 'test-converter', 'anchor' => 'A', 'from' => 'game-a', 'to' => 'game-b' ) );
rpe_ok( false !== strpos( $html, 'data-from="game-a"' ), 'distinct pair emits data-from', $html );
rpe_ok( false !== strpos( $html, 'data-to="game-b"' ), 'distinct pair emits data-to', $html );

$html = rpe_render( array( 'tool' => 'test-converter', 'anchor' => 'A', 'from' => 'game-a', 'to' => 'game-a' ) );
rpe_ok( false === strpos( $html, 'data-from' ), 'identical pair emits no data-from', $html );

$html = rpe_render( array( 'tool' => 'test-converter', 'anchor' => 'A', 'from' => 'game-a', 'to' => '' ) );
rpe_ok( false === strpos( $html, 'data-from' ), 'half pair (to empty) emits no data-from', $html );

// 5. Optional max-width override. Absent attribute must not emit the attribute at all — embed.js falls back
// to the tool's own default width only when data-width is missing.
$html = rpe_render( array( 'tool' => 'test-tool', 'anchor' => 'A', 'width' => 640 ) );
rpe_ok( false !== strpos( $html, 'data-width="640"' ), 'width emits data-width', $html );

$html = rpe_render( array( 'tool' => 'test-tool', 'anchor' => 'A' ) );
rpe_ok( false === strpos( $html, 'data-width' ), 'absent width emits no data-width', $html );

// 6. Escaping. Attributes are author-controlled, so a quote must never break out of the attribute and turn
// into markup. wp_get_script_tag() esc_attr's them; this pins that it stays that way.
$html = rpe_render( array( 'tool' => 'x" onload="alert(1)', 'anchor' => 'a"b' ) );
rpe_ok( false === strpos( $html, 'onload="alert(1)"' ), 'quote in tool cannot break out of the attribute', $html );
rpe_ok( false !== strpos( $html, '&quot;' ), 'quotes are escaped', $html );

// 7. data-anchor is emitted even when EMPTY. embed.js reads it with no fallback, and an empty anchor is
// reachable: a tool dropped from the catalog has no row to bake one from. Every OTHER assertion above hands
// render.php a non-empty anchor, so on its own the suite stays green against a regression that wraps the
// attribute in `if ( '' !== $anchor )` — the attribute would vanish and nothing here would notice.
$html = rpe_render( array( 'tool' => 'test-tool' ) );
rpe_ok( false !== strpos( $html, 'data-anchor=""' ), 'data-anchor is emitted even when empty', $html );

$tally = rpe_ok( null );
echo "\n{$tally['passed']} passed, {$tally['failed']} failed\n";
exit( $tally['failed'] > 0 ? 1 : 0 );
