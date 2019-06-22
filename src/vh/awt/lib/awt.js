//awt2 - Thư viện dùng chung
if (!vh) var vh = {};
if (!vh.awt) vh.awt = {};

vh.awt.URL_WEBSITE = "http://compa.awetool.com";
vh.awt.URL_ARCGISONLINE_GEOMETRY_SERVICE = "https://tasks.arcgisonline.com/ArcGIS/rest/services/Geometry/GeometryServer";
vh.awt.MAX_SELECT_FEATURE = 500;
vh.awt.TRANSPARENT_DYNAMICLAYER = 0.25;
vh.awt.IDENTIFY_TOLERANCE = 1;//Đơn vị là pixel
vh.awt.PRINT_TEMPLATES = [
    { name: "landscape-a4", url: "vh/awt/prints/landscape-a4.html" },
    { name: "potrait-a4", url: "vh/awt/prints/potrait-a4.html" }
];
//Hàm toàn cục
define(["dijit/Dialog","esri/symbols/SimpleMarkerSymbol","esri/symbols/SimpleLineSymbol","esri/symbols/SimpleFillSymbol","esri/symbols/TextSymbol","esri/symbols/Font"],
function (Dialog, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, TextSymbol, Font) {
    vh.awt.SYMB_MEASURE = {//Symbol dùng khi measure
        point: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_DIAMOND, 8, null, new dojo.Color([255, 127, 0])),
        polyline: new SimpleLineSymbol(SimpleLineSymbol.STYLE_LONGDASH, new dojo.Color([255, 127, 0]), 2),
        polygon: new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_LONGDASH, new dojo.Color([255, 127, 0]), 2), new dojo.Color([255, 127, 0, 0.25]))
    }

    vh.awt.SYMB_HIGHLIGHT = {//Symbol dùng khi highlight
        point: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 6, null, new dojo.Color([255, 255, 0])),
        polyline: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 255, 0]), 2),
        polygon: new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 255, 0]), 2), new dojo.Color([255, 255, 0, 0.25]))
    }

    vh.awt.SYMB_SELECT = {//Symbol dùng khi select
        point: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 6, null, new dojo.Color([255, 255, 0])),
        polyline: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 255, 0]), 2),
        polygon: new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 255, 0]), 2), new dojo.Color([255, 255, 0, 0.25]))
    }

    var symbSelMarker = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 6, null, new dojo.Color([0, 255, 0]));
    var symbSelLine = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 255, 0]), 2);
    var symbSelFill = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 255, 0]), 2), new dojo.Color([0, 255, 0, 0.25]));
    vh.awt.SYMB_EDITSELECT = {//Symbol dùng khi edit-select
        point: symbSelMarker,
        polyline: symbSelLine,
        polygon: symbSelFill,
        esriGeometryPoint:symbSelMarker,
        esriGeometryPolyline:symbSelLine,
        esriGeometryPolygon:symbSelFill
    }

    vh.awt.SYMB_EDITVERTEX={//Symbol dùng khi edit-vertex
        ghostLine: SimpleLineSymbol(SimpleLineSymbol.STYLE_DOT, new dojo.Color([0, 0, 0]), 1),
        ghostVertex: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 5, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 0, 0]), 1), new dojo.Color([255, 255, 255])),
        vertex: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 7, null, new dojo.Color([0, 0, 0]))
    }

    vh.awt.SYMB_HELPER={//Symbol của các đối tượng helper
        indicator: new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE, 7, null, new dojo.Color([255, 0, 0])),
        direction: new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new dojo.Color([255, 0, 0]), 2),
        sketch: new SimpleLineSymbol(SimpleLineSymbol.STYLE_DOT, new dojo.Color([0, 0, 0]), 1)
    }

    vh.awt.calculateGeometryMsg = function (geometry) {
    var msg, ps;
    var l = 0, len = 0, s = 0;
    switch (geometry.type) {
        case "point":
            msg = "x=" + geometry.x.toFixed(3) + ", y=" + geometry.y.toFixed(3);
            break;
        case "polyline":
            ps = geometry.paths[0];
            for (var j = 0; j < ps.length; j++) {
                if (j > 0) {
                    l = Math.sqrt((ps[j][0] - ps[j - 1][0]) * (ps[j][0] - ps[j - 1][0]) + (ps[j][1] - ps[j - 1][1]) * (ps[j][1] - ps[j - 1][1]));
                    len += l;
                }
            }
            msg = "length=" + (len<1000?len.toFixed(2) + "m":(len/1000).toFixed(2) + "km");
            break;
        case "polygon":
            ps = geometry.rings[0];
            for (var j = 0; j < ps.length; j++) {
                if (j > 0) {
                    l = Math.sqrt((ps[j][0] - ps[j - 1][0]) * (ps[j][0] - ps[j - 1][0]) + (ps[j][1] - ps[j - 1][1]) * (ps[j][1] - ps[j - 1][1]));
                    len += l;
                    s += (ps[j][0] - ps[j - 1][0]) * (ps[j][1] + ps[j - 1][1]);
                }
            }
            var area=Math.abs(s / 2);
            msg = "area=" + (area < 1000000 ? area.toFixed(2) + "m²" : (area / 1000000).toFixed(2) + "km²") + ", length=" + (len < 1000 ? len.toFixed(2) + "m" : (len / 1000).toFixed(2) + "km");
            break;
        }
        return msg;
    }
