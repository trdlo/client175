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


mpd.browser.renderIcon = function(val, meta, rec, row, col, store) {
    return '<div class="icon icon-'+val+'"/>'
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
			{id: 'cicon', header: "Icon", width: 24, dataIndex: 'type', renderer: mpd.browser.renderIcon},
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
					if (!sm.isSelected(rowIdx)) sm.selectRow(rowIdx)
					var recs = sm.getSelections()
					var d = []
					Ext.each(recs, function(item) {
						d.push(item.data)
					})
					mpd.util.context.show(d, event)
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


mpd.browser.DbBrowserPanel = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.DbBrowserPanel.superclass.constructor.apply(this, arguments);

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
Ext.reg('db-browser', mpd.browser.DbBrowserPanel)


mpd.browser.PlaylistPanel = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        config.tbar = mpd.util.createPlaylistToolbar()
        config.cmd = 'playlistinfo'
        Ext.apply(this, config)
        mpd.browser.PlaylistPanel.superclass.constructor.apply(this, arguments);        
    }
})
Ext.reg('tab-playlist', mpd.browser.PlaylistPanel)


mpd.browser.SearchPanel = Ext.extend(mpd.browser.GridBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.SearchPanel.superclass.constructor.apply(this, arguments);
        this.getTopToolbar().add( new Ext.app.SearchField({store: this.store}) )
    }
})
Ext.reg('tab-search', mpd.browser.SearchPanel)


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
					attr = node.attributes
                    Ext.getCmp('dbtabbrowser').getActiveBrowser().goTo(attr)
                },
                'afterrender': function (tree) {
                    appEvents.subscribe('db_updatechanged', function(){
                        tree.root.eachChild(function(node){
                            if (node.isLoaded()) node.reload()
                        })
                    })
                    appEvents.subscribe('playlistschanged', function(){
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
