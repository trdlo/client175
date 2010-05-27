Ext.namespace('mpd')

function smartToggle(animate){
	if (this.collapsed) {
		this.expand(animate);
	} else {
		var sib = this.nextSibling()
		if (!sib && this.ownerCt.items.getCount() > 1) sib = this.ownerCt.get(0)
		if (sib) {
			this.collapse(animate)
			sib.expand.call(sib, arguments);
		}
	}
	return this;
}


mpd.init = function(){
	Ext.QuickTips.init();
    var vp = new Ext.Viewport({
        layout: 'border',
        items: [
            {
                xtype: 'mpd-controls',
                region: 'north'
            },
			{
				xtype: 'mpdtree',
				iconCls: 'icon-group-unknown',
				region: 'west',
				id: 'mpd-nav',
				split: true,
				collapsible: true,
				minWidth: 200,
				width: 300
            },
			{
				region: 'east',
				xtype: 'panel',
				layout: 'accordion',
				id: 'mpd-sidebar',
				split: true,
				minWidth: 200,
				width: 300,
				layoutConfig: {
					fill: true,
					hideCollapseTool: true,
					activeOnTop: true
				},
				defaults: {
					toggleCollapse : smartToggle
				},
				items: [
					{
						xtype: 'playlist_sidebar',
						//playlistStyle: 'titles',
						//playlistStyle: '3line',
						//playlistStyle: 'albums',
						playlistStyle: 'albumcovers',
						iconCls: 'icon-playlist',
					},
					{xtype: 'info-panel'},
					{xtype: 'tag-editor'}
				]
			},
            {
                layout: 'fit',
                region: 'center',
                split: true,
                items: {
                    xtype: 'browser-tab-panel'
                }
            }
        ],
        listeners: {
			render: function (self) {
				self.el.on('contextmenu', function (event) {event.stopEvent()})
			}
		}
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
document.title = 'ExtMPD: ' + location.hostname

