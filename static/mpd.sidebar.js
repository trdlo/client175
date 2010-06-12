Ext.namespace('mpd.sidebar')

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



mpd.sidebar.InfoPanel = Ext.extend(Ext.Panel, {
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
					'<img onclick="mpd.util.showImage(this)" style="max-width:95%;max-height:256px;margin-top:5px" src="{cover_url}"><br>',
					'<b>{album}</b><br>',
					'by <i>{artist}</i>',
				'</div><br>',
				'<p id="lyricsTitle" style="font-size:1.5em;font-weight:bold">{title}</p>',
				'<div style="padding:10px">',
					'<div id="lyricsBox" Searching for Lyrics...</div><br>',
					'<a href="#" onclick="mpd.util.editLyrics(this)">Edit Lyrics</a>',
				'</div>',
			'</center>'
			),
            listeners: {
                activate: function() {
                    if (this.delayedRecord) this.loadRecord(this.delayedRecord)
                }
            }
		})
        this.delayedRecord = null
        Ext.apply(this, config)
        mpd.sidebar.InfoPanel.superclass.constructor.apply(this, arguments);
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
        if (this.ownerCt.layout.activeItem != this) {
            this.delayedRecord = rec
        } else {
            this.delayedRecord = null
            var d = rec.data, old = this.record.data
            if (d.type != 'file') return null
            d.artist = d.albumartist || d.artist
            var old_artist = old.albumartist || old.artist
            if ((d.artist != old_artist) || (d.album != old.album)) {
                d.cover_url = '../covers?' + Ext.urlEncode({
                    artist: d.artist,
                    album: d.album
                })
                this.update(d)
                this.doLayout()
            }
            this.record = rec
            this.loadLyrics()
        }
	},
	reload: function() {
		this.loadRecord(this.record)
	}	
})
Ext.reg('info-panel', mpd.sidebar.InfoPanel)


