Ext.namespace('mpd.browser')
mpd.PAGE_LIMIT = 200
mpd.TAG_TYPES = ["Artist", "Album", "AlbumArtist", "Title", "Track", "Name", "Genre", "Date", "Composer", "Performer", "Disc"]
mpd.EXTRA_FIELDS = []


mpd.dbFields = function() {
    var fields = [
        {'name': 'id'},
        {'name': 'file'},
        {'name': 'directory'},
        {'name': 'playlist'},
        {'name': 'type'},
        {'name': 'pos', 'type': 'int'},
        {'name': 'track'},
        {'name': 'title'},
        {'name': 'album'},
        {'name': 'artist'},
        {'name': 'time', 'type': 'int'},
        {'name': 'ptime'},
        {'name': 'cls'},
        {'name': 'any'}
    ]
    return fields.concat(mpd.EXTRA_FIELDS)
}


function editLyrics(el) {
	var ip = Ext.getCmp('infopanel')
	var d = ip.record.data
	var url = 'http://www.lyricsplugin.com/winamp03/edit?' + Ext.urlEncode({
		'artist': d.artist,
		'title': d.title
	})
	var opts = 'toolbar=no,status=no,menubar=no,width=500,height=550'
	var w = window.open(url, 'lyric_edit', opts)
	var checkWin = function() {
		if (w && !w.closed) {
			setTimeout(checkWin, 100)
		} else {
			ip.loadLyrics.defer(500, ip)
		}
	}
	setTimeout(checkWin, 1000)
}


function renderIcon(val, meta, rec, row, col, store) {
    return '<div class="icon icon-'+val+'"/>'
}


function showImage(el) {
    // el should be an image DOM element to show larger...
    el = Ext.get(el)
    var src = el.getAttribute('src')
    if (!src) return false

    var data = {src: src, artist: '', album: ''}

    var m = /[\?\&]artist\=([^\&]*)/.exec(src)
    if (m && m.length > 1) data.artist = decodeURIComponent(m[1])

    var m = /[\?\&]album\=([^\&]*)/.exec(src)
    if (m && m.length > 1) data.album = decodeURIComponent(m[1])

    if (data.album > '') {
        var t = data.album
        var lbl = '<b>'+data.album+'</b><br>' +
                '<i>by '+data.artist+'</i>'
    } else {
        var t = data.artist
        var lbl = '<b>'+data.artist+'</b><br>'
    }

    var win = new Ext.Window({
        autoHeight: true,
        title: t,
		resizable: false,
        html: '<center style="margin:5px">' +
            '<img src="'+src+'"><br>' +
            lbl +
            '</center>',
        y: 60
    }).show(el)
}

Ext.override(Ext.grid.GridView, {
    holdPosition: false,
    onLoad : function(){
        if (!this.holdPosition) this.scrollToTop();
        this.holdPosition = false
    }
});


