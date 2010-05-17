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

    onTrigger1Click : function(){
        if(this.hasSearch){
            this.el.dom.value = '';
            var b = Ext.getCmp('dbtabbrowser').getActiveBrowser()
            var cwd = b.cwd
            b.cwd = "<<<Force Refresh>>>"
            b.goTo(cwd)
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
        var b = Ext.getCmp('dbtabbrowser').getActiveBrowser()
        b.goTo({'type': 'search', 'search': v})
        this.hasSearch = true;
        this.triggers[0].show();
    }
});

Ext.app.FilterField = Ext.extend(Ext.form.TwinTriggerField, {
    initComponent : function(){
        Ext.app.SearchField.superclass.initComponent.call(this);
        var dt = new Ext.util.DelayedTask(this.onTrigger2Click, this)
        this.on('render', function(){
            var el = this.el.dom
            this.el.on('keydown', function(){
                var ln = el.value.length
                var tm = (5-ln) * 100
                if (tm > 0) dt.delay(tm)
                else dt.delay(0)
            });
        }, this)
    },

    validationEvent:false,
    validateOnBlur:false,
    trigger1Class:'x-form-clear-trigger',
    trigger2Class:'x-form-search-trigger',
    hideTrigger1:true,
    filterField: 'any',
    hasSearch : false,

    onTrigger1Click : function(){
        if(this.hasSearch){
            this.el.dom.value = '';
            this.store.clearFilter()
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
        var asSearch = v.split(' ')
        var re = new RegExp('^(?=.*?'+asSearch.join( ')(?=.*?' )+').*$', "i");
        this.store.filter(this.filterField, re)
        this.hasSearch = true;
        this.triggers[0].show();
    }
});
