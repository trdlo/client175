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
        {'name': 'songs', 'type': 'int'},
        {'name': 'time', 'type': 'int'},
        {'name': 'ptime'},
        {'name': 'cls'}
    ]
    return fields.concat(mpd.EXTRA_FIELDS)
}


mpd.browser.renderIcon = function(val, meta, rec, row, col, store) {
    return '<div class="icon icon-'+val+'"/>'
}
mpd.browser.renderIconWide = function(val, meta, rec, row, col, store) {
    return '<div class="icon icon-'+val+'" style="margin-left:24px !important"/>'
}


Ext.override(Ext.grid.GridView, {
    holdPosition: false,
    onLoad : function(){
        if (!this.holdPosition) this.scrollToTop();
        this.holdPosition = false
    }
});


mpd.browser.GridBase = Ext.extend(Ext.grid.GridPanel, {
    constructor: function(config) {
        var self = this
        this.cwd = ''
        this.config = config || {}
        var cmd = this.config.cmd || ''  
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
			
        this.filter = new Ext.app.FilterField({
            store: this.store,
            width:140
        })
		
		var cols = [
			{id: 'cpos', header: "#", width: 23, dataIndex: 'pos', align: 'left',
				renderer: function(val, meta, rec){
					if (self.cwd == '') return ''
					if (val) {
						return '<div class="remove">' + val + '.</div>'
					} else {
						return '<div class="add">'
					}
				}
			},
			{id: 'ctrack', header: 'Track', dataIndex: 'track', width: 40, align: 'right', hidden: true},
			{id: 'cicon', header: "Icon", width: 22, dataIndex: 'type', renderer: mpd.browser.renderIcon},
			{id: 'ctitle', header: "Title", dataIndex: 'title'},
			{id: 'calbum', header: "Album", dataIndex: 'album'},
			{id: 'cartist', header: "Artist", dataIndex: 'artist'},
			{id: 'csongs', header: 'Songs',	dataIndex: 'songs',	width: 60,	hidden: true},
			{id: 'ctime', header: "Time", width: 60, dataIndex: 'time',
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
		this._fullColModel = new Ext.grid.ColumnModel({
			columns: cols,
			defaults: {
				width: 150,
				sortable: true
			}
		})
		
        Ext.apply(this, {
            store: this.store,
            region: 'center',
            cm: this._homeColModel,
            autoExpandColumn: 'ctitle',
            autoExpandMin: 150,
            autoExpandMax: 400,
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
                                            rec.set('pos', "..")
                                            break;
                                        case 'directory': 
                                            mpd.cmd( ['add', row.directory] )
                                            rec.set('pos', "..")
                                            break;
                                        default:
											if (row[row.type] > "") {
												mpd.cmd( ['add', row.type, row.title] )
												rec.set('pos', "..")
											}
                                    }                                        
                                }
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
					if (self.cwd == '') return false
					var sm = grid.getSelectionModel()
					if (!sm.isSelected(rowIdx)) sm.selectRow(rowIdx)
					var recs = sm.getSelections()
					var d = []
					Ext.each(recs, function(item) {
						d.push(item.data)
					})
					mpd.util.context.show(d, event)
				}
            }
        });
        Ext.apply(this, config)
        mpd.browser.GridBase.superclass.constructor.apply(this, arguments);

        mpd.events.on('playlists', this.playlists_refresh, this)
        mpd.events.on('playlist', this.db_refresh, this)
        mpd.events.on('db_update', this.db_refresh, this)
        this.on('beforedestroy', function(){
			mpd.events.un('playlists', this.playlists_refresh, this)
			mpd.events.un('playlist', this.db_refresh, this)
			mpd.events.un('db_update', this.db_refresh, this)
		})
		
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
        
		var ed = Ext.getCmp('tageditor')
		var ip = Ext.getCmp('infopanel')
		var tagLoader = new Ext.util.DelayedTask(function() {
			var recs = sm.getSelections()
			if (ed) ed.loadRecords(recs)
			if (ip) ip.loadRecord(recs[0])
		})
		sm.on('selectionchange', function() {
			tagLoader.delay(300)
		})
		this.store.on('load', function(s) {
			var rec = s.getAt(0)
			if (rec) ip.loadRecord(rec)
		})
        this.on('rowdblclick', this.rowDblClick, this)
    },	
    db_refresh: function(){
		if (this.store.getCount() > 0) {
			if (!this.store.lastOptions) {
				this.store.load({params: {start: 0, limit: mpd.PAGE_LIMIT}})
			} else {
				this.store.reload()
			}
		}
	},
	playlists_refresh: function(){
		if (this.cwd == 'playlist:') this.db_refresh()
	},
    goTo: function(obj) {
		if (Ext.isObject(obj)) {
			var itemType = obj.type
			if (itemType == 'time') {
				itemType = 'directory'
				var dir = '/'
			} else {
				var dir = obj[obj.type]
			}
		} else {
			if (obj == '') {
				var itemType = 'home'
				var dir = ''
			} else {
				var itemType = 'directory'
				if (obj) {
					var dir = obj
					if (dir != "/" && dir.substr(0,1) == "/") dir = dir.slice(1)
				} else {
					dir = this.cwd
				}
			}
		}
        var isSearch = false
        var isList = false
        var cmd = ''

        // Load new location
		switch (itemType) {
			case 'home':
				cmd = ''
				break;
			case 'search':
				isSearch = true;
				cmd = 'search any "' + dir + '"'
				break;
			case 'directory':
				cmd = 'lsinfo "' + dir + '"'
				break;
			case 'file':
				if (obj.pos) {
					mpd.cmd( ['playid', obj.id] )
				} else {
					mpd.cmd( ['add', obj.file] )
				}
				return null;
				break;
			case 'playlist': 
				if (dir > "") {
					cmd = 'listplaylistinfo "' + dir + '"'
				} else {
					cmd = 'listplaylists'
					isList = true
				}
				break;
			default:
				if (dir > "") {
					cmd = 'find ' + itemType +' "' + dir + '"'
				} else {
					cmd = 'list "' + itemType +'"'
					isList = true
				}
		}
		
        var g = this
        var store = this.store
        store.removeAll()
        store.baseParams = {'cmd': cmd}
		// Remove any sort
		var sortField = (store.sortInfo) ? store.sortInfo.field : null
		if (sortField) {
			var vw = g.getView()
			vw.mainHd.select('td').removeClass(['sort-asc', 'sort-desc'])
			store.sortInfo = {'field': '', 'dir': ''}
		}
		if (cmd == '') {
			this.showHomeView()
		} else {
			if (isList) {
				store.sortInfo = {'field': 'title', 'dir': 'ASC'}
				this.showSimpleView()
			} else {
				this.showFullView()
			}
		}
		
        var tb = g.getTopToolbar()
        var p = g.findParentByType('panel')
        var t = ''
        if (dir != this.cwd || isSearch || isList) {
            if (!isSearch && !isList) this.cwd = dir
            if (isList) {
				this.cwd = itemType + ":"
			}
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
                dir: '',
                handler: function(){g.goTo(this.dir)}
            })

            // Create new Path buttons
            x = 1
			if (isSearch) {
				t = 'Search: ' + dir
				tb.insertButton(x++, {
					text: 'Clear Search ('+ dir + ')',
					dir: this.cwd,
					handler: function(btn){
						g.cwd = "<<<Nothing>>>"
						g.goTo(this.dir)
					}
				})
				tb.add("->")
				tb.addButton({
					text: 'Add All',
					iconCls: 'icon-add',
					handler: function(){mpd.cmd(['add', 'search', dir])}
				})
			} else if (isList) {
				t = titleCase(itemType) + 's'
				var base = {'type': itemType}
				base[itemType] = ''
				tb.insert(x++, '-')
				tb.insertButton(x++, {
					text: t,
					iconCls: 'icon-group-unknown icon-group-'+itemType,
					id: itemType+":",
					handler: function(){ g.goTo(base) }
				})
				tb.add("->")
				tb.addButton({
					text: 'Add All',
					iconCls: 'icon-add',
					handler: function(){mpd.cmd(['add', '/'])}
				})
			} else if (itemType == 'directory') {
				t = 'Folders'
				tb.insert(x++, '-')
				tb.insertButton(x++, {
					text: 'Folders',
					iconCls: 'icon-directory',
					dir: '/',
					handler: function(){ g.goTo(this.dir) }
				})
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
			} else if (itemType != 'home') {
				t = dir
				var base = {'type': itemType}
				base[itemType] = ''
				tb.insert(x++, '-')
				tb.insertButton(x++, {
					text: titleCase(itemType) + 's',
					iconCls: 'icon-group-unknown icon-group-'+itemType,
					dir: itemType+":",
					handler: function(){ g.goTo(base) }
				})
				tb.insert(x++, '-')
				tb.insertButton(x++, {
					text: dir,
					iconCls: 'icon-'+itemType,
					dir: this.cwd,
					handler: function(){ g.goTo(obj) }
				})
				tb.add("->")
				tb.addButton({
					text: 'Add All',
					iconCls: 'icon-add',
					handler: function(){mpd.cmd(['add', itemType, dir])}
				})
			}
				
			p.setTitle(t)
			p.setIconClass('icon-'+itemType)
            tb.doLayout()
        } else {
            g.getView().holdPosition = true
            store.reload()
        }
    },
    _currentView: 'home',
    _fullColModel: null,
    _homeColModel: new Ext.grid.ColumnModel({
		columns: [
			{id: 'cicon', header: "Icon", align: 'right',  width: 45, 
				dataIndex: 'type', renderer: mpd.browser.renderIconWide},
			{id: 'ctitle', header: "Statistics", dataIndex: 'title'}
		]
    }),
    _simpleColModel: new Ext.grid.ColumnModel({
		columns: [
			{id: 'cpos', header: "#", width: 23, dataIndex: 'pos', align: 'left',
				renderer: function(val, meta, rec){
					if (self.cwd == '') return ''
					if (val) {
						return '<div class="remove">' + val + '.</div>'
					} else {
						return '<div class="add">'
					}
				}
			},
			{id: 'cicon', header: "Icon", width: 22, dataIndex: 'type', renderer: mpd.browser.renderIcon},
			{id: 'ctitle', header: "Title", dataIndex: 'title'},
			{id: 'csongs', header: 'Songs',	dataIndex: 'songs',	width: 80},
			{id: 'ctime', header: "Time", width: 80, dataIndex: 'time',
				renderer: function(val, meta, rec){
					return rec.data.ptime
				}
			}
		],
		defaults: {
			width: 150,
			sortable: true
		}
    }),
	showFullView: function() {
		if (this._currentView == 'full') return null
		this.reconfigure(this.store, this._fullColModel)
		this._currentView = 'full'
	},
	showHomeView: function() {
		if (this._currentView == 'home') return null
		this.reconfigure(this.store, this._homeColModel)
		this._currentView = 'home'
	},
    showSimpleView: function() {
		if (this._currentView == 'simple') return null
		this.reconfigure(this.store, this._simpleColModel)
		this._currentView = 'simple'
	}
})