mpd.browser.Playlist = Ext.extend(Ext.Panel, {
    constructor: function(config) {
        /**
         * Custom config option: playlistStyle
         *
         * Can be one of [3line, titles, albums, albumcovers].
         *
         * 3line:  Each track is displayed in three line detail.
         *      <b>title</b>
         *      album
         *      <i>artist<i>
         *
         * titles: Title only in one line.
         *
         * albums: At the begining of each new album in the list,
         *      a two line album/asrtist header is printed, followed
         *      by individual title lines for each track.
         *
         * albumcovers: Same as albums but with images in the headers.
         *
         **/

        var self = this
        this.store = new Ext.data.JsonStore({
			autoLoad: false,
			url: '../playlistinfoext',
            fields: mpd.dbFields()
        })
        appEvents.subscribe('playlistchanged', function(){
            self.store.load()
        })

        var pstyle = Ext.value(config.playlistStyle, '3line')
        this.setList(pstyle)

        this.onHover = function(evt, el) {
            Ext.select(".x-list-selected", this.el).addClass('simulated_hover')
        }
        this.onHoverOut = function(evt, el) {
            Ext.select(".x-list-body-inner .simulated_hover", this.el).removeClass('simulated_hover')
        }
        this.store.on('load', function() {
            var col1 = Ext.select(".x-list-body div.remove", self.list.el)
            col1.hover(self.onHover, self.onHoverOut, self.list)
        })

        var menu = new Ext.menu.Menu({
            defaults: {
                xtype: 'menucheckitem',
                group: 'listview',
                handler: function (item, e) {
                    self.setList(item.id)
                }
            },
            items: [
                {
                    text: '3 Line Detail',
                    id: '3line',
                    checked: (pstyle=='3line')
                },
                {
                    text: 'Titles Only',
                    id: 'titles',
                    checked: (pstyle=='titles')
                },
                {
                    text: 'Album Groups',
                    id: 'albums',
                    checked: (pstyle=='albums')
                },
                {
                    text: 'Album Covers',
                    id: 'albumcovers',
                    checked: (pstyle=='albumcovers')
                }
            ]
        })

        Ext.apply(this, {
            id: 'playlistsidebar',
            title: 'Playlist',
            layout: 'fit',
            minWidth: 200,
            items: self.list,
            forceLayout: true,
            tools: [
                {
                    id: 'gear',
                    handler: function(e, toolEl, pnl, toolConfig) {
                        x = toolEl.getLeft()
                        y = toolEl.getBottom()
                        menu.show(toolEl)
                    }
                }
            ],
            tbar: mpd.browser.createPlaylistToolbar(),
            bbar: new Ext.Toolbar({
				layout: 'hbox',
				layoutConfig: {
					align: 'middle'
				},
				items: [
					{
						xtype: 'label',
						text: 'Filter:',
						margins: '0 4 0 2'
					},
					new Ext.app.FilterField({
						store: self.store,
						margins: '0 2 0 2',
						flex: 1
					})
				]
			}),
            listeners: {
                'beforecollapse': function () {
                    Ext.getCmp('dbtabbrowser').unhideTabStripItem('playlistTab')
                },
                'beforeexpand': function () {
                    Ext.getCmp('dbtabbrowser').hideTabStripItem('playlistTab')
                    var a = Ext.getCmp('dbtabbrowser').getActiveBrowser()
                }
            }
        });
        Ext.apply(this, config)
        mpd.browser.Playlist.superclass.constructor.apply(this, arguments);

    },
    setList: function (pstyle) {
        var self = this
        baseParams = {}
        
        switch (pstyle) {
            case 'titles':
                cols = [
                    {
                        header: "#",
                        dataIndex: 'pos',
                        width: 0.1,
                        tpl: '<div id="{id}" class="remove">{pos}.</div>'
                    },
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl: '<div>{title}</div>'
                    }
                ];
                break;
            case 'albums':
                cols = [
                    {
                        header: "#",
                        dataIndex: 'position',
                        width: 0.1,
                        tpl:
                        '<tpl if="title">' +
                            '<div id="{id}" class="remove {cls}">{pos}.</div>' +
                        '</tpl><tpl if="!title">' +
                            '<div class="x-toolbar {cls}" style="height:30px;">&nbsp;' +
                            '<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br>&nbsp;</tpl>' +
                            '</div>' +
                        '</tpl>'
                    },
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl:
                        '<tpl if="title">' +
							'<div class="{cls}">{title}' +
						'</tpl>' +
                        '<tpl if="!title">' +
							'<div class="x-toolbar {cls}" style="height:30px;">' +
                            '<b style="white-space:nowrap !important;">{album}</b><tpl if="!album &amp;&amp; !artist">&nbsp;</tpl>' +
                            '<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br></tpl>' +
                            '<i>{artist}</i>' +
                        '</tpl>' +
                        '</div>'
                    }
                ]
                baseParams.albumheaders = true;
                break;
            case 'albumcovers':
                cols = [
                    {
                        header: "#",
                        dataIndex: 'pos',
                        width: 0.1,
                        tpl:
                        '<tpl if="title">' +
                            '<div id="{id}" class="remove {cls}">{pos}.</div>' +
                        '</tpl><tpl if="!title">' +
                            '<div class="x-toolbar {cls}" style="height:68px;">' +
                            '</div>' +
                        '</tpl>'
                    },
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl:
                        '<tpl if="title">' +
							'<div class="{cls}">{title}</div>' +
						'</tpl>' +
                        '<tpl if="!title">' +
							'<div class="x-toolbar {cls}" style="height:68px;">' +
								'<img src="../covers?{[Ext.urlEncode({artist:values.artist,album:values.album})]}">' +
								'<b>{album}</b><tpl if="!album &amp;&amp; !artist">&nbsp;</tpl>' +
								'<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br></tpl>' +
								'<i>{artist}</i>' +
							'</div>' +
                        '</tpl>'
                    }
                ]
                pstyle = 'albums'
                baseParams.albumheaders = true;
                break;
            default:
                cols = [
                    {
                        header: "#",
                        dataIndex: 'position',
                        width: 0.125,
                        tpl: '<div id="{id}" class="remove">{pos}.<br/>\
                        <tpl if="album"><br/></tpl>\
                        <tpl if="artist"><br/></tpl>\
                        </div>'
                    },
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl: '<b>{title}</b>\
                        <tpl if="album"><br/>{album}</tpl>\
                        <tpl if="artist"><br/><i>{artist}</i></tpl>'
                    }
                ];
        }
		self.store.baseParams = baseParams
		
        var new_list = new Ext.ListView({
            store: self.store,
            multiSelect: true,
            cls: pstyle,
            columns: cols,
            enableDragDrop: true
        })

        new_list.on('beforeclick', function(lstView, rowIdx, node, evt) {
            var t = evt.target
            var el = Ext.get(t)
            if (el.hasClass('remove')) {
                var cur = lstView.getSelectedRecords()
                if (!Ext.fly(node).hasClass('x-list-selected')) {
                    cur.push(lstView.getRecord(node))
                }
                Ext.each(cur, function(rec) {
                    if (rec.data.id) {
                        mpd.cmd( ['deleteid', rec.data.id] )
                        rec.set('id', '..')
                    }
                })
            } else {
                if (t.tagName == 'IMG') {
                    showImage(t)
                }
            }
        })

        new_list.on('dblclick', function(lstView, rowIdx, node, evt) {
            var rec = self.store.getAt(rowIdx).data
            mpd.cmd(['playid', rec.id])
        })
        
        var ddTpl = new Ext.XTemplate(
            '<div>',
                '<tpl for=".">',
                    '<div class={[xcount == xindex ? "" : "album-group-end"]}>',
                        '{title}',
                    '</div>',
                '</tpl>',
            '</div>'
        ).compile()
        
        new_list.on('render', function(v) {
            new_list.dragZone = new Ext.dd.DragZone(v.getEl(), {

        //      On receipt of a mousedown event, see if it is within a DataView node.
        //      Return a drag data object if so.
                getDragData: function(e) {

        //          Use the DataView's own itemSelector (a mandatory property) to
        //          test if the mousedown is within one of the DataView's nodes.
                    var sourceEl = e.getTarget(v.itemSelector, 10);

        //          If the mousedown is within a DataView node, clone the node to produce
        //          a ddel element for use by the drag proxy. Also add application data
        //          to the returned data object.
                    if (sourceEl) {
                        var rec = v.getRecord(sourceEl)
                        if (!rec.data.pos) return null
                        var songInfo = Ext.query("dt:nth(2)", sourceEl)[0]
                        var d = songInfo.cloneNode(true);
                        var w = Ext.fly(songInfo).getComputedWidth() - 18
                        d.style.minWidth = w+"px"
                        d.id = Ext.id();
                        return {
                            ddel: d,
                            sourceEl: sourceEl,
                            repairXY: Ext.fly(sourceEl).getXY(),
                            sourceStore: v.store,
                            draggedRecord: rec
                        }
                    }
                },
                getRepairXY: function() {
                    return this.dragData.repairXY;
                }
            });
            
            new_list.dropZone = new Ext.dd.DropZone(v.getEl(), {
                getTargetFromEvent: function(e) {
                    return e.getTarget(v.itemSelector, 10);
                },
                onNodeEnter : function(target, dd, e, data){ 
                    Ext.fly(target).addClass('list-dropover');
                },
                onNodeOut : function(target, dd, e, data){ 
                    Ext.fly(target).removeClass('list-dropover');
                },
                onNodeOver : function(target, dd, e, data){ 
                    return Ext.dd.DropZone.prototype.dropAllowed;
                },
                onNodeDrop : function(target, dd, e, data){
                    var recFrom = data.draggedRecord.data
                    var recTo = new_list.getRecord(target)
                    if (!recTo.data.pos) {
                        var s = data.sourceStore
                        recTo = s.getAt(s.indexOf(recTo)+1)
                    }
                    recTo = recTo.data
                    if (recFrom.id == recTo.id) return false
                    var posTo = recTo.pos - 1
                    if (posTo > recFrom.pos) posTo--
                    mpd.cmd(['moveid', recFrom.id, posTo])                    
                    return true;
                }
            });

        });

        if (self.list) {
            self.list.dragZone.unreg()
            self.list.dropZone.unreg()
            self.remove(self.list, true)
            self.list = new_list
            self.add(new_list)
            self.doLayout()
            self.store.load()
        } else {
            self.list = new_list
        }
    }
});
Ext.reg('playlist_sidebar', mpd.browser.Playlist)


