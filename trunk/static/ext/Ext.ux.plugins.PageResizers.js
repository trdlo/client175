Ext.namespace('Ext.ux.plugins');

Ext.ux.plugins.PageSliderResizer = Ext.extend(Object, {

  pageSizes: [5, 10, 15, 20, 25, 30, 50, 75, 100, 200, 300, 500],
  tipText: 'Showing <b>{0}</b> records per page.',

  constructor: function(config){
    Ext.apply(this, config);
    Ext.ux.plugins.PageSliderResizer.superclass.constructor.call(this, config);
  },

  init : function(pagingToolbar){

	var ps = this.pageSizes;
    var sv = 0;
    Ext.each(this.pageSizes, function(ps, i) {
      if (ps==pagingToolbar.pageSize) {
        sv = i;
        return;
      }
    });

    var tt = this.tipText;
    var slider = new Ext.Slider({
      width: 115,
      value: sv,
      minValue: 0,
      maxValue: ps.length-1,
      plugins: new Ext.ux.SliderTip({
        getText : function(slider){return String.format(tt, ps[slider.getValue()]);}
      }),
      listeners: {
        changecomplete: function(s, v){
          pagingToolbar.pageSize = ps[v];
          var rowIndex = 0;
          var gp = pagingToolbar.findParentBy (
            function (ct, cmp) {return (ct instanceof Ext.grid.GridPanel) ? true : false;}
          );
          var sm = gp.getSelectionModel();
          if (undefined != sm && sm.hasSelection()) {
            if (sm instanceof Ext.grid.RowSelectionModel) {
              rowIndex = gp.store.indexOf( sm.getSelected() ) ;
            } else if (sm instanceof Ext.grid.CellSelectionModel) {
              rowIndex = sm.getSelectedCell()[0] ;
            }
          }
          rowIndex += pagingToolbar.cursor;
          pagingToolbar.doLoad(Math.floor(rowIndex/pagingToolbar.pageSize)*pagingToolbar.pageSize);
        }
      }
    });

    var inputIndex = pagingToolbar.items.indexOf(pagingToolbar.refresh);
    pagingToolbar.insert(++inputIndex,'-');
    pagingToolbar.insert(++inputIndex, slider);
    pagingToolbar.on({
      beforedestroy: function() {
        slider.destroy();
      }
    });

  }
});

Ext.namespace('Ext.ux.plugins');

Ext.ux.plugins.PageCycleResizer = Ext.extend(Object, {

  pageSizes: [5, 10, 15, 20, 25, 30, 50, 75, 100, 200, 300, 500],
  prependText: '',
  appendText: ' items per page',

  constructor: function(config){
    Ext.apply(this, config);
    Ext.ux.plugins.PageCycleResizer.superclass.constructor.call(this, config);
  },

  init : function(pagingToolbar){

    var at = this.appendText; var ic = this.iconCls;
    var items=[];
    Ext.iterate(this.pageSizes, function(ps) {
      items.push({
        text: " " + ps + at,
        value: ps,
        iconCls:ic,
        checked: pagingToolbar.pageSize==ps ? true : false
      });
    });

    var pt = this.prependText;
    var button = new Ext.CycleButton({
      showText: true,
      prependText: pt,
      items: items,
      listeners: {
        change: function(button, item) {
          pagingToolbar.pageSize = item.value;
          PAGE_LIMIT = item.value
          var rowIndex = 0;
          var gp = pagingToolbar.findParentBy (
            function (ct, cmp) {return (ct instanceof Ext.grid.GridPanel) ? true : false;}
          );
          var sm = gp.getSelectionModel();
          if (undefined != sm && sm.hasSelection()) {
            if (sm instanceof Ext.grid.RowSelectionModel) {
              rowIndex = gp.store.indexOf( sm.getSelected() ) ;
            } else if (sm instanceof Ext.grid.CellSelectionModel) {
              rowIndex = sm.getSelectedCell()[0] ;
            }
          }
          rowIndex += pagingToolbar.cursor;
          pagingToolbar.doLoad(Math.floor(rowIndex/pagingToolbar.pageSize)*pagingToolbar.pageSize);
        }
      }
    });

    var inputIndex = pagingToolbar.items.indexOf(pagingToolbar.refresh);
    pagingToolbar.insert(++inputIndex,'-');
    pagingToolbar.insert(++inputIndex, button);
    pagingToolbar.on({
      beforedestroy: function() {
        button.destroy();
      }
    });
  }
});
