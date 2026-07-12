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
	var useMemo = wp.element.useMemo;
	var useCallback = wp.element.useCallback;
	var Fragment = wp.element.Fragment;
	var createInterpolateElement = wp.element.createInterpolateElement;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var cmp = wp.components;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;

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

	// Look up a catalog row by slug — both catalogs are slug-keyed, so tools and games share it. Reused by
	// the current-selection reads (which name the value on the picker's button) and by the tool picker's
	// onChange, which bakes the row's anchor into the block (embed.js reads data-anchor with no fallback).
	// Returns undefined on no-match; every call site already treats the result as truthy/falsy.
	function findBySlug( list, slug ) {
		return list.find( function ( row ) {
			return row.slug === slug;
		} );
	}

	// The saved slugs a catalog no longer has (renamed/removed on the site). Read by the pickers, which owe
	// each one a synthetic option — ComboboxControl is controlled by `value`, so a value with no matching
	// option renders the field BLANK: the author would see no selection while render.php still embeds the
	// slug — and by the lines that warn about them. from/to can legitimately repeat in older content, so
	// dedupe rather than offering the same slug twice.
	function orphanSlugs( list, slugs ) {
		return slugs.filter( function ( slug, i, all ) {
			return slug && all.indexOf( slug ) === i && ! findBySlug( list, slug );
		} );
	}

	// Core's own chevron-down, drawn inline: @wordpress/icons has no script handle to read it from, and a
	// zero-build plugin has no bundler to import it with — so the 24px viewBox and path are copied, and
	// the glyph matches every other dropdown in the editor rather than approximating one.
	var CHEVRON_DOWN = el(
		'svg',
		{
			xmlns: 'http://www.w3.org/2000/svg',
			viewBox: '0 0 24 24',
			width: 24,
			height: 24,
			'aria-hidden': 'true',
			focusable: 'false',
		},
		el( 'path', { d: 'M17.5 11.6L12 16l-5.5-4.4.9-1.2L12 14l4.6-3.6.9 1.2z' } )
	);

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

	// One picker, three fields (tool, from game, to game): a labelled button naming the current value,
	// which opens a searchable ComboboxControl.
	//
	// The POPOVER is the whole point, not decoration. Inline in the block, a ComboboxControl cannot work:
	// the canvas runs writing flow (useArrowNav, a native keydown listener on the canvas <body>), which
	// reads ArrowUp/ArrowDown in a one-line input whose caret sits at its edge — an empty one always does
	// — as "leave this field", focuses the nearest tabbable above or below and calls preventDefault(). The
	// control's own key handling is a React onKeyDown, and React delegates from the canvas <html>, ABOVE
	// that listener, so it always runs second and bails on event.defaultPrevented: the suggestions never
	// move. Markup order cannot fix that — it only changes WHICH neighbour the keys are stolen toward. The
	// editor mounts popovers in the top document, outside the canvas iframe and so outside writing flow's
	// reach, and out there the control simply behaves.
	//
	// The label is a plain <span>, not a <label for>: what it names is a Button that opens the real field,
	// and tying a <label> to a button would both hand the button its name — colliding with the one set
	// below, which carries the value — and turn a click on the label into a click on the button.
	//
	// A required field with no value states it, and its button points at that line with aria-describedby,
	// so a screen-reader user hears the problem on the field itself and not only in the visual red under
	// it. `error` is the field's own line; `describedBy` points at one drawn elsewhere (the game pair
	// shares a single line, because the rule is about the pair, not about either end).
	function pickerField( config ) {
		var errorId = config.id + '-error';
		return el(
			'div',
			{ className: 'rigpolice-embed__field' },
			el( 'span', { className: 'rigpolice-embed__field-label' }, config.label ),
			el( cmp.Dropdown, {
				// focusOnMount is left at core's default ('firstElement') ON PURPOSE. The mode that would
				// say "focus the search field" directly, 'firstInputElement', only exists in WordPress 7.0,
				// and this plugin supports 6.3: on every older release useFocusOnMount does
				// `if (mode !== 'firstElement') focus(node)`, so the unknown string focuses the popover
				// CONTAINER, the control never expands its list, and the arrow keys the popover exists for
				// do nothing. Do NOT pass `false` either — Popover derives constrainTabbing and
				// focus-return-on-close from `focusOnMount !== false`.
				//
				// What each picker relies on to land focus in the field therefore DIFFERS, and the
				// difference is load-bearing:
				//   - a picker WITH a caption row (the tool picker) would see 'firstElement' focus the
				//     caption's first button, so it passes `contentRef` and focuses the input itself.
				//   - a picker WITHOUT one (both game pickers) has the input as its first tabbable already,
				//     so core's default is correct and no ref is needed.
				// Give a game picker a caption and it silently regresses to focusing a chip — hand it a
				// `contentRef` at the same time.
				popoverProps: { className: 'rigpolice-embed__picker' },
				renderToggle: function ( picker ) {
					return el(
						cmp.Button,
						{
							// No variant: an accent-blue button reads as "do something", and this is a
							// field showing its value. editor.css keys its look to SelectControl's — which
							// is what it stands in for — and the chevron says it opens a list.
							icon: CHEVRON_DOWN,
							iconPosition: 'right',
							onClick: picker.onToggle,
							'aria-expanded': picker.isOpen,
							'aria-describedby': config.error ? errorId : config.describedBy,
							// The button IS the field and its label sits outside it, so spell the pair out
							// for a screen reader — on its own, two game buttons would both announce just
							// "Choose a game". The visible text stays inside the name (WCAG 2.5.3, Label in
							// Name).
							'aria-label': sprintf(
								/* translators: 1: field name, e.g. "Tool". 2: the value, or the prompt to pick one. */
								__( '%1$s: %2$s', 'rigpolice-embed' ),
								config.label,
								config.valueLabel || config.emptyLabel
							),
							__next40pxDefaultSize: true,
						},
						// A span, not a bare text node: the value is what gets truncated when the field is
						// narrower than the name of the tool in it.
						el(
							'span',
							{ className: 'rigpolice-embed__value' },
							config.valueLabel || config.emptyLabel
						)
					);
				},
				renderContent: function ( picker ) {
					return el(
						Fragment,
						null,
						config.caption,
						el(
							'div',
							{ ref: config.contentRef },
							el( cmp.ComboboxControl, {
								label: config.label,
								// Hidden only where a caption row already draws the label (the tool
								// picker) — the control keeps it for its accessible name either way.
								hideLabelFromVision: !! config.caption,
								value: config.value,
								options: config.options,
								placeholder: config.placeholder,
								onChange: function ( value ) {
									config.onChange( value );
									// Picking is the end of the errand — but reset (value === null) is not:
									// that clears the field and leaves the picker open to choose again.
									if ( value ) {
										picker.onClose();
									}
								},
								__next40pxDefaultSize: true,
								__nextHasNoMarginBottom: true,
							} )
						)
					);
				},
			} ),
			// role="alert": the line appears while focus is elsewhere — a reset leaves the popover open, so
			// the field goes invalid behind it — and aria-describedby alone is only read once the toggle is
			// focused again (WCAG 2.1 SC 4.1.3, Status Messages).
			config.error &&
				el(
					'p',
					{ className: 'rigpolice-embed__error', id: errorId, role: 'alert' },
					config.error
				)
		);
	}

	registerBlockType( 'rigpolice/embed', {
		edit: function ( props ) {
			var tool = props.attributes.tool;
			var showcredit = props.attributes.showcredit;
			var from = props.attributes.from;
			var to = props.attributes.to;
			var width = props.attributes.width;
			var setAttributes = props.setAttributes;
			// Ids for the fields' error lines, which their buttons point at with aria-describedby. Per
			// block: two of these blocks on one page would otherwise share an id.
			var fieldId = 'rigpolice-embed-' + props.clientId;

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

			// Focusing the search field is what makes ComboboxControl expand its list, so it has to happen
			// both when the popover opens and after a section chip is clicked (picking a section is the
			// first half of picking a tool — hand the author straight to the narrowed list).
			// ComboboxControl exposes no ref to its input, so reach it through the wrapper. Query by role,
			// not by core's `components-combobox-control__input` class: role="combobox" is part of the
			// control's ARIA contract, the class name is a private styling detail core renames freely (and
			// a miss here fails silently — no focus, no error).
			var pickerNode = useRef( null );
			function focusPicker() {
				var input =
					pickerNode.current &&
					pickerNode.current.querySelector( 'input[role="combobox"]' );
				if ( input ) {
					input.focus();
				}
			}

			// A CALLBACK ref, because opening the popover has to focus the field and core cannot do it for
			// us: the tool picker's caption row comes first, so Dropdown's default focusOnMount
			// ('firstElement') would land on a section chip, and the mode that means "the input"
			// ('firstInputElement') only shipped in WordPress 7.0 — this plugin supports 6.3.
			//
			// Running here is enough to win: React attaches a child's ref before its parent's, so this fires
			// before the Popover root's useFocusOnMount, which then finds focus already inside the popover
			// and returns early (`if ( node.contains( activeElement ) ) return;` — present unchanged from 6.3
			// through 7.0). Identity must be STABLE (deps []): a fresh function each render would make React
			// detach and re-attach the ref every time, stealing focus back mid-keystroke.
			var pickerContentRef = useCallback( function ( node ) {
				pickerNode.current = node;
				if ( node ) {
					focusPicker();
				}
			}, [] );

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

			// Both option lists are MEMOIZED, and not as a micro-optimisation. ComboboxControl memoizes its
			// filtered suggestions on the `options` IDENTITY, then locates the highlighted row with
			// indexOf() on the option OBJECT. A fresh array every render therefore makes the author's
			// arrow-key selection unfindable, and the control snaps the highlight back to the first row and
			// re-announces the result count — on ANY unrelated re-render of this block while a picker is
			// open (dragging Max width is enough). Memoizing keeps the identity stable until the list really
			// changes. Hoisted above the catalog branches below because hooks cannot run conditionally.

			// Option order IS catalog order: embeds.json already ships the tools grouped by category (all
			// mouse, then monitor, …), matching the sections on /embed-tools/, so the picker groups for
			// free — don't re-sort, it would just duplicate the catalog's own ordering.
			var toolOptions = useMemo(
				function () {
					if ( ! Array.isArray( tools ) ) {
						return [];
					}

					// The section filter never hides the SELECTED tool — a controlled value with no
					// matching option renders the field blank.
					var options = tools
						.filter( function ( t ) {
							return ! category || t.category === category || t.slug === tool;
						} )
						.map( function ( t ) {
							return { label: t.title + ' • ' + t.category, value: t.slug };
						} );

					return options.concat(
						orphanSlugs( tools, [ tool ] ).map( function ( slug ) {
							return {
								label:
									slug +
									' ' +
									__( '(no longer in the catalog)', 'rigpolice-embed' ),
								value: slug,
							};
						} )
					);
				},
				[ tools, category, tool ]
			);

			// ONE list for BOTH ends, listing every game. Neither end hides the game the other holds —
			// filtering it out (as 1.4.8 did) makes a SWAP unreachable in the picker: to turn from=A,to=B
			// into from=B,to=A, each end has to pass through the value the other still holds, and each end
			// had filtered away exactly that game. Both ends therefore list everything, the pair goes through
			// a transient from===to, and the error line names it — which is where render.php draws the line
			// anyway (it emits the pair only when the two are set AND differ).
			var gameOptions = useMemo(
				function () {
					if ( ! Array.isArray( games ) ) {
						return [];
					}

					var options = games.map( function ( g ) {
						return { label: g.name, value: g.slug };
					} );

					return options.concat(
						orphanSlugs( games, [ from, to ] ).map( function ( slug ) {
							return {
								label:
									slug +
									' ' +
									__( '(no longer in the catalog)', 'rigpolice-embed' ),
								value: slug,
							};
						} )
					);
				},
				[ games, from, to ]
			);

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
				var selected = findBySlug( tools, tool );

				// A saved slug missing from the fresh catalog (tool renamed/removed on the site). It still
				// embeds, so it is warned about rather than errored on; toolOptions above keeps it
				// selectable.
				var orphaned = tool && ! selected;

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
					// "remove the block", not "reset the field". A tool is REQUIRED, so clearing it back to
					// empty only trades this warning for an error — and the control's reset (X) is a poor
					// thing to send anyone to anyway: core renders it only while the combobox is COLLAPSED,
					// but the popover opens with the field focused (and so expanded), so the X appears only
					// after the author blurs the input, which nothing on screen suggests doing.
					instructions = __(
						'The saved tool is no longer in the RigPolice catalog. It still embeds on the page — pick a replacement, or remove the block.',
						'rigpolice-embed'
					);
				} else {
					// What the block IS. What it still NEEDS is the field's own error line — saying "pick a
					// tool" in both places would only make the two lines compete.
					instructions = __(
						'Embeds a free RigPolice gear-test tool. It loads in its own frame and resizes to fit.',
						'rigpolice-embed'
					);
				}

				// The caption row inside the tool picker's popover: "Tool" on the left, the section filter
				// on the right, both on top of the search field. The chips are NOT passed as the control's
				// `label` — that renders inside BaseControl's <label for>, where a click on a chip would
				// also be routed to the input and a screen reader would read every section name as part of
				// the field's name. So the row is drawn here and the control keeps its own (visually
				// hidden) label for its accessible name. Clicking the active section clears it.
				//
				// aria-current, not aria-pressed: the active section is the current view, not a pushed
				// toggle. Button turns aria-pressed into its own `is-pressed` class and core paints that
				// with a solid dark fill, which on a link-variant button renders the label as a black box.
				var sectionFilter = el(
					'div',
					{ className: 'rigpolice-embed__caption' },
					el( 'span', { className: 'rigpolice-embed__field-label' }, __( 'Tool', 'rigpolice-embed' ) ),
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

				// Its own element rather than the control's `help` prop: `help` renders inside the popover,
				// on the picker itself, but this line is for the author who has not opened the picker yet.
				// Matches core's help typography, which BaseControl would have supplied.
				var toolsPageLink = el(
					'p',
					{ className: 'rigpolice-embed__help' },
					TOOLS_PAGE_HELP
				);

				// An orphaned slug has no catalog row, so the raw slug is all there is to name it by.
				var toolLabel = selected ? selected.title : tool;

				// ComboboxControl (not SelectControl): a searchable input — the tool list is long, so
				// filter-as-you-type beats scrolling. Built-in label filtering; reset clears to null.
				//
				// Required, and render.php says so: with no tool it returns '' — the block publishes
				// nothing at all. An orphaned slug still embeds, so it is warned about (in the
				// instructions), not errored on.
				var toolPicker = pickerField( {
					id: fieldId + '-tool',
					label: __( 'Tool', 'rigpolice-embed' ),
					caption: sectionFilter,
					contentRef: pickerContentRef,
					value: tool,
					valueLabel: toolLabel,
					emptyLabel: __( 'Choose a tool', 'rigpolice-embed' ),
					error: tool
						? null
						: __( 'Required — the block embeds nothing until a tool is picked.', 'rigpolice-embed' ),
					options: toolOptions,
					placeholder: __( 'Search tools…', 'rigpolice-embed' ),
					// Bake the picked tool's anchor into the block (embed.js reads data-anchor with no
					// fallback) and reset the game pair — from/to only apply to the converter.
					onChange: function ( value ) {
						// Re-picking the tool already selected is a no-op, NOT a reset: the author often
						// reopens the picker just to browse. Without this guard, confirming the same
						// converter would wipe a game pair they had already configured, and the pair's own
						// error line would then blame them for it.
						if ( value === tool ) {
							return;
						}

						var next = { tool: value || '', from: '', to: '' };

						// Only a real catalog row rewrites the anchor. An ORPHANED slug has no row — that is
						// what orphaned means — so re-selecting it from its synthetic option must KEEP the
						// anchor the block already carries. Blanking it would ship data-anchor="", and
						// embed.js reads that with no fallback for the iframe title.
						var picked = findBySlug( tools, value );
						if ( picked ) {
							next.anchor = picked.anchor;
						}

						setAttributes( next );

						// The section was a route to a tool, so picking one retires it — otherwise it
						// outlives its purpose and silently keeps the next browse narrowed.
						if ( value ) {
							setCategory( '' );
						}
					},
				} );

				// The converter (preset === 'pair') gets a From/To game pair, populated from games.json.
				//
				// Both are required, and again render.php draws the line: it emits the pair only when both
				// are set AND differ (embed.js's own guard), so a half-filled or repeated pair is not "a
				// partial preset" — it is silently NO preset. Both states are therefore ERRORED on rather
				// than made unpickable: hiding the other end's game from each list is what made a swap
				// impossible (see gameOptions).
				var pairPicker = null;
				if ( selected && selected.preset === 'pair' ) {
					if ( games === false ) {
						pairPicker = el(
							'p',
							{ className: 'rigpolice-embed__error', role: 'alert' },
							__(
								'Could not load the game list from rigpolice.com. Reload the editor to pick the converter’s games.',
								'rigpolice-embed'
							)
						);
					} else if ( games === null ) {
						pairPicker = el( cmp.Spinner );
					} else {
						// ONE line for the two fields, not one each: every rule here is about the PAIR, and
						// the same sentence printed twice under two fields says nothing twice. Both buttons
						// point at it, so either one announces it.
						//
						// The three states mirror render.php's guard exactly — it emits the pair only when
						// both are set AND they differ (embed.js's own rule). Anything else is not "a partial
						// preset", it is silently NO preset, so the editor must not call the block complete.
						var pairErrorId = fieldId + '-pair-error';
						var strandedGames = orphanSlugs( games, [ from, to ] );
						var pairError = null;
						if ( ! from || ! to ) {
							pairError = __(
								'Required — without both games the converter embeds with no preset.',
								'rigpolice-embed'
							);
						} else if ( from === to ) {
							// Reachable from older content (before 1.4.8 both ends listed every game), and
							// reachable now while an author swaps the pair one end at a time.
							pairError = __(
								'Pick two different games — while both ends match, the converter embeds with no preset.',
								'rigpolice-embed'
							);
						} else if ( strandedGames.length ) {
							pairError = sprintf(
								/* translators: %s: comma-separated game slugs that are no longer in the catalog. */
								__(
									'%s is no longer in the RigPolice catalog. It still embeds — pick a replacement.',
									'rigpolice-embed'
								),
								strandedGames.join( ', ' )
							);
						}

						// One config, two ends: save() keys differ (from/to), so onChange is passed in. Both
						// ends share gameOptions — see there for why neither hides the other's game.
						function gamePicker( key, label, value, save ) {
							var game = findBySlug( games, value );
							return pickerField( {
								id: fieldId + '-' + key,
								label: label,
								value: value,
								// A saved slug the catalog no longer has still names itself.
								valueLabel: game ? game.name : value,
								emptyLabel: __( 'Choose a game', 'rigpolice-embed' ),
								describedBy: pairError ? pairErrorId : undefined,
								options: gameOptions,
								placeholder: __( 'Search games…', 'rigpolice-embed' ),
								onChange: function ( v ) {
									save( v || '' );
								},
							} );
						}
						pairPicker = el(
							'div',
							{ className: 'rigpolice-embed__pair' },
							gamePicker( 'from', __( 'From game', 'rigpolice-embed' ), from, function ( v ) {
								setAttributes( { from: v } );
							} ),
							gamePicker( 'to', __( 'To game', 'rigpolice-embed' ), to, function ( v ) {
								setAttributes( { to: v } );
							} ),
							pairError &&
								el(
									'p',
									{
										className: 'rigpolice-embed__error',
										id: pairErrorId,
										role: 'alert',
									},
									pairError
								)
						);
					}
				}

				body = el(
					cmp.Placeholder,
					{ label: LABEL, instructions: instructions },
					toolPicker,
					pairPicker,
					toolsPageLink
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
