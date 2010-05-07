Ext.namespace('mpd')

mpd.init = function(){
    var vp = new Ext.Viewport({
        layout: 'border',
        items: [
            {
                xtype: 'mpd-controls',
                region: 'north'
            },
            {
                xtype: 'mpdtree',
                iconCls: 'icon-directory',
                region: 'west',
                collapsible: true,
                floatable: false,
                split: true,
                width: 200
            },
            {
                xtype: 'playlist_sidebar',
                //playlistStyle: 'titles',
                //playlistStyle: '3line',
                playlistStyle: 'albums',
                //playlistStyle: 'albumcovers',
                iconCls: 'icon-playlist',
                region: 'east',
                floatable: false,
                collapsible: true,
                split: true,
                width: 200
            },
            {
                layout: 'fit',
                region: 'center',
                split: true,
                items: {
                    xtype: 'browser-tab-panel'
                }
            }
        ]
    })
    mpd.checkStatus.delay(100)
}

Ext.onReady(function(){
    Ext.Ajax.request({
        url: '../tagtypes',
        success: function(response, opts) {
			mpd.TAG_TYPES = Ext.util.JSON.decode(response.responseText)
			// I don't know what the 'Name' tag refers to, but it doesn't
			// correspond to an editable ID3 tag.
			mpd.TAG_TYPES.remove("Name")			
			var fields = Ext.pluck(mpd.dbFields(), "name")
			Ext.each(mpd.TAG_TYPES, function(item) {
				var tag = item.toLowerCase()
				if (fields.indexOf(tag) == -1) {
					mpd.EXTRA_FIELDS.push({'name': tag, 'header': item})
				}
			})
			mpd.init()
        },
        failure: function(response, opts) {
			Ext.Msg.alert("Error", "Unable to retrieve list of available tag types.")
			mpd.init()
		}
    })	
});

