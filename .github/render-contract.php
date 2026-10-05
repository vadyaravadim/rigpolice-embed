<?php
function rpe_render( array $attrs ) {
	return do_blocks( '<!-- wp:rigpolice/embed ' . wp_json_encode( $attrs ) . ' /-->' );
}
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



$html = rpe_render( array( 'tool' => '' ) );
rpe_ok( '' === trim( $html ), 'empty tool renders nothing', $html );



$html = rpe_render( array( 'tool' => 'test-tool', 'anchor' => 'Legacy keyword anchor' ) );
rpe_ok( false !== strpos( $html, 'src="https://rigpolice.com/embed/test-tool.js"' ), 'emits the per-tool loader', $html );
rpe_ok( false === strpos( $html, 'data-anchor' ), 'a legacy anchor attribute is never emitted, the loader owns the brand', $html );
rpe_ok( false !== strpos( $html, 'async' ), 'loader is async', $html );



rpe_ok( false !== strpos( $html, 'data-nocredit' ), 'credit link is off by default (data-nocredit)', $html );

$html = rpe_render( array( 'tool' => 'test-tool', 'showcredit' => true ) );
rpe_ok( false === strpos( $html, 'data-nocredit' ), 'showcredit drops data-nocredit', $html );



$html = rpe_render( array( 'tool' => 'test-converter', 'from' => 'game-a', 'to' => 'game-b' ) );
rpe_ok( false !== strpos( $html, 'data-from="game-a"' ), 'distinct pair emits data-from', $html );
rpe_ok( false !== strpos( $html, 'data-to="game-b"' ), 'distinct pair emits data-to', $html );

$html = rpe_render( array( 'tool' => 'test-converter', 'from' => 'game-a', 'to' => 'game-a' ) );
rpe_ok( false === strpos( $html, 'data-from' ), 'identical pair emits no data-from', $html );

$html = rpe_render( array( 'tool' => 'test-converter', 'from' => 'game-a', 'to' => '' ) );
rpe_ok( false === strpos( $html, 'data-from' ), 'half pair (to empty) emits no data-from', $html );



$html = rpe_render( array( 'tool' => 'test-tool', 'width' => 640 ) );
rpe_ok( false !== strpos( $html, 'data-width="640"' ), 'width emits data-width', $html );

$html = rpe_render( array( 'tool' => 'test-tool' ) );
rpe_ok( false === strpos( $html, 'data-width' ), 'absent width emits no data-width', $html );



$html = rpe_render( array( 'tool' => 'x" onload="alert(1)', 'from' => 'a" onload="alert(2)', 'to' => 'game-b' ) );
rpe_ok( false === strpos( $html, 'onload="alert(1)"' ), 'quote in tool cannot break out of the attribute', $html );
rpe_ok( false === strpos( $html, 'onload="alert(2)"' ), 'quote in a game cannot break out of data-from', $html );
rpe_ok( false !== strpos( $html, 'data-from="a&quot;' ), 'quotes in data-from are escaped', $html );

$tally = rpe_ok( null );
echo "\n{$tally['passed']} passed, {$tally['failed']} failed\n";
exit( $tally['failed'] > 0 ? 1 : 0 );
