var PAGE_LIMIT = 200
mpd.dbFields = function() {
    return [
        {'name': 'id'},
        {'name': 'file'},
        {'name': 'directory'},
        {'name': 'playlist'},
        {'name': 'type'},
        {'name': 'pos', 'type': 'int'},
        {'name': 'artist'},
        {'name': 'album'},
        {'name': 'title'},
        {'name': 'track'},
        {'name': 'time', 'type': 'int'},
        {'name': 'ptime'},
        {'name': 'genre'},
        {'name': 'date'},
        {'name': 'composer'},
        {'name': 'performer'},
        {'name': 'disc'},
        {'name': 'cls'},
        {'name': 'any'}
    ]
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
        html: '<center style="margin:5px">' +
            '<img src="'+src+'"><br>' +
            lbl +
            '</center>',
        y: 60
    }).show(el)
}
Ext.namespace('mpd.browser')

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
            animCollapse: false,
            items: self.list,
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
            tbar: new mpd.browser.PlaylistToolbar(),
            bbar: [
                'Filter: ', ' ',
                new Ext.app.FilterField({
                    store: self.store,
                    width:160
                })
            ],
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
                        width: 0.125,
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
                        width: 0.125,
                        tpl:
                        '<tpl if="title">' +
                            '<div id="{id}" class="remove {cls}">{pos}.</div>' +
                        '</tpl>'
                    },
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl:
                        '<div class="{cls}">{title}' +
                        '<tpl if="!title">' +
                            '<b>{album}</b><tpl if="!album &amp;&amp; !artist">&nbsp;</tpl>' +
                            '<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br/></tpl>' +
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
                        width: 0.125,
                        tpl:
                        '<tpl if="title">' +
                            '<div id="{pl}" class="remove {cls}">{pos}.</div>' +
                        '</tpl>'
                    },
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl:
                        '<div class="{cls}">{title}' +
                        '<tpl if="cls == \'album-group-start\'">' +
                            '<img src="../covers?{[Ext.urlEncode({artist:values.artist,album:values.album})]}">' +
                            '<b>{album}</b><tpl if="!album &amp;&amp; !artist">&nbsp;</tpl>' +
                            '<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br/></tpl>' +
                            '<i>{artist}</i>' +
                        '</tpl>' +
                        '</div>'
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
                        rec = v.getRecord(sourceEl)
                        if (!rec.data.pos) return null
                        song = Ext.query("dt:nth(2)", sourceEl)
                        d = song[0].cloneNode(true);
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


mpd.browser.PlaylistToolbar = Ext.extend(Ext.Toolbar, {
    constructor: function(config) {
        Ext.apply(this, {
            items: [
                {
                    xtype: 'textfield',
                    id: 'txtplaylist',
                    width: 100,
                    listeners: {
                        afterrender: function (self) {
                            var n = Ext.value(mpd.status.playlistname, 'Untitled')
                            self.setValue(n)
                            appEvents.subscribe('playlistnamechanged', function(){
                                self.setValue(mpd.status.playlistname)
                            })
                        }
                    }
                },
                {
                    text: 'Save',
                    qtip: 'Save Playlist',
                    handler: function () {
                        mpd.cmd(['save', Ext.getCmp('txtplaylist').getValue()])
                    }
                }, '-',
                {
                    text: 'Clear',
                    qtip: 'Clear Playlist',
                    handler: function () {
                        mpd.cmd(['clear'])
                    }
                }
            ]
        })
        mpd.browser.PlaylistToolbar.superclass.constructor.apply(this, arguments);
    }
})


