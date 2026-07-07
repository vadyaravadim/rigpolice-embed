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

	// Look up a catalog row by slug. Reused by the current-selection read and the picker's onChange,
	// which bakes the row's anchor into the block (embed.js reads data-anchor with no fallback).
	function findTool( list, slug ) {
		for ( var i = 0; i < list.length; i++ ) {
			if ( list[ i ].slug === slug ) {
				return list[ i ];
			}
		}
		return null;
	}

	registerBlockType( 'rigpolice/embed', {
		edit: function ( props ) {
			var tool = props.attributes.tool;
			var showcredit = props.attributes.showcredit;
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

			// Sidebar: a Max width control (height is auto — the frame resizes to its content).
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
					{ title: __( 'Credit link', 'rigpolice-embed' ), initialOpen: false },
					el( cmp.ToggleControl, {
						label: __( 'Show credit link to RigPolice', 'rigpolice-embed' ),
						help: __(
							'Off by default. Turn on to add a small dofollow credit link under the tool. The tool always shows RigPolice branding inside its own frame.',
							'rigpolice-embed'
						),
						checked: !! showcredit,
						onChange: function ( value ) {
							setAttributes( { showcredit: value } );
						},
						__nextHasNoMarginBottom: true,
					} )
				)
			);

			var body;
			if ( toolsFailed ) {
				body = el( cmp.Placeholder, {
					label: LABEL,
					instructions: __(
						'Could not load the tool list from rigpolice.com. Check the connection and reload the editor.',
						'rigpolice-embed'
					),
				} );
			} else if ( tools === null ) {
				body = el(
					cmp.Placeholder,
					{ label: LABEL },
					el( cmp.Spinner )
				);
			} else {
				var toolOptions = tools.map( function ( t ) {
					return { label: t.title + ' (' + t.category + ')', value: t.slug };
				} );

				var selected = findTool( tools, tool );

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

				// ComboboxControl (not SelectControl): a searchable input — the tool list is long, so
				// filter-as-you-type beats scrolling. Built-in label filtering; reset clears to null.
				var toolSelect = el( cmp.ComboboxControl, {
					label: __( 'Tool', 'rigpolice-embed' ),
					value: tool,
					options: toolOptions,
					placeholder: __( 'Search tools…', 'rigpolice-embed' ),
					// Bake the picked tool's anchor into the block (embed.js reads data-anchor with no
					// fallback) and reset the game pair — from/to only apply to the converter.
					onChange: function ( value ) {
						var picked = findTool( tools, value );
						setAttributes( {
							tool: value || '',
							anchor: picked ? picked.anchor : '',
							from: '',
							to: '',
						} );
					},
					__next40pxDefaultSize: true,
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
						var gameOptions = games.map( function ( g ) {
							return { label: g.name, value: g.slug };
						} );
						// Searchable pair pickers; the reset (X) clears back to "any game, no preset".
						pairPicker = el(
							Fragment,
							null,
							el( cmp.ComboboxControl, {
								label: __( 'From game', 'rigpolice-embed' ),
								value: from,
								options: gameOptions,
								placeholder: __( 'Any game (no preset)', 'rigpolice-embed' ),
								onChange: function ( value ) {
									setAttributes( { from: value || '' } );
								},
								__next40pxDefaultSize: true,
								__nextHasNoMarginBottom: true,
							} ),
							el( cmp.ComboboxControl, {
								label: __( 'To game', 'rigpolice-embed' ),
								value: to,
								options: gameOptions,
								placeholder: __( 'Any game (no preset)', 'rigpolice-embed' ),
								onChange: function ( value ) {
									setAttributes( { to: value || '' } );
								},
								__next40pxDefaultSize: true,
								__nextHasNoMarginBottom: true,
							} )
						);
					}
				}

				body = el(
					cmp.Placeholder,
					{ label: LABEL, instructions: instructions },
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
