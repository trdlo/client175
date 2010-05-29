Ext.namespace('mpd')

mpd.Controls = Ext.extend(Ext.Container, {
    constructor: function(config) {
        var self = this

        var sliderTime = new Ext.Slider({
            id: 'sliderTime',
            x: 275,
            y: 33,
            anchor: '99%',
            hidden: true,
            hideMode: 'offsets',
            minValue: 0,
            maxValue: 100,
            decimalPrecision: 2,
            listeners: {
                dragend: function(slider, e) {
                    val = Math.floor( ( slider.getValue()/100 ) * mpd.status.time )
                    if (val != mpd.status.elapsed) mpd.seek(val)
                    mpd.events.resume('elapsed')
                },
                dragstart: function(slider, e) {
                    mpd.events.suspend('elapsed')
                }
            }
        })

        var pbarTime = new Ext.ProgressBar({
            id: 'pbarTime',
            x: 275,
            y: 34,
            anchor: '99%',
            height: 18,
            hideMode: 'offsets',
            text: '0:00 / 0:00'                         
        })

        var btnRepeat = new Ext.Button({
            iconCls: 'icon-repeat',
            text: 'Repeat',
            x: 190,
            y: 4,
            enableToggle: true,
            toggleHandler: function(btn, state) {
                var val = (state) ? '1' : '0'
                if (val != mpd.status.repeat) mpd.cmd(['repeat', val])
            }
        })
        
        var btnRandom = new Ext.Button({
            iconCls: 'icon-random',
            text: 'Random',
            x: 190,
            y: 30,
            enableToggle: true,
            toggleHandler: function(btn, state) {
                var val = (state) ? '1' : '0'
                if (val != mpd.status.random) mpd.cmd(['random', val])
            }
        })

        var endBox = new Ext.Container({
            layout: 'absolute',
            width: 160,
            height: 62,
            items: [
				new Ext.Button({
                    width: 140,
                    x: 10,
                    y: 4,
					text: 'Theme Chooser',
					cls: 'x-toolbar-standardbutton',
					//handler: optionsHandler, // handle a click on the button itself
					menu: new Ext.menu.Menu({
						items: [
							{text: 'Ambience', handler: setActiveStyleSheet.createCallback('ambience')},
							{text: 'Blue', handler: setActiveStyleSheet.createCallback('blue')},
							{text: 'Dark (dcs)', handler: setActiveStyleSheet.createCallback('dcs')},
							{text: 'Gray', handler: setActiveStyleSheet.createCallback('gray')},
							{text: 'Gray Extend', handler: setActiveStyleSheet.createCallback('grayx')},
							{text: 'Human', handler: setActiveStyleSheet.createCallback('human')},
							{text: 'Slate', handler: setActiveStyleSheet.createCallback('slate')},
							{text: 'TargetProcess', handler: setActiveStyleSheet.createCallback('tp')}
						]
					})
				}),
                new Ext.app.SearchField({
                    width: 140,
                    x: 10,
                    y: 32,
                    emptyText: 'Type here to search...',
                    store: new Ext.data.JsonStore({
                        url: '/query',
                        baseParams: {
                            q: "home"
                        },
                        fields: mpd.dbFields()
                    })
                })
            ]
        })
        
        var statusControls = new Ext.Container({
            layout: 'absolute',
            align: 'middle',
            height: 62,
            flex: 10,
            items: [
                new Ext.Slider({
                    id: 'sldrVolume',
                    height: 50,
                    x: 6,
                    y: 4,
                    vertical: true,
                    minValue: 0,
                    maxValue: 100,
                    listeners: {
                        change: function(slider, val) {
                            if (val == mpd.status.volume) return true
                            mpd.setvol(val)
                        }
                    }
                }),
                {
                    xtype: 'button',
                    iconCls: 'icon-previous',
                    tooltip: 'Previous',
                    x: 33,
                    y: 14,
                    width: 48,
                    height: 26,
                    handler: function() {mpd.cmd(['previous'])}
                },
                new Ext.Container({
                    layout: 'vbox',
                    id: 'btnStopPause',
                    x: 83,
                    y: 6,
                    align: 'middle',
                    pack: 'center',
                    hidden: true,
                    height: 58,
                    width: 48,
                    items: [
                        {
                            xtype: 'button',
                            id: 'btnPause',
                            iconCls: 'icon-pause',
                            width: 48,
                            tooltip: 'Pause',
                            enableToggle: true,
                            handler: function() {
                                if (mpd.status.state == 'play') mpd.cmd(['pause'])
                                else mpd.cmd(['play'])
                            }
                        },
                        {
                            xtype: 'button',
                            id: 'btnStop',
                            iconCls: 'icon-stop',
                            width: 48,
                            tooltip: 'Stop',
                            handler: function() {mpd.cmd(['stop'])}
                        }
                    ]
                }),
                {
                    xtype: 'button',
                    id: 'btnPlay',
                    iconCls: 'icon-play',
                    width: 48,
                    x: 83,
                    y: 4,
                    height: 48,
                    tooltip: 'Play',
                    handler: function() {mpd.cmd(['play'])}
                },
                {
                    xtype: 'button',
                    iconCls: 'icon-next',
                    width: 48,
                    height: 26,
                    x: 134,
                    y: 14,
                    tooltip: 'Next',
                    handler: function() {mpd.cmd(['next'])}
                },
                btnRepeat,
                btnRandom,
                {
                    xtype: 'label',
                    height: 26,
                    x: 275,
                    y: 2,
                    anchor: '100%',
                    id: 'txtCurrentSong',
                    html: '<div style="font-size:11px;cursor:pointer">' +
                        '<b id="txtTitle" style="font-size:14px">Title</b><br>' +
                        ' by <i id="txtArtist">Artist</i>' +
                        ' from <span id="txtAlbum">Album</span>' +
                        '</div>',
                    listeners: {
						'afterrender': function (me) {
							me.getEl().on('click', function () {
								var ip = Ext.getCmp('infopanel')
								if (ip) {
									var d = {
										type: 'file',
										artist: mpd.status.artist,
										album: mpd.status.album,
										title: mpd.status.title
									}
									ip.loadRecord({data: d})
									ip.ownerCt.layout.setActiveItem('infopanel')
								}
							})
						}
					}
                },
                pbarTime,                    
                sliderTime
            ]
        })

        Ext.apply(this, {
            id: 'mpd-controls',
            region: 'north',
            height: 62,
            cls: 'x-toolbar',
            layout: 'hbox',
            layoutConfig: {
				align: 'middle'
			},
            items: [
                statusControls,
                endBox,
                new Ext.Button({
					iconCls: 'icon-about',
					tooltip: 'About ExtMPD',
					handler: function() {
						window.open('/about')
					}
				})
            ]
        })

        
        pbarTime.on("afterrender", function(){
            pbarTime.el.hover(function(){
                pbarTime.hide()
                sliderTime.show()
                self.doLayout()
            })
        })
        
        sliderTime.on("afterrender", function(){
            sliderTime.el.hover(Ext.emptyFn, function(){
                if (sliderTime.dragging) return false
                pbarTime.show()
                sliderTime.hide()
                self.doLayout()
            })
        })
        
        mpd.events.on('elapsed', function(){
            var percent = (mpd.status.elapsed / mpd.status.time)
            var hmsE = hmsFromSec(mpd.status.elapsed)
            var hmsT = hmsFromSec(mpd.status.time)
            pbarTime.updateProgress(percent, hmsE + " / " + hmsT)
            if (!sliderTime.dragging) sliderTime.setValue(percent * 100)
        })
        
        mpd.events.on('state', function(){
            if (mpd.status.state == 'stop') {
                Ext.getCmp('btnStopPause').hide()
                Ext.getCmp('btnPlay').show()
            } else {
                Ext.getCmp('btnPlay').hide()
                Ext.getCmp('btnStopPause').show()
            }
            Ext.getCmp('btnPause').toggle((mpd.status.state == 'pause'))
            statusControls.doLayout(false, true)
        })
        
        mpd.events.on('title', function(){
            Ext.getDom('txtTitle').innerHTML = mpd.status.title
        })
        
        mpd.events.on('artist', function(){
            Ext.getDom('txtArtist').innerHTML = mpd.status.artist
        })
        
        mpd.events.on('album', function(){
            Ext.getDom('txtAlbum').innerHTML = mpd.status.album
        })

        mpd.events.on('random', function () {
            var val = (mpd.status.random == '1')
            btnRandom.toggle(val)
        })

        mpd.events.on('repeat', function () {
            var val = (mpd.status.repeat == '1')
            btnRepeat.toggle(val)
        })
        
        mpd.events.on('volume', function(){
            Ext.getCmp('sldrVolume').setValue(mpd.status.volume)
        })
        
        Ext.apply(this, config)
        
        mpd.Controls.superclass.constructor.apply(this, arguments);
    }
})
Ext.reg('mpd-controls', mpd.Controls)