//Dialog

    vh.awt.showInput = function (title, input, okCallback) {
        var dlg = new dijit.Dialog({
            title: title,
            content: input,
            actionBarTemplate: "<div class='dijitDialogPaneActionBar' data-dojo-attach-point='actionBarNode'><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butOk'>Ok</button><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butCancel'>Cancel</button></div>"
        });

        dlg.butOk.addEventListener("click", function () { dlg.hide() });
        if (okCallback) dlg.butOk.addEventListener("click", okCallback);
        dlg.butCancel.addEventListener("click", function () { dlg.hide() });
        dlg.show();
    }

    vh.awt.showNotify = function (msg, seconds) {
        var dlg = new dijit.Dialog({
            title: "Notification",
            content: "<table valign='center'><tr><td><img src='vh/awt/css/notify32.png'/></td><td>&nbsp;</td><td>" + msg + "</td></tr></table>"
        });
        dlg.show();
        setTimeout(function () {
            dlg.hide();
        }, seconds ? 1000 * seconds : 1000);
    }

    vh.awt.showConfirm = function (msg, yesCallback, noCallback, hasCancel) {
        var dlg = new dijit.Dialog({
            title: "Confirm",
            content: "<table valign='center'><tr><td><img src='vh/awt/css/confirm32.png'/></td><td>&nbsp;</td><td>" + msg + "</td></tr></table>",
            actionBarTemplate: hasCancel ? "<div class='dijitDialogPaneActionBar' data-dojo-attach-point='actionBarNode'><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butYes'>Yes</button><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butNo'>No</button><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butCancel'>Cancel</button></div>" : "<div class='dijitDialogPaneActionBar' data-dojo-attach-point='actionBarNode'><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butYes'>Yes</button><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butNo'>No</button></div>"
        });

        dlg.butYes.addEventListener("click", function () { dlg.hide() });
        if (yesCallback) dlg.butYes.addEventListener("click", yesCallback);
        dlg.butNo.addEventListener("click", function () { dlg.hide() });
        if (noCallback) dlg.butNo.addEventListener("click", noCallback);
        if (hasCancel)
            dlg.butCancel.addEventListener("click", function () { dlg.hide() });
        dlg.show();
    }

    vh.awt.showInfor = function (msg, callback) {
        var dlg = new dijit.Dialog({
            title: "Information",
            content: "<table valign='center'><tr><td><img src='vh/awt/css/infor32.png'/></td><td>&nbsp;</td><td>" + msg + "</td></tr></table>",
            actionBarTemplate: "<div class='dijitDialogPaneActionBar' data-dojo-attach-point='actionBarNode'><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butOk'>Ok</button></div>"
        });

        dlg.butOk.addEventListener("click", function () { dlg.hide() });
        if (callback) dlg.butYes.addEventListener("click", callback);
        dlg.show();
    }

    vh.awt.showError = function (err, callback) {
        console.log(err)
        var dlg = new dijit.Dialog({
            title: "Error",
            content: "<table valign='center'><tr><td><img src='vh/awt/css/error32.png'/></td><td>&nbsp;</td><td>" + err + "</td></tr></table>",
            actionBarTemplate: "<div class='dijitDialogPaneActionBar' data-dojo-attach-point='actionBarNode'><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butOk'>Ok</button></div>"
        });

        dlg.butOk.addEventListener("click", function () { dlg.hide() });
        if (callback) dlg.butYes.addEventListener("click", callback);
        dlg.show();
    }

    vh.awt.showWarning = function (msg, callback) {
        var dlg = new dijit.Dialog({
            title: "Warning",
            content: "<table valign='center'><tr><td><img src='vh/awt/css/warning32.png'/></td><td>&nbsp;</td><td>" + msg + "</td></tr></table>",
            actionBarTemplate: "<div class='dijitDialogPaneActionBar' data-dojo-attach-point='actionBarNode'><button data-dojo-type='dijit/form/Button' data-dojo-attach-point='butOk'>Ok</button></div>"
        });

        dlg.butOk.addEventListener("click", function () { dlg.hide() });
        if (callback) dlg.butYes.addEventListener("click", callback);
        dlg.show();
    }
});





