define([
    "dojo/_base/declare",
    "dijit/_Widget",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "xstyle/css!./css/awb.css",
    "dojo/text!./AWBasic.html",
    "esri/basemaps",
    "esri/tasks/IdentifyTask",
    "esri/tasks/IdentifyParameters",
    "esri/layers/GraphicsLayer",
    "esri/toolbars/draw",
    "esri/toolbars/navigation",
    "esri/dijit/editing/Editor",
    "dijit/Toolbar",
    "dijit/ToolbarSeparator",
    "dijit/form/NumberTextBox",
    "dijit/form/Select",
    "dijit/form/Button",
    "dijit/form/DropDownButton",
    "dijit/form/ComboButton",
    "dijit/form/ToggleButton",
    "dijit/TooltipDialog",
    "dijit/RadioMenuItem",
    "dijit/Menu",
    "dijit/Tooltip",
    "dojo/store/Memory",
    "dojo/data/ObjectStore",
    "dojox/grid/DataGrid",
    "./lib/awt"
],
function (declare, _Widget, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, css, html) {
    var that;

    //AWBasic - Công cụ bản đồ cơ bản
    return declare("vh.awt.AWBasic", [_Widget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: html,
        iconClass: "awbasic-png",
        title: "AWBasic Tools",

        //conf{map, draw, dynamicLayer, graphicLayer, printTemplates}
        constructor: function (conf, refNode) {
            this.inherited(arguments);
            that = this;
            this._conf = conf;
            this.layer = this._conf.dynamicLayer;
            this.layerSwipe = this.layer;
            this._taskIdentify = new esri.tasks.IdentifyTask(conf.dynamicLayer.url);

            this._paramsIdentify = new esri.tasks.IdentifyParameters();
            this._paramsIdentify.layerOption = "visible";
            this._paramsIdentify.returnGeometry = true;

            this._paramsSelect = new esri.tasks.IdentifyParameters();
            this._paramsSelect.layerOption = "visible";
            this._paramsSelect.returnFieldName = true;
            this._paramsSelect.returnUnformattedValues = true;
            this._paramsSelect.returnGeometry = true;
            this._paramsSelect.tolerance = 0;

            conf._navi = new esri.toolbars.Navigation(conf.map);
            conf._navi.on("extent-history-change", this.navi_onExtentHistoryChange);
            conf.draw.on("draw-end", this.draw_onDrawEnd);

            conf.map.on("mouse-down", this.map_onMouseDown);
            conf.map.on("mouse-drag", this.map_onMouseDrag);
            conf.map.on("mouse-down", this.map_onMouseDown);
            conf.map.on("basemap-change", function (evt) {
                that.itmSwipeBasemap.tag = that._conf.map.basemapLayerIds[0];
                that.itmSwipeBasemap.setLabel(that.itmSwipeBasemap.tag);
                that.layerSwipe = that._conf.map.getLayer(that.itmSwipeBasemap.tag);
            });

            conf.map.on("load", function () {
                for (var i = that._conf.map.layerIds.length - 1; i >= 0; i--) {
                    var id = that._conf.map.layerIds[i];
                    var lyr = that._conf.map.getLayer(id);
                    var itm = new dijit.RadioButtonMenuItem({ label: id, group: "swipe", checked: (id == that.layerSwipe.id), tag: id });
                    itm.on("change", that.itmSwipe_onChange);
                    that.mnuSwipe.addChild(itm);
                    if (i == 0) that.itmSwipeBasemap = itm;
                }
            });
        },
        postCreate: function () {
            this.inherited(arguments);

            this.toolPan.on("click", this.tool_onClick);
            this.toolZoomIn.on("click", this.tool_onClick);
            this.toolZoomOut.on("click", this.tool_onClick);
            this.toolIdentify.on("click", this.tool_onClick);
            this.toolSelect.on("click", this.tool_onClick);
            this.toolSwipe.on("click", this.tool_onClick);
            this.toolMeasure.on("click", this.tool_onClick);

            //basemap & tooltip
            for (var key in esri.basemaps) {
                if (esri.basemaps.hasOwnProperty(key)) {
                    var itm = new dijit.RadioButtonMenuItem({ label: esri.basemaps[key].title, group: "basemap", checked: this._conf.map._basemap == key, tag: esri.basemaps[key] });
                    itm.on("change", this.itmBasemap_onChange);
                    itm.on("mouseenter", function () { dijit.Tooltip.show("<img style='width:150px;height:150px' src='" + this.tag.thumbnailUrl + "'/>", this.domNode) });
                    itm.on("mouseleave", function () { dijit.Tooltip.hide(this.domNode) });
                    this.mnuBaseMap.addChild(itm);
                }
            }

            //print templates
            for (var i = 0; i < vh.awt.PRINT_TEMPLATES.length; i++) {
                var tpl = vh.awt.PRINT_TEMPLATES[i];
                var mnu = new dijit.MenuItem({
                    label: tpl.name,
                    tag: tpl.url,
                    onClick: function () {
                        var win = window.open(this.tag);
                        win.onload = function () {
                            var div = win.document.getElementById("divMap");
                            that._conf.map.root.style.width = div.style.width;
                            that._conf.map.root.style.height = div.style.height;
                            that._conf.map.resize(true);
                            div.innerHTML = that._conf.map.root.innerHTML;
                        }
                    }
                });
                this.mnuPrintMap.addChild(mnu);
            }
        },
        startup: function () {
            this.inherited(arguments);
        },
        destroy: function () {
            this.inherited(arguments);
        },
        cmdUnSelect_onClick: function () {
            this._conf.graphicLayer.clear();
        },
        cmdFullExtent_onClick: function () {
            this._conf._navi.zoomToFullExtent();
        },
        txtScale_onChange: function (value) {
            this._conf.map.setScale(value);
        },
        cmdBackExtent_onClick: function () {
            this._conf._navi.zoomToPrevExtent();
        },
        cmdNextExtent_onClick: function () {
            this._conf._navi.zoomToNextExtent();
        },
        cmdTransparent_onClick: function () {
            this.cmdTransparent.checked = !this.cmdTransparent.checked;
            this._conf.dynamicLayer.setOpacity(this.cmdTransparent.checked ? vh.awt.TRANSPARENT_DYNAMICLAYER : 1)
        },
        cmdHelp_onClick: function () {
            var win = window.open("help.html");
        },
        itmSwipe_onChange: function () {
            that._swipeX = undefined;
            that._swipeY = undefined;
            if (that.layerSwipe._div) that.layerSwipe._div.style.clip = "";

            that.layerSwipe = that._conf.map.getLayer(this.tag);
        },
        itmBasemap_onChange: function () {
            that._conf.map.setBasemap(this.tag);
        },
        itmSelectType_onChange: function () {
            if (this.itmSelectTop.checked) {
                this._paramsIdentify.layerOption = "top";
                this._paramsSelect.layerOption = "top";
            } else if (this.itmSelectVisible.checked) {
                this._paramsIdentify.layerOption = "visible";
                this._paramsSelect.layerOption = "visible";
            } else {
                this._paramsIdentify.layerOption = "all";
                this._paramsSelect.layerOption = "all";
            }
        },
        txtSelectTolerance_onChange: function (value) {
            alert(value)
        },
        itmMeasureType_onChange: function () {
            if (this._conf._curTool.dojoAttachPoint == "toolMeasure") {
                if (this.itmMeasureLocation.checked)
                    this._conf.draw.activate(esri.toolbars.Draw.POINT);
                else if (this.itmMeasureLength.checked)
                    this._conf.draw.activate(esri.toolbars.Draw.POLYLINE);
                else
                    this._conf.draw.activate(esri.toolbars.Draw.POLYGON);
            }
        },
        navi_onExtentHistoryChange: function () {
            that.txtScale.setValue(Math.round(that._conf.map.getScale()));
            that.cmdBackExtent.setDisabled(this.isFirstExtent());
            that.cmdNextExtent.setDisabled(this.isLastExtent());
        },
        runSwipe: function () {
            //rect(top right bottom left)
            if (!isNaN(that._swipeX) && !isNaN(that._swipeY)) {
                var left = isNaN(this.layerSwipe._left) ? -this.layerSwipe.__coords_dx : -this.layerSwipe._left;
                var top = isNaN(this.layerSwipe._top) ? -this.layerSwipe.__coords_dy : -this.layerSwipe._top;

                var rect = "rect(" + top + "px " + (this._swipeX + left) + "px " + (this._conf.map.height + top) + "px " + left + "px)";
                this.layerSwipe._div.style.clip = rect;
            }
        },
        map_onMouseDown: function (evt) {
            if (that._conf._curTool && that._conf._curTool.dojoAttachPoint == "toolSwipe") {
                that._swipeX = evt.screenPoint.x;
                that._swipeY = evt.screenPoint.y;
                that.runSwipe();
            }
        },
        map_onMouseDrag: function (evt) {
            if (that._conf._curTool && that._conf._curTool.dojoAttachPoint == "toolSwipe") {
                that._swipeX = evt.screenPoint.x;
                that._swipeY = evt.screenPoint.y;
                that.runSwipe();
            }
        },
        tool_onClick: function (tool, deactived) {
            //recall to deactive old tool
            if (tool instanceof Event) tool = this;
            if (!deactived) {
                if (that._conf._curTool && that._conf._curTool != tool) {
                    that.tool_onClick(that._conf._curTool, true);
                    that._conf._curTool.domNode.style.border = "";
                }
                tool.domNode.style.border = "1px solid blue";
                that._conf._curTool = tool;
            }

            switch (tool.dojoAttachPoint) {
                case "toolPan":
                    if (deactived) {
                        that._conf._navi.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("grab");
                        that._conf._navi.activate(esri.toolbars.Navigation.PAN);
                    }
                    break;
                case "toolZoomIn":
                    if (deactived) {
                        that._conf._navi.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("zoom-in");
                        that._conf._navi.activate(esri.toolbars.Navigation.ZOOM_IN);
                    }
                    break;
                case "toolZoomOut":
                    if (deactived) {
                        that._conf._navi.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("zoom-out");
                        that._conf._navi.activate(esri.toolbars.Navigation.ZOOM_OUT);
                    }
                    break;
                case "toolIdentify":
                    if (deactived) {
                        that.winIdentify.hide();
                        that._conf.draw.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("help");
                        that._conf.draw.activate(esri.toolbars.Draw.POINT);
                    }
                    break;
                case "toolMeasure":
                    if (deactived) {
                        that.winMeasure.hide();
                        that._conf.draw.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("crosshair");
                        that.itmMeasureType_onChange();
                    }
                    break;
                case "toolSelect":
                    if (deactived) {
                        that._conf.draw.deactivate();
                    } else {
                        that._conf.map.setMapCursor("default");
                        that._conf.draw.activate(esri.toolbars.Draw.EXTENT);
                    }
                    break;
                case "toolSwipe":
                    if (deactived) {
                        that.layerSwipe._div.style.clip = "";
                        that._swipeX = undefined;
                        that._swipeY = undefined;
                        that._conf.map.enablePan();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("crosshair");
                        that._conf.map.disablePan();
                    }
                    break;
                default:
                    that._conf._navi.deactivate();
                    that._conf.draw.deactivate();
            }
        },
        draw_onDrawEnd: function (evt) {

            switch (that._conf._curTool.dojoAttachPoint) {
                case "toolMeasure":
                    that.labMeasure.innerHTML = vh.awt.calculateGeometryMsg(evt.geometry);
                    that.winMeasure.show();
                    break;
                case "toolIdentify":
                    this._paramsIdentify.tolerance = vh.awt.IDENTIFY_TOLERANCE;
                case "toolSelect":
                    var params = (that._conf._curTool.dojoAttachPoint == "toolSelect") ? that._paramsSelect : that._paramsIdentify;
                    params.geometry = evt.geometry;
                    params.mapExtent = that._conf.map.extent;

                    that._taskIdentify.execute(params, function (results) {
                        that._conf.graphicLayer.clear();
                        for (var i = 0; i < results.length; i++) {
                            var feat = results[i].feature;
                            feat.setSymbol(vh.awt.SYMB_SELECT[feat.geometry.type]);
                            feat.LID = results[i].layerId;
                            that._conf.graphicLayer.add(feat);
                        }
                        if (that._conf._curTool.dojoAttachPoint == "toolIdentify" && results.length > 0) {
                            var attr = results[0].feature.attributes;
                            var rows = [];
                            for (var fld in attr) {
                                if (attr.hasOwnProperty(fld)) {
                                    rows.push({ field: fld, value: attr[fld] });
                                }
                            }
                            that.gridIdentify.setStore(new dojo.data.ObjectStore({ objectStore: new dojo.store.Memory({ data: rows }) }));
                            that.labIdentifyLayer.innerHTML = "Layer: " + results[0].layerName;
                            that.labIdentifyLocation.innerHTML = "At: " + vh.awt.calculateGeometryMsg(evt.geometry);
                            that.winIdentify.show();
                        }
                    }, function (error) { vh.awt.showError(error) });

                    break;
            }
        }
    })
})