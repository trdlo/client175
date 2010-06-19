/*!
 * Ext JS Library 3.2.1
 * Copyright(c) 2006-2010 Ext JS, Inc.
 * licensing@extjs.com
 * http://www.extjs.com/license
 */
function setActiveStyleSheet(title) {
    var i,
        a,
        links = document.getElementsByTagName("link"),
        len = links.length;
    for (i = 0; i < len; i++) {
        a = links[i];
        if (a.getAttribute("rel").indexOf("style") != -1 && a.getAttribute("title")) {
            a.disabled = true;
            if (a.getAttribute("title") == title) a.disabled = false;
        }
    }
}

function getActiveStyleSheet() {
    var i,
        a,
        links = document.getElementsByTagName("link"),
        len = links.length;
    for (i = 0; i < len; i++) {
        a = links[i];
        if (a.getAttribute("rel").indexOf("style") != -1 && a.getAttribute("title") && !a.disabled) {
            return a.getAttribute("title");
        }
    }
    return null;
}

function getPreferredStyleSheet() {
    var i,
        a,
        links = document.getElementsByTagName("link"),
        len = links.length;
    for (i = 0; i < len; i++) {
        a = links[i];
        if (a.getAttribute("rel").indexOf("style") != -1 && a.getAttribute("rel").indexOf("alt") == -1 && a.getAttribute("title")) {
            return a.getAttribute("title");
        }
    }
    return null;
}

window.onload = function (e) {
    var cookie = Ext.state.Manager.get('style');
    var title = cookie ? cookie : getPreferredStyleSheet();
    setActiveStyleSheet(title);
}

window.onunload = function (e) {
    var title = getActiveStyleSheet();
    Ext.state.Manager.set('style', title)
}

var cookie = Ext.state.Manager.get('style');
var title = cookie ? cookie : getPreferredStyleSheet();
setActiveStyleSheet(title);