mpd.browser.DbBrowserPanel = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.DbBrowserPanel.superclass.constructor.apply(this, arguments);

        this.getTopToolbar().add({
            iconCls: 'icon-home',
            handler: function(){ this.goTo('')},
            scope: this
        })
    },
    rowDblClick: function(g, rowIdx, e) {
		var row = g.getStore().getAt(rowIdx).data
		this.goTo(row)
	}
});
Ext.reg('db-browser', mpd.browser.DbBrowserPanel)


mpd.browser.PlaylistPanel = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        config.tbar = mpd.util.createPlaylistToolbar()
        config.tbar.addSeparator()
        config.tbar.addButton({
			iconCls: 'icon-sidebar',
			tooltip: 'Show in Sidebar',
			handler: function(btn) {
				var sb = Ext.getCmp('mpd-sidebar')
				var p = sb.add({
					xtype: 'playlist_sidebar',
					playlistStyle: 'albumcovers',
					iconCls: 'icon-playlist'
				})
				p.store.load()
				sb.doLayout()
				sb.layout.setActiveItem('playlistsidebar')
				Ext.state.Manager.set('playlistLocation', 'sidebar')
				this.ownerCt.ownerCt.remove(this.ownerCt, true)
			},
			scope: this
		})
        config.cwd = '<<<playlist>>>'
		config.cmd = 'playlistinfo'
        Ext.apply(this, config)
        mpd.browser.PlaylistPanel.superclass.constructor.apply(this, arguments);		
    },
    rowDblClick: function(g, rowIdx, e) {
		var row = g.getStore().getAt(rowIdx).data
		mpd.cmd(['playid', row.id])
	},
    db_refresh: function(){
		if (!this.store.lastOptions) {
			this.store.load({params: {start: 0, limit: mpd.PAGE_LIMIT}})
		} else {
			this.store.reload()
		}
	}
})
Ext.reg('tab-playlist', mpd.browser.PlaylistPanel)


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
					self.addTab('', true)
				},
                'beforetabchange': function(pnl, new_tab, old_tab) {
                    if (new_tab.id == 'new_tab') {
                        self.addTab('')
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
            this.setActiveTab(atab)
        }
        return atab
	},
    getActiveBrowser: function () {
		/** Returns the active DbBrowser tab.
		 *  First try active tab,
		 *  then try first tab,
		 *  finally, just add a new tab and return that.
		 **/
        var atab = this._getActiveTab()
        if (atab && atab.get(0).cwd != '<<<playlist>>>') {
			return atab.get(0)
        } else {
			atab = this.get(0)
			if (atab && atab.get(0).cwd != '<<<playlist>>>') {
				this.setActiveTab(atab)
				return atab.get(0)
			} else {
				atab = self.addTab()
				return atab.get(0)
			}
		}
    },
    addPlaylistTab: function () {
        var idx = this.items.length - 1
        var t = this.insert(idx, {
			layout: 'fit',
			iconCls: 'icon-playlist',
			title: 'Playlist',
			closable: false,
			items: {'xtype': 'tab-playlist'}
        })
        var g = t.get(0)
        g.showFullView()
        g.getStore().load({params:{start:0, limit:200}})
        this.setActiveTab(t)
        return t
    },
    addTab: function (dir, disableClose) {
        var idx = this.items.length - 1
        var t = this.insert(idx, {
			layout: 'fit',
			iconCls: 'icon-directory',
			title: 'Home',
			closable: !disableClose,
			items: {'xtype': 'db-browser'}
        })
        this.setActiveTab(t)
		if (Ext.isDefined(dir)) t.get(0).goTo(dir)
        return t
    }
})
Ext.reg('browser-tab-panel', mpd.browser.TabPanel)