mpd.browser.playlistChooser = new Ext.Window({
	title: 'Choose Playlist to Load...',
	layout: 'vbox',
	width: 300,
	height: 300,
	padding: 5,
	mode: 'open',
	layoutConfig: {align: 'stretch'},
	closeAction: 'hide',
	items: [
		{
			xtype: 'panel',
			layout: 'fit',
			flex: 1,
			items: {
				xtype: 'listview',
				id: 'playlists-load-list',
				singleSelect: true,
				autoScroll: true,
				store: new Ext.data.JsonStore({
					autoLoad: false,
					url: '../listplaylists',
					fields: ['playlist', 'type', 'title', 'any']
				}),
				columns: [{
					header: 'Playlist Name', 
					dataIndex: 'title', 
					tpl: '<div class="icon icon-playlist">{title}</div>'
				}],
				listeners: {
					'selectionchange': function(lst, nodes) {
						if (nodes.length > 0) {
							var t = Ext.getCmp('txtplaylist-load')
							var r = lst.getRecord(nodes[0])
							t.setValue(r.data.title)
						}
					},
					'dblclick': function(lst, idx, node, event) {
						var w = lst.ownerCt.ownerCt
						var fn = (w.mode == 'open') ? w.loadPlaylist : w.savePlaylist
						fn.call(w)
					},
					'contextmenu': function(lst, idx, node, event) {
						var s = lst.getStore()
						var r = s.getAt(idx)
						mpd.context.Show([r.data], event, function (item, event) {
							var id = item.id
							if (id == 'mpd-context-add') return null
							if (id == 'mpd-context-replace') return null
							s.load()
						})
					}
				}							
			}
		},
		{
			xtype: 'textfield',
			id: 'txtplaylist-load',
			text: 'Untitled',
			margins: '4 0 0 0'
		}
	],
	listeners: {
		'beforeshow': function(self) {
			var lst = Ext.getCmp('playlists-load-list')
			var t = Ext.getCmp('txtplaylist-load')
			var o = Ext.getCmp('playlists-load-open')
			var s = Ext.getCmp('playlists-load-save')
			var n = Ext.value(mpd.status.playlistname, 'Untitled')
			lst.getStore().load()
			t.setValue(n)
			if (self.mode == 'open') {
				s.hide()
				o.show()
				t.disable()
				self.setTitle('Choose Playlist to Load...')
			} else {
				o.hide()
				s.show()
				t.enable()
				self.setTitle('Save: Enter Playlist Name')
				t.focus(true, true)
			}
		},
		'show': function(self) {
			var t = Ext.getCmp('txtplaylist-load')
			if (!t.disabled) t.focus(true, 100)
		}
	},			
	bbar: [
		'->',
		{
			xtype: 'button',
			text: 'Cancel',
			iconCls: "icon-cancel",
			cls: 'x-toolbar-standardbutton',
			style: 'margin:3px',
			handler: function(btn) {
				btn.ownerCt.ownerCt.hide()
			}
		},
		{
			xtype: 'button',
			text: 'Open',
			id: 'playlists-load-open',
			iconCls: "icon-directory-open",
			cls: 'x-toolbar-standardbutton',
			style: 'margin:3px',
			handler: function(btn) {
				var w = btn.ownerCt.ownerCt
				w.loadPlaylist.call(w)
			}
		},
		{
			xtype: 'button',
			text: 'Save',
			id: 'playlists-load-save',
			iconCls: "icon-save",
			cls: 'x-toolbar-standardbutton',
			style: 'margin:3px',
			handler: function(btn) {
				var w = btn.ownerCt.ownerCt
				w.savePlaylist.call(w)
			}
		}
	],
	loadPlaylist: function() {
		var t = Ext.getCmp('txtplaylist-load')
		mpd.cmd(['load', t.getValue(), true])
		this.hide()
	},
	savePlaylist: function() {
		var t = Ext.getCmp('txtplaylist-load')
		mpd.cmd(['save', t.getValue()])
		this.hide()
	},		
	showOpen: function(el) {
		this.mode = 'open'
		this.show(el)
	},
	showSave: function(el) {
		this.mode = 'save'
		this.show(el)
	}
})


