/**
 * Editor contract for the rigpolice/embed block — the regression gate render-contract.php CANNOT be.
 *
 * render-contract.php asserts render.php's OUTPUT. It says nothing about index.js, and index.js is where
 * this block actually lives: it drives core's Dropdown / Popover / ComboboxControl, whose behaviour is
 * WordPress-VERSION dependent. 1.4.8 shipped `focusOnMount: 'firstInputElement'` — a value that only exists
 * in WordPress 7.0 — while the plugin declares `Requires at least: 6.3`. On every older release the popover
 * focused its own container, the suggestion list never expanded, and the arrow keys the popover exists for
 * did nothing. Every PHP gate stayed green, because none of them opens the editor.
 *
 * So: boot the REAL editor on each WordPress we promise to support and drive the picker with REAL key
 * events. Run under ci.yml's matrix (WP_ENV_CORE), which is what turns this from one check into a
 * statement about the whole support range.
 *
 * Zero dependencies on purpose (the plugin has none, and CI should not need a browser SDK): headless Chrome
 * over the DevTools protocol, on Node's built-in WebSocket.
 *
 * The catalogs are STUBBED at the network layer. The editor fills its pickers from rigpolice.com, and a gate
 * that fails when a live site hiccups is a gate people learn to ignore — this asserts OUR code against
 * CORE's components, so the catalog is a fixture, not a dependency. (Catalog liveness is a separate,
 * non-blocking signal in ci.yml.)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.WP_BASE_URL || 'http://localhost:9400';
const USER = 'admin';
const PASS = 'password';

// A THROWAWAY profile and a Chrome-chosen port, not a fixed one. With a fixed port a leftover browser from
// an earlier run is silently attached to instead of the one just spawned, and the script then waits forever
// on a page that will never navigate. Chrome writes the port it actually bound to into DevToolsActivePort.
const PROFILE = mkdtempSync( join( tmpdir(), 'rpe-editor-contract-' ) );

// Two tools in one category and one in another, so the section filter has something to narrow, plus the
// converter (preset: 'pair') so the game pickers render. Anchors are what the editor bakes into the block.
const EMBEDS = [
	{ slug: 'mouse-test', title: 'Mouse Test', category: 'mouse', anchor: 'Mouse tester', width: 640, height: 480 },
	{ slug: 'cps-test', title: 'CPS Test', category: 'mouse', anchor: 'CPS checker', width: 640, height: 480 },
	{ slug: 'key-test', title: 'Keyboard Test', category: 'keyboard', anchor: 'Keyboard tester', width: 640, height: 480 },
	{ slug: 'sens-converter', title: 'Sensitivity Converter', category: 'mouse', anchor: 'Converter', preset: 'pair', width: 640, height: 480 },
];
const GAMES = [
	{ slug: 'csgo', name: 'CS:GO' },
	{ slug: 'valorant', name: 'Valorant' },
];

const CHROME =
	process.env.CHROME_BIN ||
	[
		'/usr/bin/google-chrome',
		'/usr/bin/chromium-browser',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	].find( existsSync );

let passed = 0;
let failed = 0;

function ok( cond, name, detail = '' ) {
	if ( cond ) {
		passed++;
		console.log( `ok   - ${ name }` );
	} else {
		failed++;
		console.log( `FAIL - ${ name }` );
		if ( detail ) {
			console.log( `       got: ${ detail }` );
		}
	}
}

/** Minimal CDP client: one WebSocket, id-matched replies, event listeners. */
class Cdp {
	constructor( ws ) {
		this.ws = ws;
		this.id = 0;
		this.pending = new Map();
		this.listeners = new Map();
		ws.addEventListener( 'message', ( e ) => {
			const msg = JSON.parse( e.data );
			if ( msg.id && this.pending.has( msg.id ) ) {
				const { resolve, reject } = this.pending.get( msg.id );
				this.pending.delete( msg.id );
				msg.error ? reject( new Error( JSON.stringify( msg.error ) ) ) : resolve( msg.result );
			} else if ( msg.method ) {
				( this.listeners.get( msg.method ) || [] ).forEach( ( fn ) => fn( msg.params ) );
			}
		} );
	}