mpd.browser.TreeLoader = Ext.extend(Ext.tree.TreeLoader, {
	createNode: function(attr) {
        if (!attr.text) attr.text = attr.title
        if (attr.songs) attr.text += ' <span class="song-count">(' + attr.songs + ')</span>'
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
                                case 'genre':
                                    cmd = 'list artist genre "' + val + '"';
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
                children: [
                {
                    nodeType: 'async',
                    id: 'playlist:',
                    text: '<b>Playlists</b>',
                    iconCls: 'icon-group-playlist',
                    cmd: 'listplaylists'
                }, 
                {
                    text: '<b>Artist / Albums</b>',
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
                }, 
                {
                    nodeType: 'async',
                    id: 'genre:',
                    text: '<b>Genre / Artist / Album</b>',
                    iconCls: 'icon-group-album',
                    type: 'genre',
                    cmd: 'list genre'
                }, 
                {
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
					var attr = node.attributes
					var tb = Ext.getCmp('dbtabbrowser')
					if (attr.type && tb) {
						tb.getActiveBrowser().goTo(attr)
					}
                },
                'afterrender': function (tree) {
                    mpd.events.on('db_update', function(){
                        tree.root.eachChild(function(node){
                            if (node.isLoaded()) node.reload()
                        })
                    })
                    mpd.events.on('playlists', function(){
                        var node = tree.root.findChild('id', 'playlist:')
                        if (node.isLoaded()) node.reload()
                    })
                },
                'contextmenu': function(node, event) {
					var a = node.attributes
					if(!a.type) return false
					mpd.util.context.show([a], event)
				}
            }
        })
        Ext.apply(this, config)
        mpd.browser.TreePanel.superclass.constructor.apply(this, arguments);
    }
});
Ext.reg('mpdtree', mpd.browser.TreePanel)