mpd.browser.createPlaylistToolbar = function () {
    return new Ext.Toolbar({
		layout: 'hbox',
		layoutConfig: {
			align: 'middle'
		},
		items: [
			{
				xtype: 'label',
				flex: 1,
				margins: '0 4 0 6',
				style: 'font-weight:bold;',
				listeners: {
					afterrender: function (self) {
						var n = Ext.value(mpd.status.playlistname, 'Untitled')
						self.setText(n)
						appEvents.subscribe('playlistnamechanged', function(){
							self.setText(mpd.status.playlistname)
						})
					}
				}
			},
			{
				xtype: 'button',
				iconCls: "icon-clear",
				tooltip: 'Clear Playlist',
				handler: function () {
					mpd.cmd(['clear'])
				}
			},
			{
				xtype: 'button',
				iconCls: "icon-directory-open",
				tooltip: 'Load Saved Playlist',
				handler: function (btn) {
					mpd.browser.playlistChooser.showOpen(btn.el)
				}
			},
			{
				xtype: 'button',
				iconCls: "icon-save",
				tooltip: 'Save Playlist',
				handler: function (btn) {
					mpd.browser.playlistChooser.showSave(btn.el)
				}
			}
		]
	})
}


mpd.browser.GridBase = Ext.extend(Ext.grid.GridPanel, {
    constructor: function(config) {
        var self = this
        this.cwd = null
        this.config = config || {}
        var cmd = this.config.cmd || 'lsinfo'  
        if (!this.store) {
            this.store = new Ext.data.Store({
                autoLoad: false,
                url: '../query',
                baseParams: {'cmd': cmd},
                remoteSort: true,
                reader: new Ext.data.JsonReader({
                    root            : 'data',
                    totalProperty   : 'totalCount',
                    idProperty      : 'id'
                  },
                  mpd.dbFields()
                )  
            })
        } 
        
        appEvents.subscribe('playlistchanged', this.db_refresh.createDelegate(this))
        appEvents.subscribe('db_updatechanged', this.db_refresh.createDelegate(this))
        
        this.filter = new Ext.app.FilterField({
            store: this.store,
            width:140
        })
		
		var cols = [
			{id: 'cpos', header: "#", width: 23, dataIndex: 'pos', align: 'left',
				renderer: function(val, meta, rec){
					if (self.cwd == 'home') return ''
					if (val) {
						return '<div class="remove">' + val + '.</div>'
					} else {
						return '<div class="add">'
					}
				}
			},
			{id: 'ctrack', header: 'Track', dataIndex: 'track', width: 40, align: 'right', hidden: true},
			{id: 'cicon', header: "Icon", width: 24, dataIndex: 'type', renderer: renderIcon},
			{id: 'ctitle', header: "Title", dataIndex: 'title'},
			{id: 'calbum', header: "Album", dataIndex: 'album'},
			{id: 'cartist', header: "Artist", dataIndex: 'artist'},
			{id: 'ctime', header: "Time", width: 40, dataIndex: 'time',
				renderer: function(val, meta, rec){
					return rec.data.ptime
				}
			}
		]
		Ext.each(mpd.EXTRA_FIELDS, function(item) {
			cols.push({
				header: item.header,
				dataIndex: item.name,
				hidden: true
			})
		})
		
        Ext.apply(this, {
            store: this.store,
            region: 'center',
            cm: new Ext.grid.ColumnModel({
                columns: cols,
                defaults: {
                    width: 150,
                    sortable: true
                }
            }),
            autoExpandColumn: 'ctitle',
            autoExpandMin: 150,
            autoExpandMax: 300,
            closable: true,
            hideParent: true,
            keys: {
				key: 'a',
				ctrl: true,
				fn: function (k, e) {
					var sm = this.getSelectionModel()
					sm.selectAll()
					e.stopEvent()
					return false
				},
				scope: this
			},
            //enableDragDrop: true,
            tbar: new Ext.Toolbar(),
            bbar: new Ext.PagingToolbar({
				pageSize: mpd.PAGE_LIMIT,
				store: this.store,
				displayInfo: true,
				displayMsg: 'Displaying items {0} - {1} of {2}',
				emptyMsg: "No items to display",
                plugins: [
                    new Ext.ux.plugins.PageCycleResizer({pageSizes: [25, 50, 100, 200, 400, 800]})
                ],
				prependButtons: true,
				items: ['Filter: ', ' ', this.filter, '-']
			}),
            listeners: {
                'cellmousedown': function(g, rowIdx, colIdx, e) {
                    if (e.button && e.button == 1) return true
                    var cm = self.getColumnModel()
                    var col = cm.getColumnId(colIdx)
                    var rec = self.store.getAt(rowIdx)
                    var row = rec.data
                    switch (col) {
                        case 'cicon':
                            //self.goTo(row)
                            break;
                        case 'cpos':
                            var cur = self.selected
                            isInSelected = false
                            Ext.each(cur, function(r) {
                                if (r.data.id == rec.data.id) {
                                    isInSelected = true
                                    return false
                                }
                            })
                            if (!isInSelected) cur.push(rec)
                            Ext.each(cur, function(rec) {
                                var row = rec.data
                                if (row.pos) {
                                    mpd.cmd( ['deleteid', row.id] )
                                } else {
                                    switch (row.type) {
                                        case 'file': 
                                            mpd.cmd( ['add', row.file] )
                                            break;
                                        case 'directory': 
                                            mpd.cmd( ['add', row.directory] )
                                            break;
                                        default:
                                            mpd.cmd( ['add', row.type, row.title] )
                                    }                                        
                                }
                                rec.set('pos', "..")
                            })
                            sm.clearSelections()
                            self.selected = []
                            break;
                    }
                },
                "mouseover": function (e) {
                    var v = self.getView()
                    var cm = self.getColumnModel()
                    var colIdx = v.findCellIndex(e.getTarget())
                    if (colIdx !== false) {
						var col = cm.getColumnId(colIdx)
						if (col == 'cpos') self.onHover()
					}
                },
                "mouseout": function (e) {
                    var v = self.getView()
                    var cm = self.getColumnModel()
                    var colIdx = v.findCellIndex(e.getTarget())
                    if (colIdx !== false) {
						var col = cm.getColumnId(colIdx)
						if (col == 'cpos') {
							self.onHoverOut()
						}
					}
                },
                "rowcontextmenu": function (grid, rowIdx, event) {
					event.stopEvent()
					var sm = grid.getSelectionModel()
					if (!sm.isSelected(rowIdx)) sm.selectRow(rowIdx, true)
					var recs = sm.getSelections()
					var d = []
					Ext.each(recs, function(item) {
						d.push(item.data)
					})
					mpd.context.Show(d, event)
				},
                'rowdblclick': function(g, rowIdx, e) {
                    var row = self.getStore().getAt(rowIdx).data
                    self.goTo(row)
                }
            }
        });
        Ext.apply(this, config)
        mpd.browser.GridBase.superclass.constructor.apply(this, arguments);

        var sm = self.getSelectionModel()
        this.selected = []
        this.onHover = function(evt, el) {
            var sel = Ext.select(".x-grid3-row-selected", self.el)
            sel.addClass('simulated_hover')
            self.selected = sm.getSelections()
        }
        this.onHoverOut = function(evt, el) {
            Ext.select(".x-grid3-body .simulated_hover", self.el).removeClass('simulated_hover')
            self.selected = []
        }   
        
		var tagLoader = new Ext.util.DelayedTask(function() {
			var recs = sm.getSelections()
			var ed = Ext.getCmp('tageditor')
			var ip = Ext.getCmp('infopanel')
			if (ed) ed.loadRecords(recs)
			if (ip) ip.loadRecord(recs[0])
		})
		sm.on('selectionchange', function() {
			tagLoader.delay(300)
		})
    },
    db_refresh: function(){
		if (this.store.getCount() > 0) {
			if (!this.store.lastOptions) {
				this.store.load({params: {start: 0, limit: mpd.PAGE_LIMIT}})
			} else {
				this.store.reload()
			}
		}
	}
})


