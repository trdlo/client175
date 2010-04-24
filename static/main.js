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
                collapsible: true,
                split: true,
                width: 200
            },
            {
                layout: 'fit',
                region: 'center',
                split: true,
                items: {
                    xtype: 'tab-browser-panel'
                }
            }
        ]
    })
    t = Ext.getCmp('dbtabbrowser')
    t.getActiveBrowser().goTo("/")
    mpd.checkStatus.delay(0)
}

Ext.onReady(mpd.init);

