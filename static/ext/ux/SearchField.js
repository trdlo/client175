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
            this.el.on('keyup', function(){
                switch (el.value.length) {
                    case 0: dt.delay(0); break;
                    case 1: dt.delay(1000); break;
                    case 2: dt.delay(800); break;
                    case 3: dt.delay(400); break;
                    case 4: dt.delay(300); break;
                    default: dt.delay(200); break;
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
    onTrigger1Click : function(){
        this.setRawValue('');
        this.clearSearch(this.store);
        this.triggers[0].hide();
    },
    onTrigger2Click : function(){
        var v = this.getRawValue().toLowerCase();
        if(v.length < 1){
            this.onTrigger1Click();
            return;
        }
        this.doSearch(this.store, v);
        this.triggers[0].show();
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