mpd.browser.DbBrowser = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.DbBrowser.superclass.constructor.apply(this, arguments);

        var self = this
        this.getTopToolbar().add({
            iconCls: 'icon-home',
            handler: function(){ self.goTo('/')}
        })
    },

    goTo: function(obj) {
		if (Ext.isObject(obj)) {
			var itemType = obj.type
			dir = obj[obj.type]
		} else {
			var itemType = 'directory'
			var dir = obj
		}
        if (dir && dir != "/" && dir.substr(0,1) == "/") dir = dir.slice(1)
        dir = (Ext.isDefined(dir)) ? dir : this.cwd
        var isSearch = false
        var g = this
        var store = this.store

        // Load new location
		switch (itemType) {
			case 'search':
				isSearch = true;
				store.baseParams = {cmd: 'search any "' + dir + '"'};
				break;
			case 'playlist': 
				store.baseParams = {cmd: 'listplaylistinfo "' + dir + '"'};
				break;
			case 'directory':
				store.baseParams = {cmd: 'lsinfo "' + dir + '"'};
				break;
			case 'file':
				if (obj.pos) {
					mpd.cmd( ['playid', obj.id] )
				} else {
					mpd.cmd( ['add', obj.file] )
				}
				return null;
				break;
			default:
				store.baseParams = {cmd: 'find ' + itemType +' "' + dir + '"'};
		}
		
		// Remove any sort
		var sortField = (store.sortInfo) ? store.sortInfo.field : null
		if (sortField) {
			var vw = g.getView()
			vw.mainHd.select('td').removeClass(['sort-asc', 'sort-desc'])
			store.sortInfo = {'field': '', 'dir': ''}
		}
		
        var tb = g.getTopToolbar()
        var p = g.findParentByType('panel')
        var t = '/'
        if (dir != this.cwd || isSearch) {
            if (!isSearch) this.cwd = dir
            store.load({
				params: {
					'start': 0, 
					'limit': mpd.PAGE_LIMIT
				}
			})
			
            // Remove any existing Path buttons
            btn = tb.getComponent(1)
            while (btn) {
                tb.remove(btn)
                btn = tb.getComponent(1)
            }

            // Ensure the Home button is there
            btn = tb.getComponent(0)
            if (!btn) tb.addButton({
                iconCls: 'icon-home',
                dir: '/',
                handler: function(){g.goTo(this.dir)}
            })

            // Create new Path buttons
            x = 1
            if (dir != '/') {
                if (isSearch) {
                    tb.insertButton(x++, {
                        text: 'Clear Search ('+ dir + ')',
                        id: this.cwd,
                        handler: function(){
                            g.cwd = "<<<Nothing>>>"
                            g.goTo(this.id)
                        }
                    })
                    tb.add("->")
                    tb.addButton({
                        text: 'Add All',
                        iconCls: 'icon-add',
                        handler: function(){mpd.cmd(['add', 'search', dir])}
                    })
                } else {
                    if (dir > '/') {
                        var parts = dir.split("/")
                        var path = ''
                        var self = this
                        for (var i = 0, len = parts.length; i < len; i++) {
                            t = parts[i]
                            path += '/' + t
                            tb.insert(x++, '-')
                            tb.insertButton(x++, {
                                text: t,
                                dir: path,
                                handler: function(){g.goTo(this.dir)}
                            })
                        }
                    }
                    tb.add("->")
                    tb.addButton({
                        text: 'Add All',
                        iconCls: 'icon-add',
                        handler: function(){mpd.cmd( ['add', itemType, dir])}
                    })
                    p.setTitle(t)
                    p.setIconClass('icon-'+itemType)
                }
            }
            tb.doLayout()
        } else {
            g.getView().holdPosition = true
            store.reload()
        }
    }
});
Ext.reg('db-browser', mpd.browser.DbBrowser)


