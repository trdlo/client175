/**
 * A class to parse color values
 * @author Stoyan Stefanov <sstoo@gmail.com>
 * @link   http://www.phpied.com/rgb-color-parser-in-javascript/
 * @license Use it if you like it
 */

Ext.ns("colorUtil")
Ext.ns("Ext.ux.format.Color")
colorUtil.simple_colors = {
    aliceblue: 'f0f8ff',
    antiquewhite: 'faebd7',
    aqua: '00ffff',
    aquamarine: '7fffd4',
    azure: 'f0ffff',
    beige: 'f5f5dc',
    bisque: 'ffe4c4',
    black: '000000',
    blanchedalmond: 'ffebcd',
    blue: '0000ff',
    blueviolet: '8a2be2',
    brown: 'a52a2a',
    burlywood: 'deb887',
    cadetblue: '5f9ea0',
    chartreuse: '7fff00',
    chocolate: 'd2691e',
    coral: 'ff7f50',
    cornflowerblue: '6495ed',
    cornsilk: 'fff8dc',
    crimson: 'dc143c',
    cyan: '00ffff',
    darkblue: '00008b',
    darkcyan: '008b8b',
    darkgoldenrod: 'b8860b',
    darkgray: 'a9a9a9',
    darkgreen: '006400',
    darkkhaki: 'bdb76b',
    darkmagenta: '8b008b',
    darkolivegreen: '556b2f',
    darkorange: 'ff8c00',
    darkorchid: '9932cc',
    darkred: '8b0000',
    darksalmon: 'e9967a',
    darkseagreen: '8fbc8f',
    darkslateblue: '483d8b',
    darkslategray: '2f4f4f',
    darkturquoise: '00ced1',
    darkviolet: '9400d3',
    deeppink: 'ff1493',
    deepskyblue: '00bfff',
    dimgray: '696969',
    dodgerblue: '1e90ff',
    feldspar: 'd19275',
    firebrick: 'b22222',
    floralwhite: 'fffaf0',
    forestgreen: '228b22',
    fuchsia: 'ff00ff',
    gainsboro: 'dcdcdc',
    ghostwhite: 'f8f8ff',
    gold: 'ffd700',
    goldenrod: 'daa520',
    gray: '808080',
    green: '008000',
    greenyellow: 'adff2f',
    honeydew: 'f0fff0',
    hotpink: 'ff69b4',
    indianred : 'cd5c5c',
    indigo : '4b0082',
    ivory: 'fffff0',
    khaki: 'f0e68c',
    lavender: 'e6e6fa',
    lavenderblush: 'fff0f5',
    lawngreen: '7cfc00',
    lemonchiffon: 'fffacd',
    lightblue: 'add8e6',
    lightcoral: 'f08080',
    lightcyan: 'e0ffff',
    lightgoldenrodyellow: 'fafad2',
    lightgrey: 'd3d3d3',
    lightgreen: '90ee90',
    lightpink: 'ffb6c1',
    lightsalmon: 'ffa07a',
    lightseagreen: '20b2aa',
    lightskyblue: '87cefa',
    lightslateblue: '8470ff',
    lightslategray: '778899',
    lightsteelblue: 'b0c4de',
    lightyellow: 'ffffe0',
    lime: '00ff00',
    limegreen: '32cd32',
    linen: 'faf0e6',
    magenta: 'ff00ff',
    maroon: '800000',
    mediumaquamarine: '66cdaa',
    mediumblue: '0000cd',
    mediumorchid: 'ba55d3',
    mediumpurple: '9370d8',
    mediumseagreen: '3cb371',
    mediumslateblue: '7b68ee',
    mediumspringgreen: '00fa9a',
    mediumturquoise: '48d1cc',
    mediumvioletred: 'c71585',
    midnightblue: '191970',
    mintcream: 'f5fffa',
    mistyrose: 'ffe4e1',
    moccasin: 'ffe4b5',
    navajowhite: 'ffdead',
    navy: '000080',
    oldlace: 'fdf5e6',
    olive: '808000',
    olivedrab: '6b8e23',
    orange: 'ffa500',
    orangered: 'ff4500',
    orchid: 'da70d6',
    palegoldenrod: 'eee8aa',
    palegreen: '98fb98',
    paleturquoise: 'afeeee',
    palevioletred: 'd87093',
    papayawhip: 'ffefd5',
    peachpuff: 'ffdab9',
    peru: 'cd853f',
    pink: 'ffc0cb',
    plum: 'dda0dd',
    powderblue: 'b0e0e6',
    purple: '800080',
    red: 'ff0000',
    rosybrown: 'bc8f8f',
    royalblue: '4169e1',
    saddlebrown: '8b4513',
    salmon: 'fa8072',
    sandybrown: 'f4a460',
    seagreen: '2e8b57',
    seashell: 'fff5ee',
    sienna: 'a0522d',
    silver: 'c0c0c0',
    skyblue: '87ceeb',
    slateblue: '6a5acd',
    slategray: '708090',
    snow: 'fffafa',
    springgreen: '00ff7f',
    steelblue: '4682b4',
    tan: 'd2b48c',
    teal: '008080',
    thistle: 'd8bfd8',
    tomato: 'ff6347',
    turquoise: '40e0d0',
    violet: 'ee82ee',
    violetred: 'd02090',
    wheat: 'f5deb3',
    white: 'ffffff',
    whitesmoke: 'f5f5f5',
    yellow: 'ffff00',
    yellowgreen: '9acd32'
};

