<?php

$root = dirname( __DIR__ );

$files = array();
foreach ( array( '*.php', '.github/*.php', '.wp-env/*.php' ) as $glob ) {
	$files = array_merge( $files, glob( $root . '/' . $glob ) ?: array() );
}
sort( $files );

$fix      = in_array( '--fix', $argv, true );
$failures = array();

foreach ( $files as $file ) {
	$rel    = ltrim( str_replace( $root, '', $file ), '/' );
	$src    = file_get_contents( $file );
	$tokens = token_get_all( $src );
	$out    = '';

	foreach ( $tokens as $token ) {
		if ( ! is_array( $token ) ) {
			$out .= $token;
			continue;
		}
		list( $id, $text, $line ) = $token;
		$is_comment               = ( T_COMMENT === $id || T_DOC_COMMENT === $id );

		if ( ! $is_comment || allowed( $text ) ) {
			$out .= $text;
			continue;
		}

		if ( ! $fix ) {
			$first      = trim( strtok( $text, "\n" ) );
			$failures[] = sprintf( '%s:%d  %s', $rel, $line, mb_substr( $first, 0, 70 ) );
			continue;
		}

		$owns_line = (bool) preg_match( '/(^|\n)[ \t]*$/', $out );
		$out       = preg_replace( '/[ \t]+$/', '', $out );

		if ( T_COMMENT === $id ) {
			if ( ! $owns_line ) {
				$out .= "\n";
			}
		} elseif ( $owns_line ) {
			$out = preg_replace( '/\n$/', '', $out );
		}
	}

	if ( $fix && $out !== $src ) {
		file_put_contents( $file, $out );
	}
}

if ( $failures ) {
	fwrite( STDERR, "PHP comments are not allowed. Put the WHY in .claude/rules/ or CLAUDE.md.\n\n" );
	foreach ( $failures as $f ) {
		fwrite( STDERR, '  ' . $f . "\n" );
	}
	fwrite( STDERR, sprintf( "\n%d comment(s).\n", count( $failures ) ) );
	exit( 1 );
}

printf( "no-comments: %d PHP file(s) clean.\n", count( $files ) );

function allowed( $text ) {
	if ( false !== strpos( $text, 'Plugin Name:' ) ) {
		return true;
	}
	if ( preg_match( '#^\s*(//|/\*|\#)\s*phpcs:#', $text ) ) {
		return true;
	}
	if ( preg_match( '#^/\*\s*translators:#', $text ) ) {
		return true;
	}
	return false;
}