	send( method, params = {} ) {
		const id = ++this.id;
		this.ws.send( JSON.stringify( { id, method, params } ) );
		return new Promise( ( resolve, reject ) => this.pending.set( id, { resolve, reject } ) );
	}

	on( method, fn ) {
		this.listeners.set( method, ( this.listeners.get( method ) || [] ).concat( fn ) );
	}

	/** Evaluate in the page and return the value (throws on a page-side exception). */
	async eval( expression ) {
		const r = await this.send( 'Runtime.evaluate', {
			expression: `(async () => { ${ expression } })()`,
			awaitPromise: true,
			returnByValue: true,
		} );
		if ( r.exceptionDetails ) {
			throw new Error( r.exceptionDetails.exception?.description || 'page exception' );
		}
		return r.result.value;
	}

	/** Poll the page until `expression` returns truthy. A mid-navigation page throws (no document.body
	 * yet, wp not defined yet) — that is just "not ready", so swallow it and keep polling. */
	async until( expression, what, ms = 30000 ) {
		const deadline = Date.now() + ms;
		for (;;) {
			try {
				if ( await this.eval( `try { return !! ( ${ expression } ); } catch ( e ) { return false; }` ) ) {
					return;
				}
			} catch {
				/* navigating — the execution context went away */
			}
			if ( Date.now() > deadline ) {
				throw new Error( `timed out waiting for ${ what }` );
			}
			await sleep( 200 );
		}
	}

	async key( key, code, keyCode ) {
		for ( const type of [ 'keyDown', 'keyUp' ] ) {
			await this.send( 'Input.dispatchKeyEvent', {
				type,
				key,
				code,
				windowsVirtualKeyCode: keyCode,
				nativeVirtualKeyCode: keyCode,
			} );
		}
		await sleep( 120 );
	}

	/** Real mouse press/release at the centre of `selector` (a top-document element). */
	async click( selector ) {
		const box = await this.eval( `
			const el = document.querySelector( ${ JSON.stringify( selector ) } );
			if ( ! el ) { return null; }
			const r = el.getBoundingClientRect();
			return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
		` );
		if ( ! box ) {
			throw new Error( `no element to click: ${ selector }` );
		}
		for ( const type of [ 'mousePressed', 'mouseReleased' ] ) {
			await this.send( 'Input.dispatchMouseEvent', {
				type,
				x: box.x,
				y: box.y,
				button: 'left',
				clickCount: 1,
			} );
		}
		await sleep( 400 );
	}
}

