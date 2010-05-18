Ext.namespace('mpd.context')

mpd.context.items = {
    'add': {
        text: 'Add to Playlist',
        id: 'mpd-context-add',
        iconCls: 'icon-add',
        handler: function(self, event) {
            var cb = self.ownerCt.callBack
            var data = self.ownerCt.itemData
            Ext.each(data, function(d){
                mpd.cmd(['add', d.type, d[d.type]])
            })
            if (Ext.isFunction(cb)) cb(self, event)
        }
    },
    'replace': {
        text: 'Replace Playlist',
        id: 'mpd-context-replace',
        iconCls: 'icon-replace',
        handler: function(self, event) {
            var cb = self.ownerCt.callBack
            var data = self.ownerCt.itemData
            if (data.length == 1 && data[0].type == 'playlist') {
                mpd.cmd(['load', data[0].playlist, true])
            } else {
                mpd.cmd(['clear'])
                Ext.each(data, function(d){
                    mpd.cmd(['add', d.type, d[d.type]])
                })
            }
            if (Ext.isFunction(cb)) cb(self, event)
        }
    },
    'rename': {
        text: 'Rename Playlist',
        id: 'mpd-context-rename',
        iconCls: 'icon-edit',
        handler: function(self, event) {
            var cb = self.ownerCt.callBack
            var d = self.ownerCt.itemData[0]
            var t = "Rename Playlist"
            var msg = "Enter a new name for this playlist:"
            var fn = function(btn, text) {
                if (btn == 'ok' && text) {
                    mpd.cmd(['rename', d.playlist, text])
                }
                if (Ext.isFunction(cb)) cb(self, event)
            }
            Ext.Msg.prompt(t, msg, fn, this, false, d.title)
        }
    },
    'rm': {
        text: 'Delete Playlist',
        id: 'mpd-context-rm',
        iconCls: 'icon-cancel',
        handler: function(self, event) {
            var cb = self.ownerCt.callBack
            var data = self.ownerCt.itemData
            Ext.each(data, function(d){
                mpd.cmd(['rm', d.playlist])
            })
            if (Ext.isFunction(cb)) cb(self, event)
        }
    },
    'update': {
        text: 'Update',
        id: 'mpd-context-update',
        iconCls: 'icon-refresh',
        handler: function(self, event) {
            var cb = self.ownerCt.callBack
            var data = self.ownerCt.itemData
            Ext.each(data, function(d){
                mpd.cmd(['update', d[d.type]])
            })
            if (Ext.isFunction(cb)) cb(self, event)
        }
    }
}

mpd.context.Show = function(itemData, event, callBack) {
    var a = mpd.context.items
    var items = [a['add'], a['replace']]
    switch (itemData[0].type) {
        case 'playlist':
            items.push(a['rename']);
            items.push(a['rm']);
            break;
        case 'directory':
            items.push(a['update']);
            break;
        case 'file':
            items.push(a['update']);
            break;
    }
    var m = new Ext.menu.Menu({
        items: items,
        itemData: itemData,
        callBack: callBack
    })
    m.showAt(event.getXY())
    return m
}
