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
	var useRef = wp.element.useRef;
	var Fragment = wp.element.Fragment;
	var createInterpolateElement = wp.element.createInterpolateElement;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var cmp = wp.components;
	var __ = wp.i18n.__;

	var EMBEDS_URL = 'https://rigpolice.com/embeds.json';
	var GAMES_URL = 'https://rigpolice.com/games.json';
	var TOOLS_PAGE_URL = 'https://rigpolice.com/embed-tools/';
	var LABEL = __( 'RigPolice Tool', 'rigpolice-embed' );

	// The picker lists tool names only; the site's embed page shows each one with a description and a live
	// demo. Interpolated (not concatenated) so translators get the whole sentence with the link in place.
	var TOOLS_PAGE_HELP = createInterpolateElement(
		__(
			'Not sure which one? <a>Browse every embeddable tool</a> on RigPolice.',
			'rigpolice-embed'
		),
		// ExternalLink, not a raw <a>: it carries core's target/rel, the external-link icon, and the
		// screen-reader "(opens in a new tab)" text.
		{ a: el( cmp.ExternalLink, { href: TOOLS_PAGE_URL } ) }
	);

	function fetchJson( url, onOk, onErr ) {
		fetch( url )
			.then( function ( r ) {
				if ( ! r.ok ) {
					throw new Error( 'HTTP ' + r.status );
				}
				return r.json();
			} )
			.then( function ( data ) {
				// A 2xx with a non-array body (error envelope, {}, soft-404 HTML that parsed) is a
				// failure, not an empty catalog — route it to onErr so the editor shows the error state
				// instead of a working-but-empty picker (the three-state cell can't tell them apart).
				if ( ! Array.isArray( data ) ) {
					throw new Error( 'Unexpected payload' );
				}
				onOk( data );
			} )
			.catch( onErr );
	}

	// Look up a catalog row by slug. Reused by the current-selection read and the picker's onChange,
	// which bakes the row's anchor into the block (embed.js reads data-anchor with no fallback).
	// Returns undefined on no-match; both call sites already treat the result as truthy/falsy.
	function findTool( list, slug ) {
		return list.find( function ( t ) {
			return t.slug === slug;
		} );
	}

	// The catalog's own category order, deduped — NOT a hardcoded list, so a section added on RigPolice
	// shows up here without a plugin release (same reason the picker doesn't re-sort the tools).
	function categoriesOf( list ) {
		return list.reduce( function ( acc, t ) {
			if ( t.category && acc.indexOf( t.category ) === -1 ) {
				acc.push( t.category );
			}
			return acc;
		}, [] );
	}

	registerBlockType( 'rigpolice/embed', {
		edit: function ( props ) {
			var tool = props.attributes.tool;
			var showcredit = props.attributes.showcredit;
			var from = props.attributes.from;
			var to = props.attributes.to;
			var width = props.attributes.width;
			var setAttributes = props.setAttributes;

			// Each catalog is one three-state cell: null = loading, false = failed, array = loaded.
			var toolsState = useState( null );
			var tools = toolsState[ 0 ];
			var setTools = toolsState[ 1 ];

			var gamesState = useState( null );
			var games = gamesState[ 0 ];
			var setGames = gamesState[ 1 ];

			// Deliberately editor-only view state, not a block attribute — it's how the author browses
			// the picker, not what gets published.
			var categoryState = useState( '' );
			var category = categoryState[ 0 ];
			var setCategory = categoryState[ 1 ];

			// Picking a section is the first half of picking a tool, so hand the author straight to the
			// (now narrowed) list. ComboboxControl takes no ref to its input, so reach it through a
			// wrapper: focusing the input is what makes the control open its own suggestions.
			// Query by role, not by core's `components-combobox-control__input` class: role="combobox" is
			// part of the control's ARIA contract, the class name is a private styling detail core renames
			// freely (and a miss here fails silently — no focus, no error).
			var pickerRef = useRef( null );
			function focusPicker() {
				var input =
					pickerRef.current && pickerRef.current.querySelector( 'input[role="combobox"]' );
				if ( input ) {
					input.focus();
				}
			}

			useEffect( function () {
				var alive = true;
				function load( url, set ) {
					fetchJson(
						url,
						function ( d ) {
							if ( alive ) {
								set( d );
							}
						},
						function () {
							if ( alive ) {
								set( false );
							}
						}
					);
				}
				load( EMBEDS_URL, setTools );
				load( GAMES_URL, setGames );
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
			if ( tools === false ) {
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
				// Option order IS catalog order: embeds.json already ships the tools grouped by
				// category (all mouse, then monitor, …), matching the sections on /embed-tools/. So the
				// picker groups for free — don't re-sort here, it would just duplicate the catalog's own
				// ordering.
				// The section filter never hides the SELECTED tool: ComboboxControl is controlled by
				// `value`, so a value with no matching option renders the field blank — the author would
				// see no selection while render.php still embeds the stale data-tool.
				var toolOptions = tools
					.filter( function ( t ) {
						return ! category || t.category === category || t.slug === tool;
					} )
					.map( function ( t ) {
						return { label: t.title + ' • ' + t.category, value: t.slug };
					} );

				var selected = findTool( tools, tool );

				// A saved slug missing from the fresh catalog (tool renamed/removed on the site) has no row
				// to build an option from — same blank-picker problem, so keep the value visible with a
				// synthetic option and warn.
				var orphaned = tool && ! selected;
				if ( orphaned ) {
					toolOptions = toolOptions.concat( {
						label: tool + ' ' + __( '(no longer in the catalog)', 'rigpolice-embed' ),
						value: tool,
					} );
				}

				var instructions;
				if ( selected ) {
					instructions =
						__( 'Default size:', 'rigpolice-embed' ) +
						' ' +
						selected.width +
						' x ' +
						selected.height +
						' px. ' +
						__( 'The frame auto-resizes to fit your page.', 'rigpolice-embed' );
				} else if ( orphaned ) {
					instructions = __(
						'The saved tool is no longer in the RigPolice catalog. It still embeds on the page — pick a replacement, or reset to remove it.',
						'rigpolice-embed'
					);
				} else {
					instructions = __(
						'Pick a tool to embed. It loads in its own frame and resizes to fit.',
						'rigpolice-embed'
					);
				}

				// The field's caption row: "Tool" on the left, the section filter on the right. The chips
				// are NOT passed as the control's `label` — that renders inside BaseControl's <label for>,
				// where a click on a chip would also be routed to the input and a screen reader would read
				// every section name as part of the field's name. So the row is drawn here and the control
				// keeps its own (visually hidden) label for its accessible name.
				//
				// ABOVE the input, like the tools-page link: the open suggestions list is absolutely
				// positioned over whatever follows the field (see editor.css), so anything below it is
				// hidden exactly when the author is choosing. Clicking the active section clears it.
				//
				// aria-current, not aria-pressed: the active section is the current view, not a pushed
				// toggle. Button turns aria-pressed into its own `is-pressed` class and core paints that
				// with a solid dark fill, which on a link-variant button renders the label as a black box.
				var sectionFilter = el(
					'div',
					{ className: 'rigpolice-embed__caption' },
					el( 'span', { className: 'rigpolice-embed__caption-label' }, __( 'Tool', 'rigpolice-embed' ) ),
					el(
						'div',
						{ className: 'rigpolice-embed__sections' },
						categoriesOf( tools ).map( function ( name ) {
							var active = category === name;
							return el(
								'span',
								{ key: name, className: 'rigpolice-embed__section-item' },
								el(
									cmp.Button,
									{
										variant: 'link',
										className:
											'rigpolice-embed__section' +
											( active ? ' is-active' : '' ),
										'aria-current': active || undefined,
										onClick: function () {
											setCategory( active ? '' : name );
											focusPicker();
										},
									},
									name
								)
							);
						} )
					)
				);

				// Same reason the section filter sits above the input, and one more: passing this as the
				// control's `help` puts a FOCUSABLE <a> right after the field, and arrowing through the
				// open suggestions scrolls the highlighted option into view — which hands focus to that
				// next focusable node, so the arrow keys stop driving the list after the first press.
				var toolsPageLink = el(
					'p',
					{ className: 'rigpolice-embed__help' },
					TOOLS_PAGE_HELP
				);

				// ComboboxControl (not SelectControl): a searchable input — the tool list is long, so
				// filter-as-you-type beats scrolling. Built-in label filtering; reset clears to null.
				var toolSelect = el( cmp.ComboboxControl, {
					// Drawn in the caption row above instead, so the chips can share the line — but the
					// control keeps the label for its accessible name, just hidden from view.
					label: __( 'Tool', 'rigpolice-embed' ),
					hideLabelFromVision: true,
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
						// The section was a route to a tool, so picking one retires it — otherwise it
						// outlives its purpose and silently keeps the next browse narrowed. Not on reset
						// (value === null): that clears the field, not the way the author is browsing.
						if ( value ) {
							setCategory( '' );
						}
					},
					__next40pxDefaultSize: true,
					__nextHasNoMarginBottom: true,
				} );

				// The converter (preset === 'pair') gets a From/To game picker, populated from games.json.
				var pairPicker = null;
				if ( selected && selected.preset === 'pair' ) {
					if ( games === false ) {
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
						// One prop bag, two ends — save() keys differ (from/to), so onChange is passed in.
						function gamePicker( label, value, save ) {
							return el( cmp.ComboboxControl, {
								label: label,
								value: value,
								options: gameOptions,
								placeholder: __( 'Any game (no preset)', 'rigpolice-embed' ),
								onChange: function ( v ) {
									save( v || '' );
								},
								__next40pxDefaultSize: true,
								__nextHasNoMarginBottom: true,
							} );
						}
						pairPicker = el(
							Fragment,
							null,
							gamePicker( __( 'From game', 'rigpolice-embed' ), from, function ( v ) {
								setAttributes( { from: v } );
							} ),
							gamePicker( __( 'To game', 'rigpolice-embed' ), to, function ( v ) {
								setAttributes( { to: v } );
							} )
						);
					}
				}

				body = el(
					cmp.Placeholder,
					{ label: LABEL, instructions: instructions },
					sectionFilter,
					toolsPageLink,
					el( 'div', { ref: pickerRef }, toolSelect ),
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