mpd.browser.TagEditor = Ext.extend(Ext.grid.PropertyGrid, {
    constructor: function(config) {
		this.changes = {}
		this.records = []
		this.btnReset = new Ext.Button({
			text: 'Clear Changes',
			iconCls: "icon-cancel",
			disabled: true,
			handler: this.reloadRecords.createDelegate(this)
		})
		this.btnSave = new Ext.Button({
			text: 'Save Changes',
			iconCls: "icon-save",
			disabled: true,
			handler: this.saveChanges.createDelegate(this)
		})
		
        Ext.apply(this, {
			id: 'tageditor',
			title: 'Edit Tags',
			bbar: ["->", this.btnReset, "-", this.btnSave],
			iconCls: "icon-edit-tags",
			listeners: {
				'beforepropertychange': function(src, key, val, old) {
					if (key.charAt(0) == "(") return false
					this.changes[key] = val
					this.btnSave.enable()
					this.btnReset.enable()
				},
				'afterrender': function () {
					this.loadMask = new Ext.LoadMask(this.bwrap, {msg:"Saving Changes..."});
				}
			}
		})
        Ext.apply(this, config)
        mpd.browser.TagEditor.superclass.constructor.apply(this, arguments);
    },
    saveChanges: function() {
		this.loadMask.show()
		var r = this.records
		var d = r[0].data
		var data = {'itemtype': d.type, 'id': d[d.type]}
		if (r.length > 1) {
			files = []
			Ext.each(r, function(item) {
				files.push(item.data.file)
			})
			data.id = files.join(";")
		}
		Ext.apply(data, this.changes)
		
		Ext.Ajax.request({
			url: '../edit',
			params: data,
			success: function(response, opts) {
				mpd.checkStatus.delay(0)
				this.loadMask.hide()
			},
			failure: function(response, opts) {
				Ext.Msg.alert('Error', response.responseText)
				mpd.checkStatus.delay(0)
				this.loadMask.hide()
			},
			scope: this
		})
	},
    loadRecords: function(records) {
		// Filter recods for file(s) or a single playlist selection
		var recs = []
		if (Ext.isArray(records)) {
			Ext.each(records, function(item) {
				if (item.data.type == 'file') recs.push(item)
			})
		}
		this.records = recs
		
		// Destroy old editors
		this.customEditors = this.customEditors || {}
		Ext.iterate(this.customEditors, function(key, item, obj){
			item.destroy.apply(item)
			delete obj[key]
		})
		
		var len = recs.length
		var src = {}
		if (len > 1) {
			src['(file)'] = '<Multiple Records>'
			Ext.each(mpd.TAG_TYPES, function (key) {
				key_lower = key.toLowerCase()
				var vals = []
				for (var i=0; i<len; i++) {
					vals.push(recs[i].data[key_lower])
				}
				vals = Ext.unique(vals)
				if (vals.length > 1) {
					vals.unshift('<Multiple Values>')
					var ed = new Ext.form.ComboBox({
						typeAhead: true,
						triggerAction: 'all',
						lazyRender:true,
						mode: 'local',
						store: vals
					})
					this.customEditors[key] = new Ext.grid.GridEditor(ed)
				}
				src[key] = vals[0]
			}, this)
		} else if (len > 0) {
			data = recs[0].data
			src['('+data.type+')'] = data[data.type]
			Ext.each(mpd.TAG_TYPES, function (key) {
				src[key] = data[key.toLowerCase()]
			})
		}
		
		// Reset state and load new values
		this.btnSave.disable()
		this.btnReset.disable()
		this.changes = {}
		this.setSource(src)
	},
    reloadRecords: function() {
		this.loadRecords(this.records)
	}	
})
Ext.reg('tag-editor', mpd.browser.TagEditor)