mpd.browser.TabBase = Ext.extend(Ext.grid.GridPanel, {
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
        this.filter = new Ext.app.FilterField({
            store: this.store,
            width:140
        })

        Ext.apply(this, {
            store: this.store,
            cm: new Ext.grid.ColumnModel({
                columns: [
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
                    {id: 'cdisc', header: "Disc", dataIndex: 'disc', hidden: true},
                    {id: 'cdate', header: "Date", dataIndex: 'date', hidden: true},
                    {id: 'cartist', header: "Artist", dataIndex: 'artist'},
                    {id: 'ccomposer', header: "Composer", dataIndex: 'composer', hidden: true},
                    {id: 'cperformer', header: "Performer", dataIndex: 'performer', hidden: true},
                    {id: 'cgenre', header: "Genre", dataIndex: 'genre', hidden: true},
                    {id: 'ctime', header: "Time", width: 40, dataIndex: 'time',
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
            autoExpandColumn: 'ctitle',
            autoExpandMin: 150,
            autoExpandMax: 300,
            closable: true,
            hideParent: true,
            //enableDragDrop: true,
            tbar: new Ext.Toolbar(),
            bbar: new Ext.PagingToolbar({
				pageSize: PAGE_LIMIT,
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
                                            mpd.cmd( ['add', encId(row.file)] )
                                            break;
                                        case 'directory': 
                                            mpd.cmd( ['add', encId(row.directory)] )
                                            break;
                                        default:
                                            mpd.cmd( ['add', row.type, encId(row.title)] )
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
                    if (colIdx) {
						var col = cm.getColumnId(colIdx)
						if (col == 'cpos') self.onHover()
					}
                },
                "mouseout": function (e) {
                    var v = self.getView()
                    var cm = self.getColumnModel()
                    var colIdx = v.findCellIndex(e.getTarget())
                    if (colIdx) {
						var col = cm.getColumnId(colIdx)
						if (col == 'cpos') {
							self.onHoverOut()
						}
					}
                },
                'rowdblclick': function(g, rowIdx, e) {
                    var row = self.getStore().getAt(rowIdx).data
                    self.goTo(row)
                }
            }
        });
        Ext.apply(this, config)
        mpd.browser.TabBase.superclass.constructor.apply(this, arguments);

        var sm = self.getSelectionModel()
        this.selected = []
        this.onHover = function(evt, el) {
            Ext.select(".x-grid3-row-selected", this.el).addClass('simulated_hover')
            self.selected = sm.getSelections()
        }
        this.onHoverOut = function(evt, el) {
            Ext.select(".x-grid3-body .simulated_hover", this.el).removeClass('simulated_hover')
            self.selected = []
        }
    }
})


mpd.browser.TabBrowser = Ext.extend(mpd.browser.TabBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.TabBrowser.superclass.constructor.apply(this, arguments);

        var self = this
        appEvents.subscribe('playlistchanged', function(){
            if (self.store.getCount() > 0) {
                if (!self.store.lastOptions) {
                    self.store.load({params: {start: 0, limit: PAGE_LIMIT}})
                } else {
                    self.store.reload()
                }
            }
        })
        this.getTopToolbar().add({
            text: "Home",
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
					mpd.cmd( ['add', encId(obj.file)] )
				}
				return null;
				break;
			default:
				store.baseParams = {cmd: 'find ' + itemType +' "' + dir + '"'};
		}

        var tb = g.getTopToolbar()
        var p = g.findParentByType('panel')
        var t = '/'
        if (dir != this.cwd || isSearch) {
            if (!isSearch) this.cwd = dir
            store.load({params:{start:0, limit:PAGE_LIMIT}})

            // Remove any existing Path buttons
            btn = tb.getComponent(1)
            while (btn) {
                tb.remove(btn)
                btn = tb.getComponent(1)
            }

            // Ensure the Home button is there
            btn = tb.getComponent(0)
            if (!btn) tb.addButton({
                text: 'Home',
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
                        handler: function(){mpd.cmd( ['add', itemType, encId(dir)])}
                    })
                    p.setTitle(t)
                    p.setIconClass('icon-directory')
                }
            }
            tb.doLayout()
        } else {
            g.getView().holdPosition = true
            store.reload()
        }
    }
});
Ext.reg('tab-browser', mpd.browser.TabBrowser)


