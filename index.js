/**
 * RigPolice Embed block — editor script (zero-build: plain wp.* globals, no JSX/bundler).
 *
 * The block is DYNAMIC: save() returns null and render.php emits the embed.js <script> server-side, so
 * WP's KSES never strips it (a static save() output would be filtered for non-admin editors).
 *
 * The tool list is fetched LIVE from the site's /embeds.json, and the sensitivity converter's game list
 * from /games.json (both single-source catalogs), so a tool or game added to RigPolice appears here
 * automatically — the block and the site can't drift. Both endpoints send Access-Control-Allow-Origin: *
 * for exactly this cross-origin fetch from wp-admin.
 */
( function ( wp ) {
	var registerBlockType = wp.blocks.registerBlockType;
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var useEffect = wp.element.useEffect;
	var Fragment = wp.element.Fragment;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var cmp = wp.components;
	var __ = wp.i18n.__;

	var EMBEDS_URL = 'https://rigpolice.com/embeds.json';
	var GAMES_URL = 'https://rigpolice.com/games.json';
	var LABEL = __( 'RigPolice Tool', 'rigpolice-embed' );

	function fetchJson( url, onOk, onErr ) {
		fetch( url )
			.then( function ( r ) {
				if ( ! r.ok ) {
					throw new Error( 'HTTP ' + r.status );
				}
				return r.json();
			} )
			.then( function ( data ) {
				onOk( Array.isArray( data ) ? data : [] );
			} )
			.catch( onErr );
	}

	registerBlockType( 'rigpolice/embed', {
		edit: function ( props ) {
			var tool = props.attributes.tool;
			var dofollow = props.attributes.dofollow;
			var from = props.attributes.from;
			var to = props.attributes.to;
			var width = props.attributes.width;
			var setAttributes = props.setAttributes;

			var toolsState = useState( null ); // null = loading, array = loaded
			var tools = toolsState[ 0 ];
			var setTools = toolsState[ 1 ];
			var toolsErrState = useState( false );
			var toolsFailed = toolsErrState[ 0 ];
			var setToolsFailed = toolsErrState[ 1 ];

			var gamesState = useState( null );
			var games = gamesState[ 0 ];
			var setGames = gamesState[ 1 ];
			var gamesErrState = useState( false );
			var gamesFailed = gamesErrState[ 0 ];
			var setGamesFailed = gamesErrState[ 1 ];

			useEffect( function () {
				var alive = true;
				fetchJson(
					EMBEDS_URL,
					function ( d ) {
						if ( alive ) {
							setTools( d );
						}
					},
					function () {
						if ( alive ) {
							setToolsFailed( true );
						}
					}
				);
				fetchJson(
					GAMES_URL,
					function ( d ) {
						if ( alive ) {
							setGames( d );
						}
					},
					function () {
						if ( alive ) {
							setGamesFailed( true );
						}
					}
				);
				return function () {
					alive = false;
				};
			}, [] );

			var blockProps = useBlockProps();

			// Sidebar: a Max width control (height is auto — the frame resizes to its content) and the
			// dofollow opt-in (nofollow by default, matching the on-site embed modal).
			var inspector = el(
				InspectorControls,
				null,
				el(
					cmp.PanelBody,
					{ title: __( 'Size', 'rigpolice-embed' ), initialOpen: true },
					el( cmp.RangeControl, {
						label: __( 'Max width (px)', 'rigpolice-embed' ),
						value: width,
						onChange: function ( value ) {
							setAttributes( { width: value } );
						},
						min: 280,
						max: 1200,
						allowReset: true,
						help: __(
							"Leave empty for the tool's default width. The frame is always responsive and its height fits the content automatically.",
							'rigpolice-embed'
						),
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
					} )
				),
				el(
					cmp.PanelBody,
					{ title: __( 'Link settings', 'rigpolice-embed' ), initialOpen: false },
					el( cmp.ToggleControl, {
						label: __( 'Dofollow credit link', 'rigpolice-embed' ),
						help: __(
							'The credit link under the tool is nofollow by default. Turn this on to make it dofollow.',
							'rigpolice-embed'
						),
						checked: !! dofollow,
						onChange: function ( value ) {
							setAttributes( { dofollow: value } );
						},
						__nextHasNoMarginBottom: true,
					} )
				)
			);

			var body;
			if ( toolsFailed ) {
				body = el( cmp.Placeholder, {
					icon: 'screenoptions',
					label: LABEL,
					instructions: __(
						'Could not load the tool list from rigpolice.com. Check the connection and reload the editor.',
						'rigpolice-embed'
					),
				} );
			} else if ( tools === null ) {
				body = el(
					cmp.Placeholder,
					{ icon: 'screenoptions', label: LABEL },
					el( cmp.Spinner )
				);
			} else {
				var toolOptions = [
					{ label: __( 'Select a tool…', 'rigpolice-embed' ), value: '' },
				].concat(
					tools.map( function ( t ) {
						return { label: t.title + ' (' + t.category + ')', value: t.slug };
					} )
				);

				var selected = null;
				for ( var i = 0; i < tools.length; i++ ) {
					if ( tools[ i ].slug === tool ) {
						selected = tools[ i ];
						break;
					}
				}

				var instructions = selected
					? __( 'Default size:', 'rigpolice-embed' ) +
					  ' ' +
					  selected.width +
					  ' x ' +
					  selected.height +
					  ' px. ' +
					  __( 'The frame auto-resizes to fit your page.', 'rigpolice-embed' )
					: __(
							'Pick a tool to embed. It loads in its own frame and resizes to fit.',
							'rigpolice-embed'
					  );

				var toolSelect = el( cmp.SelectControl, {
					label: __( 'Tool', 'rigpolice-embed' ),
					value: tool,
					options: toolOptions,
					// Reset the game pair when the tool changes — from/to only apply to the converter.
					onChange: function ( value ) {
						setAttributes( { tool: value, from: '', to: '' } );
					},
					__nextHasNoMarginBottom: true,
				} );

				// The converter (preset === 'pair') gets a From/To game picker, populated from games.json.
				var pairPicker = null;
				if ( selected && selected.preset === 'pair' ) {
					if ( gamesFailed ) {
						pairPicker = el(
							'p',
							{ style: { marginTop: '12px' } },
							__(
								'Could not load the game list; the converter will embed without a preset pair.',
								'rigpolice-embed'
							)
						);
					} else if ( games === null ) {
						pairPicker = el( cmp.Spinner );
					} else {
						var gameOptions = [
							{ label: __( 'Any (no preset)', 'rigpolice-embed' ), value: '' },
						].concat(
							games.map( function ( g ) {
								return { label: g.name, value: g.slug };
							} )
						);
						pairPicker = el(
							Fragment,
							null,
							el( cmp.SelectControl, {
								label: __( 'From game', 'rigpolice-embed' ),
								value: from,
								options: gameOptions,
								onChange: function ( value ) {
									setAttributes( { from: value } );
								},
								__nextHasNoMarginBottom: true,
							} ),
							el( cmp.SelectControl, {
								label: __( 'To game', 'rigpolice-embed' ),
								value: to,
								options: gameOptions,
								onChange: function ( value ) {
									setAttributes( { to: value } );
								},
								__nextHasNoMarginBottom: true,
							} )
						);
					}
				}

				body = el(
					cmp.Placeholder,
					{ icon: 'screenoptions', label: LABEL, instructions: instructions },
					toolSelect,
					pairPicker
				);
			}

			return el( Fragment, null, inspector, el( 'div', blockProps, body ) );
		},

		// Dynamic — render.php outputs the embed.js <script> on the server (KSES-safe).
		save: function () {
			return null;
		},
	} );
} )( window.wp );