mpd.browser.InfoPanel = Ext.extend(Ext.Panel, {
    constructor: function(config) {
        Ext.apply(this, {
			id: 'infopanel',
			title: 'Cover &amp; Lyrics',
			iconCls: 'icon-cover',
			autoScroll: true,
			record: {data: {}},
			tpl: new Ext.XTemplate(
			'<center style="font-size:12px;font-family:helvetica,tahoma,sans-serif">',
				'<div class="x-toolbar">',
					'<img onclick="showImage(this)" style="max-width:95%;max-height:256px;margin-top:5px" src="{cover_url}"><br>',
					'<b>{album}</b><br>',
					'by <i>{artist}</i>',
				'</div><br>',
				'<p id="lyricsTitle" style="font-size:1.5em;font-weight:bold">{title}</p>',
				'<div style="padding:10px">',
					'<div id="lyricsBox" Searching for Lyrics...</div><br>',
					'<a href="#" onclick="editLyrics(this)">Edit Lyrics</a>',
				'</div>',
			'</center>'
			)
		})
			
        Ext.apply(this, config)
        mpd.browser.InfoPanel.superclass.constructor.apply(this, arguments);
	},
	loadLyrics: function() {
		if (!Ext.isObject(this.record.data)) return null
		var d = this.record.data
		Ext.fly("lyricsTitle").update(d.title)
		Ext.Ajax.request({
			url: '../lyrics',
			params: {
				'title': d.title,
				'artist': d.artist
			},
			callback: function(opts, success, response) {
				Ext.fly("lyricsBox").update(response.responseText)
			}
		})
		this.doLayout()		
	},
	loadRecord: function(rec) {
		if (!Ext.isObject(rec)) return null
		if (!Ext.isObject(rec.data)) return null
		var d = rec.data, old = this.record.data
		if (d.type != 'file') return null
		if ((d.artist != old.artist) || (d.album != old.album)) {
			d.cover_url = '../covers?' + Ext.urlEncode({
				artist: d.artist,
				album:d.album
			})
			this.update(d)
			this.doLayout()
		}
		this.record = rec
		this.loadLyrics()
	},
	reload: function() {
		this.loadRecord(this.record)
	}	
})
Ext.reg('info-panel', mpd.browser.InfoPanel)


// Remove the x-accordion-hd class to make it more attractive...
Ext.override(Ext.layout.Accordion, {
	renderItem : function(c){
        if(this.animate === false){
            c.animCollapse = false;
        }
        c.collapsible = true;
        if(this.autoWidth){
            c.autoWidth = true;
        }
        if(this.titleCollapse){
            c.titleCollapse = true;
        }
        if(this.hideCollapseTool){
            c.hideCollapseTool = true;
        }
        if(this.collapseFirst !== undefined){
            c.collapseFirst = this.collapseFirst;
        }
        if(!this.activeItem && !c.collapsed){
            this.setActiveItem(c, true);
        }else if(this.activeItem && this.activeItem != c){
            c.collapsed = true;
        }
        Ext.layout.AccordionLayout.superclass.renderItem.apply(this, arguments);
        //c.header.addClass('x-accordion-hd');
        c.on('beforeexpand', this.beforeExpand, this);
    }
})


mpd.browser.TabPanel = Ext.extend(Ext.TabPanel, {
    constructor: function(config) {
        var self = this
        Ext.apply(this, {
            id: 'dbtabbrowser',
            activeTab: 0,
            bufferResize: true,
            border: false,
            items: [
                {
                    id: 'new_tab',
                    iconCls: 'icon-newtab',
                    layout: 'fit',
                    closable: false
                }
            ],
            listeners: {
				'render': function() {
					self.addTab('/', true)
				},
                'beforetabchange': function(pnl, new_tab, old_tab) {
                    if (new_tab.id == 'new_tab') {
                        self.addTab()
                        return false
                    }
                }
            }
        })
        Ext.apply(this, config)
        mpd.browser.TabPanel.superclass.constructor.apply(this, arguments);
    },
    _getActiveTab: function () {
        var atab = this.getActiveTab()
        if (!atab) {
            atab = this.get(this.items.getCount()-1)
            self.setActiveTab(atab)
        }
        return atab
	},
    getActiveBrowser: function () {
        var atab = this._getActiveTab()
        if (atab) return atab.get(0)
        return null
    },
    addTab: function (dir, disableClose) {
        var idx = this.items.length - 1
        dir = dir || '/'
        var t = this.insert(idx, {
			layout: 'fit',
			iconCls: 'icon-directory',
			title: 'Home',
			closable: !disableClose,
			items: {xtype: 'db-browser'}
        })
        this.setActiveTab(t)
        t.get(0).goTo(dir)
        return t
    }
})
Ext.reg('browser-tab-panel', mpd.browser.TabPanel)


