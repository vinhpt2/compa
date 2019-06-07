define([
    "dojo/_base/declare",
    "dijit/_Widget",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "xstyle/css!./css/aws.css",
    "dojo/text!./AWSnap.html",
    "dijit/Toolbar",
    "dijit/ToolbarSeparator",
    "dijit/TooltipDialog",
    "dijit/form/CheckBox",
    "dijit/form/DropDownButton",
	"dijit/form/NumberSpinner",
    "dijit/ColorPalette",
    "dijit/Fieldset",
    "dijit/form/Select",
    "dijit/form/ToggleButton"
],
function (declare, _Widget, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, css, html) {
    var that = null;

    //AWSnap - Công cụ bắt dính
    return declare("vh.awt.AWSnap", [_Widget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: html,
        iconClass: "awsnap-png",
        title: "AWSnap Tools",

        //conf{map, dynamicLayer, graphicLayer, graphicLayerSketch}
        constructor: function (conf, refNode) {
            this.inherited(arguments);

            that = this;
            this._conf = conf;
        },
        postCreate: function () {
            this.inherited(arguments);
        },
        startup: function () {
            this.inherited(arguments);
        },
        destroy: function () {
            this.inherited(arguments);
        },
        _getSnapInfos: function () {
            var layerInfos = [];
            if (this._conf.controlLayer.layers) {
                for (var i = 0; i < this._conf.controlLayer.layers.length; i++) {
                    if (this._conf.controlLayer.infos[i]._snap)
                        layerInfos.push({ layer: this._conf.controlLayer.layers[i], snapToPoint: this.cmdSnapPoint.checked, snapToVertex: this.cmdSnapVertex.checked, snapToEdge: this.cmdSnapEdge.checked });
                }
            }
            if (this._conf.graphicLayerDraw)
                layerInfos.push({ layer: this._conf.graphicLayerDraw, snapToPoint: this.cmdSnapPoint.checked, snapToVertex: this.cmdSnapVertex.checked, snapToEdge: this.cmdSnapEdge.checked });
            if (this._conf.graphicLayerSketch)
                layerInfos.push({ layer: this._conf.graphicLayerSketch, snapToPoint: this.cmdSnapPoint.checked, snapToVertex: this.cmdSnapVertex.checked, snapToEdge: this.cmdSnapEdge.checked });
            return layerInfos;
        },
        chkSnapEnable_onChange: function (value) {
            if (value) {
                var color = this.palSnapColor.value ? new dojo.Color("#" + this.palSnapColor.value) : new dojo.Color([255, 0, 0]);
                color.a = 0.75;
                this._conf._snap = this._conf.map.enableSnapping({
                    tolerance: this.txtSnapTolerence.value,
                    layerInfos: this._getSnapInfos(),
                    snapPointSymbol: new esri.symbol.SimpleMarkerSymbol(this.cboSnapStyle.value, 2 * this.txtSnapTolerence.value, null, color),
                    alwaysSnap: this.cboSnapActivate.value == "A"
                });
            } else {
                this._conf.map.disableSnapping();
            }

            this._disableSnapTools(!value);
        },
        txtSnapTolerence_onChange: function (value) {
            this._conf.map._snap.tolerance = value
            this._draw.map._snap.snapPointSymbol.setSize(value * 2);
        },
        cboSnapActivate_onChange: function (value) {
            this._conf.map._snap.tolerance = value
        },
        cboSnapStyle_onChange: function (value) {
            this._draw.map._snap.alwaysSnap = (value == "A");
        },
        palSnapColor_onChange: function (value) {
            this.butSnapColor.titleNode.style.color = value;
            this._draw.map._snap.snapPointSymbol.setColor(value);
        },
        _disableSnapTools: function (isDisabled) {
            this.txtSnapTolerence.setDisabled(isDisabled);
            this.cboSnapActivate.setDisabled(isDisabled);
            this.cboSnapStyle.setDisabled(isDisabled);
            this.butSnapColor.setDisabled(isDisabled);

            this.cmdSnapPoint.setDisabled(isDisabled);
            this.cmdSnapVertex.setDisabled(isDisabled);
            this.cmdSnapEdge.setDisabled(isDisabled);
        }
    });
})