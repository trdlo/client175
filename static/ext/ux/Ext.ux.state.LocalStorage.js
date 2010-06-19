Ext.ns('Ext.ux.state')

Ext.ux.state.LocalStorage = function(config){
    Ext.ux.state.LocalStorage.superclass.constructor.call(this);
    Ext.apply(this, config);
    this.state = localStorage;
};

Ext.extend(Ext.ux.state.LocalStorage, Ext.state.Provider, {
    get : function(name, defaultValue){
        if (typeof this.state[name] == "undefined") {
            return defaultValue
        } else {
            return this.decodeValue(this.state[name])
        }
    },
    set : function(name, value){
        if(typeof value == "undefined" || value === null){
            this.clear(name);
            return;
        }
        this.state[name] = this.encodeValue(value)
        this.fireEvent("statechange", this, name, value);
    }
});

if (window.localStorage) {
    Ext.state.Manager.setProvider(new Ext.ux.state.LocalStorage())
} else {
    var thirtyDays = new Date(new Date().getTime()+(1000*60*60*24*30))
    Ext.state.Manager.setProvider(new Ext.state.CookieProvider({expires: thirtyDays}))
}
