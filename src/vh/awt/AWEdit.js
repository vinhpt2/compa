define([
    "dojo/_base/declare",
    "dijit/_Widget",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "xstyle/css!./css/awe.css",
    "dojo/text!./AWEdit.html",
    "esri/tasks/GeometryService",
    "esri/tasks/IdentifyTask",
    "esri/tasks/IdentifyParameters",
    "esri/layers/GraphicsLayer",
    "esri/layers/FeatureLayer",
    "esri/toolbars/edit",
    "esri/tasks/BufferParameters",
    "esri/dijit/editing/TemplatePicker",
    "esri/dijit/AttributeInspector",
    "dijit/Toolbar",
    "dijit/ToolbarSeparator",
    "dijit/form/DropDownButton",
    "dijit/Menu",
    "dijit/MenuItem",
	"dijit/PopupMenuItem",
    "dijit/MenuSeparator",
    "dijit/form/CheckBox",
    "dijit/form/TextBox",
    "dijit/form/NumberTextBox",
    "dijit/CheckedMenuItem",
    "dijit/RadioMenuItem",
    "dijit/form/Button",
    "dijit/form/ToggleButton",
    "dijit/popup",
    "dijit/Dialog",
    "dijit/layout/TabContainer",
    "dijit/Fieldset",
    "dijit/form/Select",
    "dojo/data/ObjectStore",
    "dojox/grid/DataGrid",
    "./lib/awt",
    "./lib/ControlLayer",
    "./lib/EditHelper",
    "./lib/DrawHelper",
    "./lib/Editor"
],
function (declare, _Widget, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, css, html) {
    var that = null;

    //AWEdit - Công cụ hiệu chỉnh
    return declare("vh.awt.AWEdit", [_Widget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: html,
        iconClass: "awedit-png",
        title: "AWEdit Tools",

        //conf={ map, dynamicLayer, graphicLayer, graphicLayerDraw, graphicLayerSketch, geometryService, edit, draw}
        constructor: function (conf, refNode) {
            this.inherited(arguments);
            that = this;
            this._conf = conf;
        },
        postCreate: function () {
            this.inherited(arguments);
            this.toolEditSelect.on("click", this.tool_onClick);
            this.toolEditPen.on("click", this.tool_onClick);
            this.toolEditAutoPolygon.on("click", this.tool_onClick);
            this.toolEditSplit.on("click", this.tool_onClick);
            this.toolEditReshape.on("click", this.tool_onClick);
            this._conf.dynamicLayer.on("load", this.init);
        },
        startup: function () {
            this.inherited(arguments);
        },
        destroy: function () {
            this.inherited(arguments);
        },
        init: function () {
            if (!that._editor) {//init?
                for (var i = 0; i < that._conf.dynamicLayer.layerInfos.length; i++)
                    that.cboAttributeLayer.addOption({ value: that._conf.dynamicLayer.layerInfos[i].id, label: that._conf.dynamicLayer.layerInfos[i].name, selected: (i == 0) });

                that._conf.draw.on("draw-end", that.draw_onDrawEnd);
                that._editor = new vh.awt.Editor(that._conf);
                that._editor.eventUseEdit = that.editor_onUseEdit;

                that._conf.controlLayer = new vh.awt.ControlLayer(that._conf.dynamicLayer.layerInfos);

                that._taskIdentify = new esri.tasks.IdentifyTask(that._conf.dynamicLayer.url);
                that._paramsIdentify = new esri.tasks.IdentifyParameters();
                that._paramsIdentify.layerOption = "visible";
                that._paramsIdentify.returnFieldName = true;
                that._paramsIdentify.returnUnformattedValues = true;
                that._paramsIdentify.returnGeometry = true;
                that._paramsIdentify.tolerance = 0;
            }
        },
        startEdit: function (session) {
            var count = this._conf.graphicLayer.graphics.length;
            if (count > vh.awt.MAX_SELECT_FEATURE) {
                vh.awt.showWarning("To many features are selected for editing (" + count + "/" + vh.awt.MAX_SELECT_FEATURE + ")");
            } else if (count == 0) {
                vh.awt.showConfirm("No feature is selected for editing, continue?", function () {
                    that._editor.begin(session);
                    that._conf.dynamicLayer.setOpacity(vh.awt.TRANSPARENT_DYNAMICLAYER);
                });
            } else {
                this._editor.begin(session);
                this._conf.dynamicLayer.setOpacity(vh.awt.TRANSPARENT_DYNAMICLAYER);
            }
        },
        itmEditBeginSession_onClick: function () {
            this.startEdit("vh" + Date.now());
        },
        itmEditBegin_onClick: function () {
            this.startEdit(null);
        },
        itmEditSave_onClick: function () {
            that._editor.applyEdits();
        },
        itmEditEnd_onClick: function () {
            if (this._editor.isDirty()) {
                vh.awt.showConfirm("Save changes to database?", function () {
                    that._editor.applyEdits();
                    that._editor.end();
                    that._conf.dynamicLayer.setOpacity(1);
                }, function () {
                    that._editor.end();
                    that._conf.dynamicLayer.setOpacity(1);
                }, true);
            } else {
                this._editor.end();
                this._conf.dynamicLayer.setOpacity(1);
            }
        },
        chkShowPropertyAttachment_onChange: function (value) {
            this._editor.showPropertyAttachment(value)
        },
        chkAttributeSelectedOnly_onChange: function () {
            that.cboAttributeLayer_onChange(false)
        },
        cboAttributeLayer_onChange: function (resetCols) {
            var layer = that._editor.layers[this.cboAttributeLayer.value];
            if (resetCols) {
                var cols = [];
                for (var i = 0; i < layer.fields.length; i++) {
                    var fld = layer.fields[i];
                    cols[i] = { field: fld.name, name: fld.alias, editable: fld.name != layer.objectIdField };
                }
                that.gridEditAttribute.setStructure(cols);
            }

            var rows = [];
            var features = that.chkAttributeSelectedOnly.checked ? layer.getSelectedFeatures() : features = layer.graphics;
            for (var i = 0; i < features.length; i++)
                rows[i] = features[i].attributes;

            that.gridEditAttribute.setStore(new dojo.data.ObjectStore({ objectStore: new dojo.store.Memory({ data: rows, idProperty: layer.objectIdField }) }));
            that.gridEditAttribute.features = features;
            that.labAttribute.innerHTML = "Count: " + rows.length + " feature(s)";
        },
        cmdEditExtract_onClick: function () {
            that._editor.extract(that._conf.graphicLayer.graphics);
            that._conf.graphicLayer.clear();
        },
        cmdEditAttribute_onClick: function () {
            that.cboAttributeLayer_onChange(true);
            that.winEditAttribute.show();
        },
        cmdEditProperty_onClick:function(){
            that.winEditProperty.show();
            that._editor.startupAttributeInspector(that.divEditProperty);
        },
        cmdLayerControl_onClick: function () {
            var rows = that._conf.controlLayer.infos;
            that.gridLayerControl.layout.cells[0].name = that._conf.dynamicLayer.id;
            that.gridLayerControl.setStore(new dojo.data.ObjectStore({ objectStore: new dojo.store.Memory({ data: rows }) }));
            that.winLayerControl.show();
            this._editor.startupTemplatePicker(this.divEditTemplate);
        },
        cmdEditActiveMRS_onClick: function () {
            that._editor.activeEditMRS();
        },
        cmdEditActiveVertices_onClick: function () {
            that._editor.activeEditVertices();
        },
        cmdEditDuplicate_onClick: function () {
            that._editor.duplicateSelectedFeatures();
        },
        cmdEditDelete_onClick: function () {
            that._editor.removeSelectedFeatures();
        },
        cmdEditMerge_onClick: function () {
            that._editor.unionSelectedFeatures();
        },
        cmdEditBuffer_onClick: function () {
            var input = new dijit.form.NumberTextBox();
            vh.awt.showInput("Distance (m) - negative to narrow", input, function (evt) {
                if (input.value)
                    that._editor.bufferSelectedFeatures(input.value);
            })
        },
        cmdEditUndo_onClick: function () {
            that._editor.undoEdit();
        },
        cmdEditRedo_onClick: function () {
            that._editor.redoEdit();
        },
        gridLayerControl_onApplyCellEdit: function (inValue, inRowIndex, inFieldIndex) {
            switch (inFieldIndex) {
                case "edit":
                    that._conf.controlLayer.setEdit(inRowIndex);
                    that.gridLayerControl.render();
                    if (that._conf._curTool.dojoAttachPoint == "toolEditPen")
                        that._conf.draw.activate(that._editor.getDrawGeometryType());
                    else if (that._conf._curTool.dojoAttachPoint == "toolEditAutoPolygon")
                        that._conf.draw.activate(esri.toolbars.Draw.POLYLINE);
                    break;
                case "visible":
                    that._editor.updateVisibleLayer(inRowIndex);
                    break;
            }
        },
        winEditProperty_onCancel: function () {
            var features = this._editor.getSelectedFeatures();
            var feats = [];
            for (var i = 0; i < features.length; i++) {
                if (features[i].attributes.__isDirty)
                    feats.push(features[i]);
            }
            if (feats.length > 0)
                this._editor.updateAttribute(feats);
            this._conf.map.graphics.clear();
        },
        winEditAttribute_onCancel: function () {
            var feats = [];
            for (var i = 0; i < this.gridEditAttribute.features.length; i++) {
                if (this.gridEditAttribute.features[i].attributes.__isDirty)
                    feats.push(this.gridEditAttribute.features[i]);
            }
            if (feats.length > 0)
                this._editor.updateAttribute(feats);
            this._conf.map.graphics.clear();
        },
        gridEditAttribute_onSelectionChanged: function (evt) {
            var feat = this.gridEditAttribute.features[this.gridEditAttribute.selection.selectedIndex];
            this._conf.map.graphics.clear();
            var g = new esri.Graphic(feat.geometry, vh.awt.SYMB_HIGHLIGHT[feat.geometry.type]);
            this._conf.map.graphics.add(g);
        },
        itmEditSelectType_onChange: function () {
            if (this.itmSelectTop.checked)
                this._paramsIdentify.layerOption = "top";
            else if (this.itmSelectVisible.checked)
                this._paramsIdentify.layerOption = "visible";
            else
                this._paramsIdentify.layerOption = "all";
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
                case "toolEditSelect":
                    if (deactived) {
                        that._conf.draw.deactivate();
                    } else {
                        that._conf.map.setMapCursor("default");
                        that._conf.draw.activate(esri.toolbars.Draw.EXTENT);
                    }
                    break;
                case "toolEditPen":
                    if (deactived) {
                        that._conf.draw.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("crosshair");
                        if (that._conf.controlLayer.edit == undefined) {
                            that.cmdLayerControl_onClick();
                        } else {
                            that._conf.draw.activate(that._editor.getDrawGeometryType());
                        }
                    }
                    break;
                case "toolEditAutoPolygon":
                    if (deactived) {
                        that._conf.draw.deactivate();
                        that._conf.map.setMapCursor("default");
                    } else {
                        that._conf.map.setMapCursor("crosshair");
                        if (that._conf.controlLayer.edit == undefined) {
                            that.cmdLayerControl_onClick();
                        } else {
                            that._conf.draw.activate(esri.toolbars.Draw.POLYLINE);
                        }
                    }
                    break;
                case "toolEditReshape":
                case "toolEditSplit":
                    if (deactived) {
                        that._conf.map.setMapCursor("default");
                        that._conf.draw.deactivate();
                    } else {
                        that._conf.map.setMapCursor("crosshair");
                        that._conf.draw.activate(esri.toolbars.Draw.POLYLINE);
                    }
                    break;
                default:
                    that._conf._navi.deactivate();
                    //that._conf.draw.deactivate();
            }
        },
        draw_onDrawEnd: function (evt) {
            switch (that._conf._curTool.dojoAttachPoint) {
                case "toolEditSelect":
                    if (that._editor.isEditing) {
                        that._editor.selectByGeometry(evt.geometry);
                    } else {
                        that._paramsIdentify.geometry = evt.geometry;
                        that._paramsIdentify.mapExtent = that._conf.map.extent;
                        that._paramsIdentify.layerIds = that._conf.controlLayer.getSelectConfig();
                        that._taskIdentify.execute(that._paramsIdentify, function (results) {
                            that._conf.graphicLayer.clear();
                            for (var i = 0; i < results.length; i++) {
                                var feat = results[i].feature;
                                feat.setSymbol(vh.awt.SYMB_SELECT[feat.geometry.type]);
                                feat.LID = results[i].layerId;
                                that._conf.graphicLayer.add(feat);
                            }
                        }, function (error) { vh.awt.showError(error) });
                    }
                    break;
                case "toolEditPen":
                    that._editor.drawFeature(evt.geometry);
                    break;
                case "toolEditAutoPolygon":
                    that._editor.autoPolygon(evt.geometry);
                    break;
                case "toolEditReshape":
                    that._editor.reshapeSelectedFeatures(evt.geometry);
                    break;
                case "toolEditSplit":
                    that._editor.splitSelectedFeatures(evt.geometry);
                    break;
            }
        },
        editor_onUseEdit: function (action) {
            switch (action) {
                case vh.awt.Editor.EDIT_BEGIN:
                    that.itmEditBegin.setDisabled(true);
                    that.itmEditBeginSession.setDisabled(true);
                    that.itmEditEnd.setDisabled(false);
                    that.itmEditSave.setDisabled(false);
                    that.cmdEditExtract.setDisabled(false);
                    that.cmdEditAttribute.setDisabled(false);
                    that.cmdLayerControl.setDisabled(false);

                    that._disableEditTools(false);
                    //UI._disableDrawTools(false);
                    //App.mnuSnap.setDisabled(false);
                    //UI._disableSnapTools(false);
                    break;
                case vh.awt.Editor.EDIT_END:
                    that.itmEditBegin.setDisabled(false);
                    that.itmEditBeginSession.setDisabled(false);
                    that.itmEditEnd.setDisabled(true);
                    that.itmEditSave.setDisabled(true);
                    that.cmdEditExtract.setDisabled(true);
                    that.cmdEditAttribute.setDisabled(true);
                    that.cmdLayerControl.setDisabled(true);
                    that._disableEditTools(true);
                    //UI._disableDrawTools(true);
                    //App.mnuSnap.setDisabled(true);
                    //UI._disableSnapTools(true);
                    break;
                case vh.awt.Editor.EDIT_SELECT:
                    that._disableModifyTools(false);
                    break;
                case vh.awt.Editor.EDIT_NOSELECT:
                    that._disableModifyTools(true);
                    break;
                case vh.awt.Editor.EDIT_DIRTY:
                    //App.itmEditSave.setDisabled(false);
                    that.cmdEditUndo.setDisabled(false);
                    break;
                case vh.awt.Editor.EDIT_CLEAN:
                    //App.itmEditSave.setDisabled(true);
                    that.cmdEditUndo.setDisabled(true);
                    break;
                case vh.awt.Editor.EDIT_DOUNDO:
                    //App.itmEditSave.setDisabled(false);
                    that.cmdEditRedo.setDisabled(false);
                    break;
                case vh.awt.Editor.EDIT_LASTUNDO:
                    //App.itmEditSave.setDisabled(true);
                    that.cmdEditUndo.setDisabled(true);
                    that.cmdEditRedo.setDisabled(false);
                    break;
                case vh.awt.Editor.EDIT_LASTREDO:
                    //App.itmEditSave.setDisabled(false);
                    that.cmdEditUndo.setDisabled(false);
                    that.cmdEditRedo.setDisabled(true);
                    break;
            }
        },
        _disableModifyTools: function (isDisabled) {
            this.cmdEditActiveMRS.setDisabled(isDisabled);
            this.cmdEditActiveVertices.setDisabled(isDisabled);
            this.cmdEditDuplicate.setDisabled(isDisabled);
            this.cmdEditDelete.setDisabled(isDisabled);

            this.cmdEditBuffer.setDisabled(isDisabled);
            this.toolEditReshape.setDisabled(isDisabled);
            this.toolEditSplit.setDisabled(isDisabled);
            this.cmdEditMerge.setDisabled(isDisabled);
        },

        _disableEditTools: function (isDisabled) {
            this.toolEditPen.setDisabled(isDisabled);
            this.toolEditAutoPolygon.setDisabled(isDisabled);
        },

        _disableSnapTools: function (isDisabled) {
            this.toolSnapPoint.setDisabled(isDisabled);
            this.toolSnapVertex.setDisabled(isDisabled);
            this.toolSnapEdge.setDisabled(isDisabled);
        }
    })
})