// array of color definition objects
colorUtil.color_defs = [
    {
        re: /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/,
        // example: ['rgb(123, 234, 45)', 'rgb(255,234,245)'],
        process: function (bits){
            return [
                parseInt(bits[1]),
                parseInt(bits[2]),
                parseInt(bits[3])
            ];
        }
    },
    {
        re: /^(\w{2})(\w{2})(\w{2})$/,
        // example: ['#00ff00', '336699'],
        process: function (bits){
            return [
                parseInt(bits[1], 16),
                parseInt(bits[2], 16),
                parseInt(bits[3], 16)
            ];
        }
    },
    {
        re: /^(\w{1})(\w{1})(\w{1})$/,
        // example: ['#fb0', 'f0f'],
        process: function (bits){
            return [
                parseInt(bits[1] + bits[1], 16),
                parseInt(bits[2] + bits[2], 16),
                parseInt(bits[3] + bits[3], 16)
            ];
        }
    }
];

colorUtil.intToHex = function(oColor) {
    var r = oColor.r.toString(16);
    var h = oColor.g.toString(16);
    var b = oColor.b.toString(16);
    if (r.length == 1) r = '0' + r;
    if (g.length == 1) g = '0' + g;
    if (b.length == 1) b = '0' + b;
    return { r:r, g:g, b:b }
}

Ext.ux.format.Color.parse = function(color_string) {
    var ok = false;

    // strip any leading #
    if (color_string.charAt(0) == '#') { // remove # if any
        color_string = color_string.substr(1,6);
    }

    color_string = color_string.replace(/ /g,'');
    color_string = color_string.toLowerCase();

    // before getting into regexps, try simple matches
    // and overwrite the input
    Ext.iterate(colorUtil.simple_colors, function(key, value) {
        if (color_string == key) {
            color_string = simple_colors[key];
            return false
        }
    })

    // search through the definitions to find a match
    Ext.each(colorUtil.color_defs, function (item, index, arr) {
        var bits = item.re.exec(color_string);
        if (bits) {
            channels = item.process(bits);
            var r = channels[0];
            var g = channels[1];
            var b = channels[2];
            ok = true;
            return false
        }
    })

    if (!ok) return null
    
    // validate/cleanup values
    r = (r < 0 || isNaN(r)) ? 0 : ((r > 255) ? 255 : r);
    g = (g < 0 || isNaN(g)) ? 0 : ((g > 255) ? 255 : g);
    b = (b < 0 || isNaN(b)) ? 0 : ((b > 255) ? 255 : b);
        
    return { r:r, g:g, b:b }
}

var _Colorparse = Ext.ux.format.Color.parse
var _ith = colorUtil.intToHex
Ext.ux.format.Color.toRGB = function (c) {
    if (Ext.isString(c)) c = _Colorparse(c)
    if (!Ext.isObject(c)) return 'rgb(0, 0, 0)'
    return 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')';
}

Ext.ux.format.Color.toHex = function (c) {
    if (Ext.isString(c)) c = _Colorparse(c)
    if (!Ext.isObject(c)) return '#000000'
    c = _ith(c)
    return '#' + c.r + c.g + c.b;
}

Ext.ux.format.Color.toVbaHex = function (c) {
    if (Ext.isString(c)) c = _Colorparse(c)
    if (!Ext.isObject(c)) return '&H000000'
    c = _ith(c)
    return '&H' + c.b + c.g + c.r;
}

Ext.ux.format.Color.toVbaLong = function (c) {
    if (Ext.isString(c)) c = _Colorparse(c)
    if (!Ext.isObject(c)) return 0
    return (c.r * 65536) + (c.g * 256) + c.b
}

