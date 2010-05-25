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
            this.store.on('load', function() {
                if (!this.store.baseParams.filter) {
                    this.el.dom.value = ''
                }
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
        if(this.hasSearch){
            this.el.dom.value = '';
            this.clearSearch(this.store);
            this.triggers[0].hide();
            this.hasSearch = false;
        }
    },
    onTrigger2Click : function(){
        var v = this.getRawValue().toLowerCase();
        if(v.length < 1){
            this.onTrigger1Click();
            return;
        }
        this.doSearch(this.store, v);
        this.hasSearch = true;
        this.triggers[0].show();
    }
});

Ext.app.FilterField = Ext.extend(Ext.app.SearchField, {
    loadOptions: null,
    clearSearch: function(store){
		store.baseParams.filter = ''
		store.load(this.loadOptions)
	},
    doSearch: function(store, val){
		store.baseParams.filter = val
		store.load(this.loadOptions)
	}    
});
