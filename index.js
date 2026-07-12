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

	var TOOLS_PAGE_HELP = createInterpolateElement(
		__(
			'Not sure which one? <a>Browse every embeddable tool</a> on RigPolice.',
			'rigpolice-embed'
		),
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
				if ( ! Array.isArray( data ) ) {
					throw new Error( 'Unexpected payload' );
				}
				onOk( data );
			} )
			.catch( onErr );
	}

	function findBySlug( list, slug ) {
		return list.find( function ( row ) {
			return row.slug === slug;
		} );
	}

	function orphanSlugs( list, slugs ) {
		return slugs.filter( function ( slug, i, all ) {
			return slug && all.indexOf( slug ) === i && ! findBySlug( list, slug );
		} );
	}

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

	function categoriesOf( list ) {
		return list.reduce( function ( acc, t ) {
			if ( t.category && acc.indexOf( t.category ) === -1 ) {
				acc.push( t.category );
			}
			return acc;
		}, [] );
	}

	function pickerField( config ) {
		var errorId = config.id + '-error';
		return el(
			'div',
			{ className: 'rigpolice-embed__field' },
			el( 'span', { className: 'rigpolice-embed__field-label' }, config.label ),
			el( cmp.Dropdown, {
				popoverProps: { className: 'rigpolice-embed__picker' },
				renderToggle: function ( picker ) {
					return el(
						cmp.Button,
						{
							icon: CHEVRON_DOWN,
							iconPosition: 'right',
							onClick: picker.onToggle,
							'aria-expanded': picker.isOpen,
							'aria-describedby': config.error ? errorId : config.describedBy,
							'aria-label': sprintf(
								/* translators: 1: field name, e.g. "Tool". 2: the value, or the prompt to pick one. */
								__( '%1$s: %2$s', 'rigpolice-embed' ),
								config.label,
								config.valueLabel || config.emptyLabel
							),
							__next40pxDefaultSize: true,
						},
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
								hideLabelFromVision: !! config.caption,
								value: config.value,
								options: config.options,
								placeholder: config.placeholder,
								onChange: function ( value ) {
									config.onChange( value );
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
			var fieldId = 'rigpolice-embed-' + props.clientId;

			var toolsState = useState( null );
			var tools = toolsState[ 0 ];
			var setTools = toolsState[ 1 ];

			var gamesState = useState( null );
			var games = gamesState[ 0 ];
			var setGames = gamesState[ 1 ];

			var categoryState = useState( '' );
			var category = categoryState[ 0 ];
			var setCategory = categoryState[ 1 ];

			var pickerNode = useRef( null );
			function focusPicker() {
				var input =
					pickerNode.current &&
					pickerNode.current.querySelector( 'input[role="combobox"]' );
				if ( input ) {
					input.focus();
				}
			}

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


			var toolOptions = useMemo(
				function () {
					if ( ! Array.isArray( tools ) ) {
						return [];
					}

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
					instructions = __(
						'The saved tool is no longer in the RigPolice catalog. It still embeds on the page — pick a replacement, or remove the block.',
						'rigpolice-embed'
					);
				} else {
					instructions = __(
						'Embeds a free RigPolice gear-test tool. It loads in its own frame and resizes to fit.',
						'rigpolice-embed'
					);
				}

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

				var toolsPageLink = el(
					'p',
					{ className: 'rigpolice-embed__help' },
					TOOLS_PAGE_HELP
				);

				var toolLabel = selected ? selected.title : tool;

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
					onChange: function ( value ) {
						if ( value === tool ) {
							return;
						}

						var next = { tool: value || '', from: '', to: '' };

						var picked = findBySlug( tools, value );
						if ( picked ) {
							next.anchor = picked.anchor;
						}

						setAttributes( next );

						if ( value ) {
							setCategory( '' );
						}
					},
				} );

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
						var pairErrorId = fieldId + '-pair-error';
						var strandedGames = orphanSlugs( games, [ from, to ] );
						var pairError = null;
						if ( ! from || ! to ) {
							pairError = __(
								'Required — without both games the converter embeds with no preset.',
								'rigpolice-embed'
							);
						} else if ( from === to ) {
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

						function gamePicker( key, label, value, save ) {
							var game = findBySlug( games, value );
							return pickerField( {
								id: fieldId + '-' + key,
								label: label,
								value: value,
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

		save: function () {
			return null;
		},
	} );
} )( window.wp );