mpd.browser.TabBrowserPanel = Ext.extend(Ext.TabPanel, {
    constructor: function(config) {
        var self = this
        Ext.apply(this, {
            id: 'dbtabbrowser',
            activeTab: 0,
            bufferResize: true,
            border: false,
            items: [
                {
                    title: 'Home',
                    layout: 'fit',
                    iconCls: 'icon-directory',
                    closable: false,
                    items: {xtype: 'tab-browser'}
                },
                {
                    id: 'new_tab',
                    iconCls: 'icon-newtab',
                    layout: 'fit',
                    closable: false
                }
            ],
            listeners: {
                'beforetabchange': function(pnl, new_tab, old_tab) {
                    if (new_tab.id == 'new_tab') {
                        self.addTab()
                        return false
                    }
                }
            }
        })
        Ext.apply(this, config)
        mpd.browser.TabBrowserPanel.superclass.constructor.apply(this, arguments);
    },
    getActiveBrowser: function () {
        var self = this
        var atab = self.getActiveTab()
        if (!atab) {
            atab = self.get(self.items.getCount()-1)
            self.setActiveTab(atab)
        }
        if (atab) return atab.get(0)
        return null
    },
    addTab: function (dir) {
        var self = this
        var idx = self.items.length - 1
        dir = dir || '/'
        var t = self.insert(idx, {
            title: 'Home',
            layout: 'fit',
            iconCls: 'icon-directory',
            closable: true,
            items: new mpd.browser.TabBrowser()
        })
        self.setActiveTab(t)
        t.get(0).goTo(dir)
        return t
    }
})
Ext.reg('tab-browser-panel', mpd.browser.TabBrowserPanel)


mpd.browser.TabPlaylist = Ext.extend(mpd.browser.TabBase, {
    constructor: function(config) {
        config.tbar = new mpd.browser.PlaylistToolbar()
        config.cmd = 'playlistinfo'
        Ext.apply(this, config)
        mpd.browser.TabPlaylist.superclass.constructor.apply(this, arguments);
        var self = this
        appEvents.subscribe('playlistchanged', function(){
            self.getView().holdPosition = true
            if (!self.store.lastOptions) {
                self.store.load({params: {start: 0, limit: PAGE_LIMIT}})
            } else {
                self.store.reload()
            }
        })
        
    }
})
Ext.reg('tab-playlist', mpd.browser.TabPlaylist)


mpd.browser.TabSearch = Ext.extend(mpd.browser.TabBase, {
    constructor: function(config) {
        Ext.apply(this, config)
        mpd.browser.TabSearch.superclass.constructor.apply(this, arguments);

        var self = this
        appEvents.subscribe('playlistchanged', function(){
            if (self.store.getCount() > 0) {
                self.getView().holdPosition = true
                self.store.reload()
            }
        })
        this.getTopToolbar().add( new Ext.app.SearchField({store: this.store}) )
    }
})
Ext.reg('tab-search', mpd.browser.TabSearch)


mpd.browser.TreeLoader = Ext.extend(Ext.tree.TreeLoader, {
	createNode: function(attr) {
        if (!attr.text) attr.text = attr.title
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
						var cmd = node.attributes.cmd
                        if (!cmd) {
                            var t = node.attributes.type
                            var val = node.attributes[t]
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
                    text: 'Playlists',
                    iconCls: 'icon-playlist',
                    cmd: 'lsinfo'
                }, {
                    nodeType: 'async',
                    id: 'artist:',
                    text: 'Artist/Albums',
                    iconCls: 'icon-artist',
                    cmd: 'list artist'
                }, {
                    nodeType: 'async',
                    id: 'directory:',
                    text: 'Folders',
                    iconCls: 'icon-directory',
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
                }
            }
        })
        Ext.apply(this, config)
        mpd.browser.TreePanel.superclass.constructor.apply(this, arguments);
    }
});
Ext.reg('mpdtree', mpd.browser.TreePanel)