async function main() {
	if ( ! CHROME ) {
		console.log( 'FAIL - no Chrome binary found (set CHROME_BIN)' );
		process.exit( 1 );
	}

	// A gate that HANGS is worse than one that fails: CI would sit on it until the job timeout with no
	// output. Cap the whole run.
	const watchdog = setTimeout( () => {
		console.log( 'FAIL - harness timed out' );
		console.log( `\n${ passed } passed, ${ failed + 1 } failed` );
		process.exit( 1 );
	}, 240000 );
	watchdog.unref();

	const chrome = spawn(
		CHROME,
		[
			'--headless=new',
			'--remote-debugging-port=0',
			`--user-data-dir=${ PROFILE }`,
			'--no-first-run',
			'--no-sandbox',
			'--disable-gpu',
			'--disable-dev-shm-usage',
			'--window-size=1400,1200',
			'about:blank',
		],
		{ stdio: 'ignore' }
	);

	let cdp;
	try {
		// Chrome reports the port it bound to here once it is listening.
		let port;
		for ( let i = 0; i < 150; i++ ) {
			try {
				port = readFileSync( join( PROFILE, 'DevToolsActivePort' ), 'utf8' ).split( '\n' )[ 0 ].trim();
				if ( port ) {
					break;
				}
			} catch {
				/* not written yet */
			}
			await sleep( 200 );
		}
		if ( ! port ) {
			throw new Error( 'Chrome never reported a DevTools port' );
		}

		let ws;
		for ( let i = 0; i < 100; i++ ) {
			try {
				const targets = await fetch( `http://127.0.0.1:${ port }/json/list` ).then( ( r ) => r.json() );
				const page = targets.find( ( t ) => t.type === 'page' );
				if ( page?.webSocketDebuggerUrl ) {
					ws = new WebSocket( page.webSocketDebuggerUrl );
					await new Promise( ( res, rej ) => {
						ws.addEventListener( 'open', res, { once: true } );
						ws.addEventListener( 'error', rej, { once: true } );
					} );
					break;
				}
			} catch {
				/* not up yet */
			}
			await sleep( 200 );
		}
		if ( ! ws ) {
			throw new Error( 'Chrome DevTools endpoint never came up' );
		}

		cdp = new Cdp( ws );
		await cdp.send( 'Page.enable' );
		await cdp.send( 'Runtime.enable' );

		// Serve the catalogs from the fixtures above, so the gate tests the BLOCK, not rigpolice.com.
		await cdp.send( 'Fetch.enable', {
			patterns: [ { urlPattern: '*rigpolice.com/*.json*' } ],
		} );
		cdp.on( 'Fetch.requestPaused', async ( { requestId, request } ) => {
			const body = request.url.includes( 'games.json' ) ? GAMES : EMBEDS;
			await cdp.send( 'Fetch.fulfillRequest', {
				requestId,
				responseCode: 200,
				responseHeaders: [
					{ name: 'Content-Type', value: 'application/json' },
					{ name: 'Access-Control-Allow-Origin', value: '*' },
				],
				body: Buffer.from( JSON.stringify( body ) ).toString( 'base64' ),
			} );
		} );

		// Log in.
		await cdp.send( 'Page.navigate', { url: `${ BASE }/wp-login.php` } );
		await cdp.until( 'document.querySelector("#user_login")', 'the login form' );
		await cdp.eval( `
			document.querySelector( '#user_login' ).value = ${ JSON.stringify( USER ) };
			document.querySelector( '#user_pass' ).value = ${ JSON.stringify( PASS ) };
			document.querySelector( '#loginform' ).submit();
			return true;
		` );
		await cdp.until( 'document.body.classList.contains("wp-admin")', 'wp-admin' );

		// Open a fresh post and insert the block. Driving wp.data beats clicking the inserter.
		await cdp.send( 'Page.navigate', { url: `${ BASE }/wp-admin/post-new.php` } );
		await cdp.until( 'window.wp && wp.data && wp.data.select("core/block-editor")', 'the block editor' );
		// The canvas iframe is the signal that the editor has actually MOUNTED. Dispatching insertBlock
		// before that lands in a store the editor then re-initialises from the post, and the block vanishes.
		await cdp.until( 'document.querySelector("iframe[name=\\"editor-canvas\\"]")', 'the editor canvas' );
		await cdp.eval( `
			// The welcome modal steals focus and covers the canvas.
			wp.data.dispatch( 'core/preferences' )?.set( 'core/edit-post', 'welcomeGuide', false );
			return true;
		` );
		await cdp.until(
			`( () => {
				const sel = wp.data.select( 'core/block-editor' );
				if ( sel.getBlocks().some( ( b ) => b.name === 'rigpolice/embed' ) ) { return true; }
				wp.data.dispatch( 'core/block-editor' ).insertBlock(
					wp.blocks.createBlock( 'rigpolice/embed', {} )
				);
				return false;
			} )()`,
			'the block to be inserted'
		);

		// The pickers live in the canvas iframe; the popover they open lives in the TOP document.
		const TOGGLE = 'iframe[name="editor-canvas"]';
		try {
			await cdp.until(
				`document.querySelector('${ TOGGLE }')?.contentDocument?.querySelector('.rigpolice-embed__field .components-button')`,
				'the tool picker button'
			);
		} catch ( e ) {
			// Say WHY, instead of just "timed out": almost always either the block never registered or the
			// catalog stub did not take (the Placeholder then shows a spinner or the load-failure notice).
			const why = await cdp.eval( `
				const f = document.querySelector( 'iframe[name="editor-canvas"]' );
				const doc = f && f.contentDocument;
				const block = doc && doc.querySelector( '.wp-block-rigpolice-embed' );
				return {
					blockRegistered: !! wp.blocks.getBlockType( 'rigpolice/embed' ),
					blocksInEditor: wp.data.select( 'core/block-editor' ).getBlocks().map( ( b ) => b.name ),
					canvasFound: !! doc,
					blockInCanvas: !! block,
					placeholder: block ? block.innerText.slice( 0, 300 ) : null,
				};
			` );
			throw new Error( `${ e.message } — ${ JSON.stringify( why ) }` );
		}

		// Click the toggle. It is inside the iframe, so offset by the frame's own position.
		const clicked = await cdp.eval( `
			const f = document.querySelector( 'iframe[name="editor-canvas"]' );
			const fr = f.getBoundingClientRect();
			const b = f.contentDocument.querySelector( '.rigpolice-embed__field .components-button' );
			const r = b.getBoundingClientRect();
			return { x: fr.x + r.x + r.width / 2, y: fr.y + r.y + r.height / 2 };
		` );
		for ( const type of [ 'mousePressed', 'mouseReleased' ] ) {
			await cdp.send( 'Input.dispatchMouseEvent', {
				type,
				x: clicked.x,
				y: clicked.y,
				button: 'left',
				clickCount: 1,
			} );
		}
		await sleep( 700 ); // useFocusOnMount focuses on a setTimeout(0); give the popover a beat.

		// 1. THE regression. The popover's first tabbable is a SECTION CHIP (the caption row comes first),
		// so core's own focusOnMount would land there. Focus must be in the SEARCH FIELD instead — that is
		// what makes ComboboxControl expand its list, and it is exactly what broke on WP < 7.0 in 1.4.8.
		const focus = await cdp.eval( `
			const pop = document.querySelector( '.rigpolice-embed__picker' );
			const a = document.activeElement;
			const tabbables = pop ? [ ...pop.querySelectorAll( 'button, input, [tabindex]:not([tabindex="-1"])' ) ] : [];
			return {
				popover: !! pop,
				tag: a && a.tagName,
				role: a && a.getAttribute( 'role' ),
				firstTabbableIsChip: !! ( tabbables[ 0 ] && tabbables[ 0 ].classList.contains( 'rigpolice-embed__section' ) ),
				options: pop ? pop.querySelectorAll( '[role="option"]' ).length : 0,
			};
		` );
		ok( focus.popover, 'the tool picker opens a popover', JSON.stringify( focus ) );
		ok(
			focus.tag === 'INPUT' && focus.role === 'combobox',
			'focus lands in the search field, not on a section chip',
			JSON.stringify( focus )
		);
		ok(
			focus.firstTabbableIsChip,
			'(the test discriminates: a chip really is the popover\'s first tabbable)',
			JSON.stringify( focus )
		);
		ok( focus.options > 0, 'the suggestion list is expanded on open, with no typing', JSON.stringify( focus ) );

		// 2. Arrow keys move the highlight — the whole reason the pickers moved into a popover.
		const before = await cdp.eval(
			`return document.querySelector('.rigpolice-embed__picker input[role=combobox]').getAttribute('aria-activedescendant');`
		);
		await cdp.key( 'ArrowDown', 'ArrowDown', 40 );
		await cdp.key( 'ArrowDown', 'ArrowDown', 40 );
		const after = await cdp.eval(
			`return document.querySelector('.rigpolice-embed__picker input[role=combobox]').getAttribute('aria-activedescendant');`
		);
		ok( before !== after, 'ArrowDown moves the highlighted suggestion', `${ before } -> ${ after }` );

		// 3. Enter commits, and the picked tool's anchor is baked in (render.php always emits data-anchor,
		// and embed.js reads it with no fallback).
		await cdp.key( 'Enter', 'Enter', 13 );
		await sleep( 500 );
		const attrs = await cdp.eval( `
			const b = wp.data.select( 'core/block-editor' ).getBlocks().find( ( x ) => x.name === 'rigpolice/embed' );
			return b ? b.attributes : null;
		` );
		ok( !! attrs && !! attrs.tool, 'Enter commits the highlighted tool', JSON.stringify( attrs ) );
		ok( !! attrs && !! attrs.anchor, 'the picked tool bakes its anchor into the block', JSON.stringify( attrs ) );

		console.log( `\n${ passed } passed, ${ failed } failed` );
		process.exit( failed > 0 ? 1 : 0 );
	} catch ( e ) {
		console.log( `FAIL - harness error: ${ e.message }` );
		console.log( `\n${ passed } passed, ${ failed + 1 } failed` );
		process.exit( 1 );
	} finally {
		chrome.kill( 'SIGKILL' );
		rmSync( PROFILE, { recursive: true, force: true } );
	}
}

main();