mpd.sidebar.Playlist = Ext.extend(Ext.Panel, {
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
        
        mpd.events.on('playlist', this.store.load, this.store)
        this.store.on('beforedestroy', function(){
            mpd.events.un('playlist', this.store.load, this.store)
        }, this)

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
                }, '-',
                {
                    text: 'Show in Tab',
                    id: 'plyalist-display-tab',
                    handler: function(menuItem, event){
                        var tb = Ext.getCmp('dbtabbrowser')
                        if (tb) {
                            tb.addPlaylistTab()
                            var n = self.nextSibling()
                            self.ownerCt.remove(self, true)
                            if (n) n.expand.call(n)
                            Ext.state.Manager.set('playlistLocation', 'tab')
                        }
                    }
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
            tbar: mpd.util.createPlaylistToolbar(),
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
                'beforedestroy': function () {
                    menu.destroy()
                },
                'beforeexpand': function () {
                    Ext.getCmp('dbtabbrowser').hideTabStripItem('playlistTab')
                    var a = Ext.getCmp('dbtabbrowser').getActiveBrowser()
                }
            }
        });
        Ext.apply(this, config)
        mpd.sidebar.Playlist.superclass.constructor.apply(this, arguments);

    },
    setList: function (pstyle) {
        var self = this
        baseParams = {}
        custom_tpl = false
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
                        header: 'Song',
                        dataIndex: 'title',
                        tpl:
                        '<tpl if="title">' +
							'<dt style="width:10%"><em unselectable="on">'+
                                '<div id="{id}" class="remove {cls}">{pos}.</div>' +
                            '</em></dt>'+
							'<dt style="width:90%"><em unselectable="on">'+
                                '<div>{title}</div>'+
                            '</em></dt>' +
						'</tpl>' +
                        '<tpl if="!title">' +
							'<dt style="width:100%"><em unselectable="on">'+
							'<div class="x-toolbar {cls}" style="height:30px;padding-left:4px">' +
                                '<b style="white-space:nowrap !important;">{album}</b><tpl if="!album &amp;&amp; !artist">&nbsp;</tpl>' +
                                '<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br></tpl>' +
                                '<i>{artist}</i>' +
                            '</div>'+
                            '</em></dt>' +
                        '</tpl>'
                    }
                ]
                custom_tpl = new Ext.XTemplate(
                    '<tpl for="rows">',
                        '<dl>',
                            '<tpl for="parent.columns">',
                                '{[values.tpl.apply(parent)]}',
                            '</tpl>',
                            '<div class="x-clear"></div>',
                        '</dl>',
                    '</tpl>'
                );
                baseParams.albumheaders = true;
                break;
            case 'albumcovers':
                cols = [
                    {
                        header: 'Song',
                        dataIndex: 'title',
                        tpl:
                        '<tpl if="title">' +
							'<dt style="width:10%"><em unselectable="on">'+
                                '<div id="{id}" class="remove {cls}">{pos}.</div>' +
                            '</em></dt>'+
							'<dt style="width:90%"><em unselectable="on">'+
                                '<div>{title}</div>'+
                            '</em></dt>' +
						'</tpl>' +
                        '<tpl if="!title">' +
							'<dt style="width:100%"><em unselectable="on">'+
							'<div class="x-toolbar {cls}" style="height:68px;">' +
								'<img src="../covers?{[Ext.urlEncode({artist:values.artist,album:values.album})]}">' +
								'<b>{album}</b><tpl if="!album &amp;&amp; !artist">&nbsp;</tpl>' +
								'<tpl if="album &gt; &quot;&quot; &amp;&amp; artist &gt; &quot;&quot;"><br></tpl>' +
								'<i>{artist}</i>' +
							'</div>' +
                            '</em></dt>' +
                        '</tpl>'
                    }
                ]
                custom_tpl = new Ext.XTemplate(
                    '<tpl for="rows">',
                        '<dl>',
                            '<tpl for="parent.columns">',
                                '{[values.tpl.apply(parent)]}',
                            '</tpl>',
                            '<div class="x-clear"></div>',
                        '</dl>',
                    '</tpl>'
                );
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
            columnSort: false,
            cls: pstyle,
            columns: cols,
            enableDragDrop: true,
            tpl: custom_tpl
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
                    mpd.util.showImage(t)
                }
            }
        })

        new_list.on('dblclick', function(lstView, rowIdx, node, evt) {
            var rec = self.store.getAt(rowIdx).data
            mpd.cmd(['playid', rec.id])
        })

        new_list.on('contextmenu', function(lstView, rowIdx, node, evt) {
            if (!lstView.isSelected(node)) lstView.select(node)
            var recs = lstView.getSelectedRecords()
            var data = Ext.pluck(recs, 'data')
            mpd.util.context.show(data, evt)
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
Ext.reg('playlist_sidebar', mpd.sidebar.Playlist)


mpd.sidebar.TagEditor = Ext.extend(Ext.grid.PropertyGrid, {
    constructor: function(config) {
		this.records = []
        Ext.apply(this, {
			id: 'tageditor',
			title: 'Edit Tags',
			iconCls: "icon-edit-tags",
			listeners: {
				'beforepropertychange': function(src, key, val, old) {
					if (key.charAt(0) == "(") return false
					Ext.each(this.records, function(rec) {
                        if (rec.data[key] != val) rec.set(key, val)
                    })
				},
				'activate': function () {
					if (this.delayedRecords) this.loadRecords(this.delayedRecords)
				}
			}
		})
        Ext.apply(this, config)
        mpd.sidebar.TagEditor.superclass.constructor.apply(this, arguments);
    },
    loadRecords: function(records) {
        if (this.ownerCt.layout.activeItem != this) {
            this.delayedRecords = records
            return null
        }
        this.delayedRecords = null
		// Filter recods for files only
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
				key = key.toLowerCase()
                
                /** 
                 * Collect unique values for this field from the given records.
                 * If there are multiple values, a custom combobox will be created.
                 * If they all have the same value, the default textbox will be used.
                 **/
				var vals = []
				for (var i=0; i<len; i++) {
					vals.push(recs[i].data[key])
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
			src['(file)'] = data.file
			Ext.each(mpd.TAG_TYPES, function (key) {
				key = key.toLowerCase()
				src[key] = data[key]
			})
		}
		this.setSource(src)
	}      
})
Ext.reg('tag-editor', mpd.sidebar.TagEditor)
