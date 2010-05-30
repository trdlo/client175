Ext.namespace('mpd.util.context')

function titleCase(s) {
    if (!Ext.isString(s)) return s
    if (s.length == 0) return ''
    if (s.length == 1) return s.toUpperCase()
    return s.substr(0,1).toUpperCase() + s.substr(1)
}


mpd.util.context.items = {
    'add': {
        text: 'Add to Playlist',
        id: 'mpd-context-add',
        iconCls: 'icon-add',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            Ext.each(data, function(d){
                mpd.cmd(['add', d.type, d[d.type]])
            })
            mpd.util.context.lastCommand = self.id
        }
    },
    'replace': {
        text: 'Replace Playlist',
        id: 'mpd-context-replace',
        iconCls: 'icon-replace',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            if (data.length == 1 && data[0].type == 'playlist') {
                mpd.cmd(['load', data[0].playlist, true])
            } else {
                mpd.cmd(['clear'])
                Ext.each(data, function(d){
                    mpd.cmd(['add', d.type, d[d.type]])
                })
            }
            mpd.util.context.lastCommand = self.id
        }
    },
    'rename': {
        text: 'Rename Playlist',
        id: 'mpd-context-rename',
        iconCls: 'icon-edit',
        handler: function(self, event) {
            var d = mpd.util.context.itemData[0]
            var t = "Rename Playlist"
            var msg = "Enter a new name for this playlist:"
            var fn = function(btn, text) {
                if (btn == 'ok' && text) {
                    mpd.cmd(['rename', d.playlist, text])
                }
            }
            Ext.Msg.prompt(t, msg, fn, this, false, d.title)
            mpd.util.context.lastCommand = self.id
        }
    },
    'rm': {
        text: 'Delete Playlist',
        id: 'mpd-context-rm',
        iconCls: 'icon-cancel',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            Ext.each(data, function(d){
                mpd.cmd(['rm', d.playlist])
            })
            mpd.util.context.lastCommand = self.id
        }
    },
    'update': {
        text: 'Update',
        id: 'mpd-context-update',
        iconCls: 'icon-refresh',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            Ext.each(data, function(d){
                mpd.cmd(['update', d[d.type]])
            })
            mpd.util.context.lastCommand = self.id
        }
    },
    'play': {
        text: 'Play',
        id: 'mpd-context-play',
        iconCls: 'icon-play-small',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            mpd.cmd(['playid', data[0].id])
            mpd.util.context.lastCommand = self.id
        }
    },
    'remove': {
        text: 'Remove from Playlist',
        id: 'mpd-context-remove',
        iconCls: 'icon-cancel',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            Ext.each(data, function(d){
                mpd.cmd(['deleteid', d.id])
            })
            mpd.util.context.lastCommand = self.id
        }
    },
    'move_start': {
        text: 'Move to start',
        id: 'mpd-context-move-start',
        iconCls: 'icon-top',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            var ids = Ext.pluck(data, 'id')
            mpd.cmd(['movestart', ids.join(".")])
            mpd.util.context.lastCommand = self.id
        }
    },
    'move_end': {
        text: 'Move to End',
        id: 'mpd-context-move-end',
        iconCls: 'icon-bottom',
        handler: function(self, event) {
            var data = mpd.util.context.itemData
            var ids = Ext.pluck(data, 'id')
            mpd.cmd(['moveend', ids.join(".")])
            mpd.util.context.lastCommand = self.id
        }
    },
    'new_tab': {
        text: 'Open in New Tab',
        id: 'mpd-context-new-tab',
        iconCls: 'icon-newtab',
        handler: function(self, event) {
            var dir = mpd.util.context.itemData[0]
            var tb = Ext.getCmp('dbtabbrowser')
            if (tb) tb.addTab(dir)
        }
    }
}

mpd.util.context.menu = new Ext.menu.Menu()
mpd.util.context.add = mpd.util.context.menu.addMenuItem.createDelegate(mpd.util.context.menu)

mpd.util.context.show = function(itemData, event) {
    if (itemData.length < 1) return null
    var muc = mpd.util.context
    var add = muc.add
    var c = muc.items
    muc.menu.removeAll()
    if (itemData[0].pos) {
        add(c.play)
        add(c.remove)
        add(c.move_start)
        add(c.move_end)
    } else {
        add(c.add)
        add(c.replace)
        switch (itemData[0].type) {
            case 'playlist':
                add(c.rename);
                add(c.rm);
                muc.menu.addSeparator();
                add(c.new_tab);
                break;
            case 'directory':
                add(c.update);
                muc.menu.addSeparator();
                add(c.new_tab);
                break;
            case 'file':
                add(c.update);
                break;
            default:
                muc.menu.addSeparator();
                add(c.new_tab);
                break;
        }
    }
    muc.itemData = itemData
    muc.lastCommand = null
    muc.menu.showAt(event.getXY())
}


mpd.util.createPlaylistToolbar = function () {
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
						mpd.events.on('playlistname', self.setText, self)
					},
					beforedestroy: function (self) {
						mpd.events.un('playlistname', self.setText, self)
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
					mpd.util.playlistDialog.showOpen(btn.el)
				}
			},
			{
				xtype: 'button',
				iconCls: "icon-save",
				tooltip: 'Save Playlist',
				handler: function (btn) {
					mpd.util.playlistDialog.showSave(btn.el)
				}
			}
		]
	})
}


mpd.util.editLyrics = function(el) {
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


mpd.util.playlistDialog = new Ext.Window({
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
					'render': function(self) {
						var s = self.getStore()
						mpd.events.on('playlists', s.load, s)
					},
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
						var r = lst.getStore().getAt(idx)
						mpd.util.context.show([r.data], event)
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
				t.focus(true, 300)
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


mpd.util.showImage = function(el) {
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
