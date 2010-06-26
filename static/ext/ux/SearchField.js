/*
 * Ext JS Library 2.2.1
 * Copyright(c) 2006-2009, Ext JS, LLC.
 * licensing@extjs.com
 * 
 * http://extjs.com/license
 */

Ext.app.SearchField = Ext.extend(Ext.form.TwinTriggerField, {
    initComponent : function(){
        Ext.app.SearchField.superclass.initComponent.call(this);
        var dt = new Ext.util.DelayedTask(this.onTrigger2Click, this)
        this.on('render', function(){
            var el = this.el.dom
            this.el.on('keyup', function(e){
                if (e.getKey() == 13) { // Enter key
                    dt.delay(0)
                    return true
                }
                var v = el.value
                var ln = v.length
                /**
                 * This component will run an mpd protocol command if
                 * the search value is preceded by 'mpc '.  This logic
                 * checks to see if a command is being typed.  If not,
                 * then run a search based on whatever is already been 
                 * typed after a short delay.
                 **/
                if (ln > 4) {
                    if (v.slice(0,4) != 'mpd ') dt.delay(200);
                } else {
                    if (v != 'mpd '.slice(0, ln)) {
                        switch (v.length) {
                            case 0: dt.delay(0); break;
                            case 1: dt.delay(1000); break;
                            case 2: dt.delay(800); break;
                            case 3: dt.delay(400); break;
                            case 4: dt.delay(300); break;
                            default: dt.delay(200); break;
                        }
                    }
                }
            });
            this.onLoad = function() {
                var l = this.store.lastOptions
                if (!l || !l.params || !l.params.filter) el.value = ''
            }
            this.store.on('load', this.onLoad, this)
            this.on('beforedestroy', function() {
                this.store.un('load', this.onLoad, this)
            }, this)
        }, this)
    },

    validationEvent:false,
    validateOnBlur:false,
    trigger1Class:'x-form-clear-trigger',
    trigger2Class:'x-form-search-trigger',
    hideTrigger1:true,
    filter: false,
    filterField: 'any',
    hasSearch : false,
    paramName : 'query',
    
    clearSearch: function(store){
        var b = Ext.getCmp('dbtabbrowser').getActiveBrowser()
        var cwd = b.cwd
        b.cwd = "<<<Force Refresh>>>"
        b.goTo(cwd)
    },
    doSearch: function(store, val){
        var b = Ext.getCmp('dbtabbrowser').getActiveBrowser()
        b.goTo({'type': 'search', 'search': val})
    },
    onCmdCallback: function(result, cmd, raw) {
        if (raw != 'null') {
            var w = new Ext.Window({
                title: cmd,
                height: 250,
                width: 400,
                layout: 'fit',
                items: new Ext.form.TextArea({
                    value: raw,
                    style: {'background': 'none'}
                })
            }).show()
        }
    },
    onTrigger1Click : function(){
        this.setRawValue('');
        this.clearSearch(this.store);
        this.triggers[0].hide();
    },
    onTrigger2Click : function(){
        var v = this.getRawValue()
        if(v.length < 1){
            this.onTrigger1Click();
            return;
        }
        if (v.length > 4 && v.slice(0, 4) == 'mpd ') {
            mpd.cmd(v.slice(4), this.onCmdCallback)
            this.onTrigger1Click();
            return;
        } else {
            this.doSearch(this.store, v.toLowerCase());
            this.triggers[0].show();
        }
    }
});

Ext.app.FilterField = Ext.extend(Ext.app.SearchField, {
    clearSearch: function(store){
		store.load({
            params: {
                start: 0, 
                limit: mpd.PAGE_LIMIT
            }
        })
	},
    doSearch: function(store, val){
		store.load({
            params: {
                filter: val,
                start: 0, 
                limit: mpd.PAGE_LIMIT
            }
        })
	}    
});