mpd.browser.TabPlaylist = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        config.tbar = mpd.browser.createPlaylistToolbar()
        config.cmd = 'playlistinfo'
        Ext.apply(this, config)
        mpd.browser.TabPlaylist.superclass.constructor.apply(this, arguments);        
    }
})
Ext.reg('tab-playlist', mpd.browser.TabPlaylist)


mpd.browser.TabSearch = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.TabSearch.superclass.constructor.apply(this, arguments);
        this.getTopToolbar().add( new Ext.app.SearchField({store: this.store}) )
    }
})
Ext.reg('tab-search', mpd.browser.TabSearch)


mpd.browser.TreeLoader = Ext.extend(Ext.tree.TreeLoader, {
	createNode: function(attr) {
        if (!attr.text) attr.text = attr.title
        if (attr.songs) attr.text += ' <span style="color:#808080">(' + attr.songs + ')</span>'
		if (!attr.iconCls) attr.iconCls = 'icon-' + attr.type
        switch (attr.type) {
            case 'playlist':
                attr.leaf = true; break;
            case 'album':
                attr.leaf = true; break;
        }
		return Ext.tree.TreeLoader.prototype.createNode.call(this, attr);
	}	
})

mpd.browser.TreePanel = Ext.extend(Ext.tree.TreePanel, {
    constructor: function(config) {
        Ext.apply(this, {
            title: 'Navigation',
            //enableDragDrop: true,
            plugins: [Ext.ux.PanelCollapsedTitle],
            forceLayout: true,
            autoScroll: true,
            useArrows: true,
            singleExpand: true,
            loader: new mpd.browser.TreeLoader({
                dataUrl: '../query',
                baseParams: {
                    cmd: 'lsinfo',
                    sort: 'title'
                },
                baseAttrs: {
                    singleClickExpand: true
                },
                listeners: {
					'beforeload': function(treeLoader, node) {
						var a = node.attributes
						var cmd = a.cmd
                        if (!cmd) {
                            var t = a.type
                            var val = a[t]
                            switch (t) {
                                case 'directory':
                                    cmd = 'lsinfo "' + val + '"';
                                    break;
                                case 'playlist':
                                    cmd = 'lsinfo';
                                    break;
                                default:
                                    cmd = 'list album ' + t + ' "' + val + '"';
                                    break;
                            }
                        }
                        treeLoader.baseParams.mincount = a.mincount || 0
                        treeLoader.baseParams.cmd = cmd
					}
				}
            }),
            root: new Ext.tree.AsyncTreeNode({
                expanded: true,
                singleClickExpand: true,
                children: [{
                    nodeType: 'async',
                    id: 'playlist:',
                    text: '<b>Playlists</b>',
                    iconCls: 'icon-group-playlist',
                    cmd: 'listplaylists',
                    listeners: {
						beforeexpand: function (self) {
							self.loaded = false
						}
					}
                }, {
                    text: '<b>Artist/Albums</b>',
                    iconCls: 'icon-group-album',
                    children: [
						{
							nodeType: 'async',
							id: 'artist:',
							text: '<b>All Artists</b>',
							iconCls: 'icon-group-artist',
							cmd: 'list artist'
						},
						{
							nodeType: 'async',
							id: 'artist:4',
							text: '<b>Minimum 4 Songs</b>',
							iconCls: 'icon-group-artist',
							cmd: 'list artist',
							mincount: 4
						},
						{
							nodeType: 'async',
							id: 'artist:10',
							text: '<b>Minimum 10 Songs</b>',
							iconCls: 'icon-group-artist',
							cmd: 'list artist',
							mincount: 10
						}
                    ]
                }, {
                    nodeType: 'async',
                    id: 'directory:',
                    text: '<b>Folders</b>',
                    iconCls: 'icon-directory',
                    type: 'directory',
                    directory: '/',
                    cmd: 'lsinfo'
                }] 
            }),
            rootVisible: false,
            listeners: {
                'click': function(node) {
					attr = node.attributes
                    Ext.getCmp('dbtabbrowser').getActiveBrowser().goTo(attr)
                },
                'afterrender': function (tree) {
                    appEvents.subscribe('db_updatechanged', function(){
                        tree.root.eachChild(function(node){
                            if (node.isLoaded()) node.reload()
                        })
                    })
                },
                'contextmenu': function(node, event) {
					var a = node.attributes
					if(!a.type) return false
					if (a.type == 'playlist') {
						mpd.context.Show([a], event, function (item, event) {
							var id = item.id
							if (id == 'mpd-context-add') return null
							if (id == 'mpd-context-replace') return null
							var p = node.parentNode
							p.reload.defer(100, p)
						})
					} else {
						mpd.context.Show([a], event)
					}
				}
            }
        })
        Ext.apply(this, config)
        mpd.browser.TreePanel.superclass.constructor.apply(this, arguments);
    }
});
Ext.reg('mpdtree', mpd.browser.TreePanel)
