
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = process.env.WP_BASE_URL || 'http://localhost:9400';
const USER = 'admin';
const PASS = 'password';

const PROFILE = mkdtempSync( join( tmpdir(), 'rpe-editor-contract-' ) );

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

	async until( expression, what, ms = 30000 ) {
		const deadline = Date.now() + ms;
		for (;;) {
			try {
				if ( await this.eval( `try { return !! ( ${ expression } ); } catch ( e ) { return false; }` ) ) {
					return;
				}
			} catch {
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
		let port;
		for ( let i = 0; i < 150; i++ ) {
			try {
				port = readFileSync( join( PROFILE, 'DevToolsActivePort' ), 'utf8' ).split( '\n' )[ 0 ].trim();
				if ( port ) {
					break;
				}
			} catch {
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
			}
			await sleep( 200 );
		}
		if ( ! ws ) {
			throw new Error( 'Chrome DevTools endpoint never came up' );
		}

		cdp = new Cdp( ws );
		await cdp.send( 'Page.enable' );
		await cdp.send( 'Runtime.enable' );

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

		await cdp.send( 'Page.navigate', { url: `${ BASE }/wp-login.php` } );
		await cdp.until( 'document.querySelector("#user_login")', 'the login form' );
		await cdp.eval( `
			document.querySelector( '#user_login' ).value = ${ JSON.stringify( USER ) };
			document.querySelector( '#user_pass' ).value = ${ JSON.stringify( PASS ) };
			document.querySelector( '#loginform' ).submit();
			return true;
		` );
		await cdp.until( 'document.body.classList.contains("wp-admin")', 'wp-admin' );

		await cdp.send( 'Page.navigate', { url: `${ BASE }/wp-admin/post-new.php` } );
		await cdp.until( 'window.wp && wp.data && wp.data.select("core/block-editor")', 'the block editor' );
		await cdp.until( 'document.querySelector("iframe[name=\\"editor-canvas\\"]")', 'the editor canvas' );
		await cdp.eval( `
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

		const TOGGLE = 'iframe[name="editor-canvas"]';
		try {
			await cdp.until(
				`document.querySelector('${ TOGGLE }')?.contentDocument?.querySelector('.rigpolice-embed__field .components-button')`,
				'the tool picker button'
			);
		} catch ( e ) {
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
		await sleep( 700 );

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

		const before = await cdp.eval(
			`return document.querySelector('.rigpolice-embed__picker input[role=combobox]').getAttribute('aria-activedescendant');`
		);
		await cdp.key( 'ArrowDown', 'ArrowDown', 40 );
		await cdp.key( 'ArrowDown', 'ArrowDown', 40 );
		const after = await cdp.eval(
			`return document.querySelector('.rigpolice-embed__picker input[role=combobox]').getAttribute('aria-activedescendant');`
		);
		ok( before !== after, 'ArrowDown moves the highlighted suggestion', `${ before } -> ${ after }` );

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
