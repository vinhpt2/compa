if (!vh) var vh = {};
if (!vh.awt) vh.awt = {};

//Editor - Thư viện edit
vh.awt.Editor = (function () {
    //enum of edit-action
    var ACTION_INSERT = 1, ACTION_UPDATE = 2, ACTION_DELETE = 3, ACTION_NONE = 4;
    var that;

    //conf={ map, dynamicLayer, graphicLayer, graphicLayerDraw, graphicLayerSketch, geometryService, edit, draw}
    function Editor(conf) {
        that = this;
        this._conf = conf;

        this.layers = [];
        for (var i = 0; i < conf.dynamicLayer.layerInfos.length; i++) {
            var lid = conf.dynamicLayer.layerInfos[i].id;
            var url = conf.dynamicLayer.url.substring(0, conf.dynamicLayer.url.lastIndexOf("/MapServer"));

            this.layers[i] = new esri.layers.FeatureLayer(url + "/FeatureServer/" + lid, { id: "fl_dc_" + lid, mode: esri.layers.FeatureLayer.MODE_SNAPSHOT, outFields: ["*"] });
            this.layers[i].on("click", this._layer_onClick);
            this.layers[i].on("dbl-click", this._layer_onDblClick);
        }

        this.query = new esri.tasks.Query();
        this.query.units = "inches";
        this.queryTemp = new esri.tasks.Query();

        conf.edit.on("graphic-move-start", this._editor_onMoveRotateScaleStart);
        conf.edit.on("graphic-move-stop", this._editor_onMoveRotateScaleStop);
        conf.edit.on("rotate-start", this._editor_onMoveRotateScaleStart);
        conf.edit.on("rotate-stop", this._editor_onMoveRotateScaleStop);
        conf.edit.on("scale-start", this._editor_onMoveRotateScaleStart);
        conf.edit.on("scale-stop", this._editor_onMoveRotateScaleStop);
        conf.edit.on("vertex-move-start", this._editor_onVertexMoveStart);
        conf.edit.on("vertex-move-stop", this._editor_onVertexMoveStop);

        this.editHelper = new vh.awt.EditHelper(conf.edit);
        this.editHelper.eventEditGeometry = function (graphic) {
            that.undos.push({ features: [graphic], geometries: [graphic.cloneGeometry], action: ACTION_UPDATE });
            that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
        };
        this.drawHelper = new vh.awt.DrawHelper(conf);

        this.undos = [];
        this.redos = [];
        this.newOid = -1;
        this.isEditing = false;
        this.isShowDelete = false;
    }

    Editor.prototype.eventUseEdit = function (action) { /*event handler*/ };

    Editor.prototype.startupTemplatePicker = function (div) {
        if (!this.templatePicker) {
            this.templatePicker = new esri.dijit.editing.TemplatePicker({ featureLayers: this.layers }, div);
            this.templatePicker.startup();
            this.templatePicker.on("selection-change", function (evt) {
                that.editTemplate = this.getSelected();
                if (that.editTemplate.featureLayer.layerId != that._conf.controlLayer.edit) {
                    that._conf.controlLayer.setEdit(that.editTemplate.featureLayer.layerId);
                    if (that._conf._curTool.dojoAttachPoint == "toolEditPen")
                        that._conf.draw.activate(that.getDrawGeometryType());
                    else if (that._conf._curTool.dojoAttachPoint == "toolEditAutoPolygon")
                        that._conf.draw.activate(esri.toolbars.Draw.POLYLINE);
                }
            })
        } else {
            this.templatePicker.update();
        }

    }

    Editor.prototype.startupAttributeInspector = function (div) {
        if (!this.attributeInspector) {
            var layerInfos = [];
            for (i = 0; i < this.layers.length; i++)
                layerInfos[i] = { featureLayer: this.layers[i], showAttachments: true, isEditable: true };
            this.attributeInspector = new esri.dijit.AttributeInspector({ layerInfos: layerInfos }, div);
            this.attributeInspector.startup();
            this.attributeInspector.on("attribute-change", function (evt) {
                evt.feature.attributes[evt.fieldName] = evt.fieldValue;
                evt.feature.attributes.__isDirty = true;
            });
            this.attributeInspector.on("delete", function (evt) {
                that.undos.push({ features: [evt.feature], action: ACTION_DELETE });
                that._deleteFeatures([evt.feature]);
                that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
            });
            this.attributeInspector.on("next", function (evt) {
                that._conf.map.graphics.clear();
                var g = new esri.Graphic(evt.feature.geometry, vh.awt.SYMB_HIGHLIGHT[evt.feature.geometry.type]);
                that._conf.map.graphics.add(g);
            });
        } else {
            this.attributeInspector.refresh();
        }
    }

    Editor.prototype.showPropertyAttachment = function (isShow) {
        for (var i = 0; i < this.attributeInspector.layerInfos.length; i++)
            this.attributeInspector.layerInfos[0].showAttachments = isShow;
        this.attributeInspector.refresh();
    },
    Editor.prototype.begin = function (session) {
        if (!session) {
            var oids = [];
            for (var i = 0; i < this._conf.graphicLayer.graphics.length; i++) {
                var feat = this._conf.graphicLayer.graphics[i];

                if (oids[feat.LID])
                    oids[feat.LID] += "," + feat.attributes[this.layers[feat.LID].objectIdField];
                else
                    oids[feat.LID] = feat.attributes[this.layers[feat.LID].objectIdField];
            }
        }

        for (var i = 0; i < this.layers.length; i++) {
            var layer = this.layers[i];

            layer.setDefinitionExpression(layer.objectIdField + " IN (" + oids[i] + ")");

            layer.setVisibility(this._conf.controlLayer.infos[i].visible);
            layer.setSelectionSymbol(vh.awt.SYMB_EDITSELECT[layer.geometryType]);
            this._conf.map.addLayer(layer);
        }

        this._conf.graphicLayer.clear();
        this._conf.controlLayer.layers = this.layers;
        this.eventUseEdit(vh.awt.Editor.EDIT_BEGIN);
        this.isEditing = true;
    }

    Editor.prototype.end = function () {
        for (var i = 0; i < this.layers.length; i++) {
            this._conf.map.removeLayer(this.layers[i]);
        }
        this._conf.edit.deactivate()
        this.eventUseEdit(vh.awt.Editor.EDIT_END);
        this.isEditing = false;
    }

    Editor.prototype._errorHandler = function (error) {
        vh.awt.showError(error);
    }

    Editor.prototype._historyFeatures = function (history) {
        var oldGeometries = [];
        for (var i = 0; i < history.features.length; i++) {
            oldGeometries[i] = history.features[i].geometry;
            history.features[i].setGeometry(history.geometries[i]);
        }
        history.geometries = oldGeometries;
    }

    Editor.prototype.updateVisibleLayer = function (id) {
        this.layers[id].setVisibility(this._conf.controlLayer.infos[id].visible);
    }

    Editor.prototype.selectByGeometry = function (geometry) {
        this.query.distance = (geometry.type == "point") ? (vh.awt.IDENTIFY_TOLERANCE / 960) * that._conf.map.getScale() : 0;
        this.query.geometry = geometry;
        that.eventUseEdit(vh.awt.Editor.EDIT_NOSELECT);
        for (var i = 0; i < this.layers.length; i++) {
            var layer = this.layers[i];
            if (layer.graphics.length > 0 && this._conf.controlLayer.infos[i].select) {
                layer.selectFeatures(this.query, esri.layers.FeatureLayer.SELECTION_NEW, function (features, selectionMethod) {
                    that._conf.edit.deactivate();
                    if (features.length > 0)
                        that.eventUseEdit(vh.awt.Editor.EDIT_SELECT);
                }, this._errorHandler);
            }
        }
    }

    Editor.prototype.clearSelection = function () {
        for (var i = 0; i < this.layers.length; i++) {
            if (this._conf.controlLayer.infos[i].select) {
                this.layers[i].clearSelection();
            }
        }
    }

    Editor.prototype._selectFeatures = function (features) {
        for (var i = 0; i < this.layers.length; i++)
            this.layers[i].clearSelection();

        for (var i = 0; i < features.length; i++) {
            var feat = features[i];
            feat._layer._selectFeatureIIf(feat.attributes[feat._layer.objectIdField], feat, feat._layer._mode);
        }

        if (features.length > 0) {
            that.eventUseEdit(vh.awt.Editor.EDIT_SELECT);
        } else {
            that.eventUseEdit(vh.awt.Editor.EDIT_NOSELECT);
        }
    }

    Editor.prototype.deactive = function () {
        this._conf.edit.deactivate();
    }

    Editor.prototype.getSelectedFeatures = function () {
        var seletedFeatures;
        for (var i = 0; i < this.layers.length; i++) {
            if (this._conf.controlLayer.infos[i].select) {
                if (!seletedFeatures)
                    seletedFeatures = this.layers[i].getSelectedFeatures();
                else
                    seletedFeatures = seletedFeatures.concat(this.layers[i].getSelectedFeatures());
            }
        }
        return seletedFeatures;
    }

    Editor.prototype.getDrawGeometryType = function () {
        var geometryType;
        switch (this.layers[this._conf.controlLayer.edit].geometryType) {
            case "esriGeometryPoint":
                geometryType = esri.toolbars.Draw.POINT;
                break;
            case "esriGeometryPolyline":
                geometryType = esri.toolbars.Draw.POLYLINE;
                break;
            case "esriGeometryPolygon":
                geometryType = esri.toolbars.Draw.POLYGON;
                break;
        }
        return geometryType;
    }

    Editor.prototype._layer_onClick = function (evt) {
        if (that._conf._curTool.dojoAttachPoint == "toolEditSelect") {
            var feat = evt.graphic;
            if (that._conf.controlLayer.infos[feat._layer.layerId].select) {
                dojo.stopEvent(evt);
                if (feat.symbol) {//is feature selected
                    that._conf.edit.activate(esri.toolbars.Edit.MOVE | esri.toolbars.Edit.ROTATE | esri.toolbars.Edit.SCALE, feat);
                    that.eventUseEdit(vh.awt.Editor.EDIT_ACTIVEMRS);
                } else {
                    that._selectFeatures([feat]);
                }
            }
        }
    }

    Editor.prototype._layer_onDblClick = function (evt) {
        if (that._conf._curTool.dojoAttachPoint == "toolEditSelect") {
            var feat = evt.graphic;
            if (that._conf.controlLayer.infos[feat._layer.layerId].select) {
                dojo.stopEvent(evt);
                if (feat.geometry.type == "polygon" || feat.geometry.type == "polyline") {
                    that._conf.edit.activate(esri.toolbars.Edit.EDIT_VERTICES, feat);
                    that.eventUseEdit(vh.awt.Editor.EDIT_ACTIVEVERTICES);
                }
            }
        }
    }

    Editor.prototype._editor_onMoveRotateScaleStart = function (evt) {
        if (that._conf._curTool.dojoAttachPoint == "toolEditSelect") {
            evt.graphic.cloneGeometry = dojo.clone(evt.graphic.geometry);
        }
    }

    Editor.prototype._editor_onMoveRotateScaleStop = function (evt) {
        if (that._conf._curTool.dojoAttachPoint == "toolEditSelect" && (evt.info || (evt.transform && Object.keys(evt.transform).length > 0))) {
            that.undos.push({ features: [evt.graphic], geometries: [evt.graphic.cloneGeometry], action: ACTION_UPDATE });
            that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
            //UI.activeCurTool();
        }
    }

    Editor.prototype._editor_onVertexMoveStart = function (evt) {
        if (that._conf._curTool.dojoAttachPoint == "toolEditSelect" && evt.vertexinfo) {
            evt.graphic.cloneGeometry = dojo.clone(evt.graphic.geometry);
        }
    }

    Editor.prototype._editor_onVertexMoveStop = function (evt) {
        if (that._conf._curTool.dojoAttachPoint == "toolEditSelect" && (evt.vertexinfo || (evt.transform && Object.keys(evt.transform).length > 0))) {
            that.undos.push({ features: [evt.graphic], geometries: [evt.graphic.cloneGeometry], action: ACTION_UPDATE });
            that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
            //UI.activeCurTool();
        }
    }

    Editor.prototype._insertFeatures = function (features) {
        for (var i = 0; i < features.length; i++) {
            features[i]._layer._mode.drawFeature(features[i]);
            //features[i]._layer._add(features[i])
        }
    }

    Editor.prototype._deleteFeatures = function (features) {
        for (var i = 0; i < features.length; i++) {
            var feat = features[i];
            if (feat._count > 1)
                feat._layer._unSelectFeatureIIf(feat.attributes[feat._layer.objectIdField], feat._layer._mode);
            feat._count--;
            feat._layer._mode._removeFeatureIIf(feat.attributes[feat._layer.objectIdField]);
        }
    }

    Editor.prototype.drawFeature = function (geometry) {
        var layer = this.layers[this._conf.controlLayer.edit];
        var ptype = this.editTemplate.template.prototype;
        var newFeat = new esri.Graphic(geometry, undefined, dojo.clone(ptype.attributes), ptype.infoTemplate);
        newFeat.attributes[layer.objectIdField] = this.newOid--;
        this.undos.push({ features: [newFeat], action: ACTION_INSERT });
        layer._mode.drawFeature(newFeat);
        //this._insertFeatures([newFeat]);
        this._selectFeatures([newFeat]);
        this.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
    }

    Editor.prototype.autoPolygon = function (polyline) {
        this.query.geometry = polyline.getExtent();
        var layer = this.layers[this._conf.controlLayer.edit];
        layer.queryFeatures(this.query, function (result) {
            var polygons = [];
            for (var i = 0; i < result.features.length; i++)
                polygons[i] = result.features[i].geometry;

            if (polygons.length > 0)
                that._conf.geometryService.autoComplete(polygons, [polyline], function (polygons) {
                    if (polygons.length > 0) {
                        var ptype = that.editTemplate.template.prototype;
                        var newFeats = [];
                        for (var i = 0; i < polygons.length; i++) {
                            newFeats[i] = new esri.Graphic(polygons[i], undefined, dojo.clone(ptype.attributes), ptype.infoTemplate);
                            newFeats[i].attributes[layer.objectIdField] = that.newOid--;
                            layer._mode.drawFeature(newFeats[i]);
                        }

                        that.undos.push({ features: newFeats, action: ACTION_INSERT });
                        //that._insertFeatures(newFeats);
                        that._selectFeatures(newFeats);
                        that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
                    }
                }, that._errorHandler);

        }, this._errorHandler);
    }

    Editor.prototype.bufferSelectedFeatures = function (distance) {
        var features = this.getSelectedFeatures();
        var feats = [];
        var params = new esri.tasks.BufferParameters();
        params.distances = [];
        params.geometries = [];
        for (var i = 0; i < features.length; i++) {
            var feat = features[i];
            if (feat.geometry.type == "polygon") {
                feats.push(feat);
                params.distances.push(distance);
                params.geometries.push(feat.geometry);
            }
        }
        var geos = params.geometries;
        if (feats.length > 0) {
            this._conf.geometryService.buffer(params, function (geometries) {
                for (var i = 0; i < feats.length; i++) {
                    feats[i].setGeometry(geometries[i]);
                }
                that.undos.push({ features: feats, geometries: geos, action: ACTION_UPDATE });
                that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
            }, this._errorHandler);
        }
    }

    Editor.prototype.reshapeSelectedFeatures = function (polyline) {
        var feat = this.getSelectedFeatures()[0];
        if (feat) {
            var geo = feat.geometry;
            this._conf.geometryService.reshape(geo, polyline, function (geometry) {
                if (geometry.getPoint(0, 0)) {
                    feat.setGeometry(geometry);
                    that.undos.push({ features: [feat], geometries: [geo], action: ACTION_UPDATE });
                    that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
                }
            }, this._errorHandler);
        }
    }

    Editor.prototype.splitSelectedFeatures = function (polyline) {
        var feats = this.getSelectedFeatures();
        var geos = [];
        for (var i = 0; i < feats.length; i++) {
            geos[i] = feats[i].geometry;
        }

        if (geos.length > 0)
            this._conf.geometryService.cut(geos, polyline, function (results) {
                if (results.cutIndexes.length > 0) {
                    var newFeat, cutIndex, oldCutIndex = -1;
                    var modifyFeats = [], newFeats = [], m = 0, n = 0;
                    for (var i = 0; i < results.cutIndexes.length; i++) {
                        cutIndex = results.cutIndexes[i];
                        feat = feats[cutIndex];
                        if (cutIndex != oldCutIndex) {
                            feat.setGeometry(results.geometries[i]);
                            modifyFeats[m++] = feat;
                            oldCutIndex = cutIndex;
                        } else {
                            newFeat = new esri.Graphic(results.geometries[i], undefined, dojo.clone(feat.attributes), feat.infoTemplate);
                            newFeat.attributes[feat._layer.objectIdField] = that.newOid--;
                            feat._layer._mode.drawFeature(newFeat);
                            newFeats[n++] = newFeat;
                        }
                    }

                    that.undos.push({ features: modifyFeats, geometries: geos, action: ACTION_UPDATE });
                    that.undos.push({ features: newFeats, action: ACTION_INSERT });
                    //that._insertFeatures(newFeats);
                    that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
                }
            }, this._errorHandler);
    }

    Editor.prototype.unionSelectedFeatures = function () {
        for (var i = 0; i < this.layers.length; i++) {
            var feats = this.layers[i].getSelectedFeatures();
            var geos = [];
            for (var j = 0; j < feats.length; j++) {
                geos[j] = feats[j].geometry;
            }
            if (geos.length > 1) {
                this._conf.geometryService.union(geos, function (geometry) {
                    //update first feat
                    var feat = feats[0];
                    var geo = feat.geometry;
                    feat.setGeometry(geometry);

                    //delete other feat
                    feats.splice(0, 1);
                    that.undos.push({ features: feats, action: ACTION_DELETE });
                    that.undos.push({ features: [feat], geometries: [geo], action: ACTION_UPDATE });
                    that._deleteFeatures(feats);
                    that.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
                }, this._errorHandler);
                break;
            }
        }
    }

    Editor.prototype.duplicateSelectedFeatures = function () {
        var selectedFeatures = this.getSelectedFeatures();
        if (selectedFeatures.length > 0) {
            var newFeats = [];
            for (var i = 0; i < selectedFeatures.length; i++) {
                var feat = selectedFeatures[i];
                newFeats[i] = new esri.Graphic(dojo.clone(feat.geometry), undefined, dojo.clone(feat.attributes), feat.infoTemplate);
                newFeats[i].attributes[feat._layer.objectIdField] = this.newOid--;
                feat._layer._mode.drawFeature(newFeats[i]); //insert feature
            }
            this.undos.push({ features: newFeats, action: ACTION_INSERT });
            //this._insertFeatures(newFeats);
            this._selectFeatures(newFeats);

            for (var i = 0; i < newFeats.length; i++) {
                newFeats[i].getDojoShape().moveToFront();
            }

            this._conf.edit.activate(esri.toolbars.Edit.MOVE | esri.toolbars.Edit.ROTATE | esri.toolbars.Edit.SCALE, newFeats[0]);
            this.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
        }
    }

    Editor.prototype.removeSelectedFeatures = function () {
        var selectedFeatures = this.getSelectedFeatures();
        if (selectedFeatures.length > 0) {
            this.undos.push({ features: selectedFeatures, action: ACTION_DELETE });
            this._deleteFeatures(selectedFeatures);
            this.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
        }
    }

    Editor.prototype.activeEditMRS = function () {
        var selectedFeatures = this.getSelectedFeatures();
        if (selectedFeatures.length > 0) {
            //UI.deactiveCurTool();
            this._conf.edit.activate(esri.toolbars.Edit.MOVE | esri.toolbars.Edit.ROTATE | esri.toolbars.Edit.SCALE, selectedFeatures[0]);
            this.eventUseEdit(vh.awt.Editor.EDIT_ACTIVEMRS);
        }
    }

    Editor.prototype.activeEditVertices = function () {
        var selectedFeatures = this.getSelectedFeatures();
        if (selectedFeatures.length > 0) {
            //UI.deactiveCurTool();
            this._conf.edit.activate(esri.toolbars.Edit.EDIT_VERTICES, selectedFeatures[0]);
            this.eventUseEdit(vh.awt.Editor.EDIT_ACTIVEVERTICES);
        }
    }

    Editor.prototype.undoEdit = function () {
        if (this.undos.length > 0) {
            var undo = this.undos[this.undos.length - 1];

            if (undo.action == ACTION_INSERT)
                this._deleteFeatures(undo.features);
            else if (undo.action == ACTION_DELETE)
                this._insertFeatures(undo.features);
            else if (undo.action == ACTION_UPDATE)
                this._historyFeatures(undo);

            this.redos.push(undo);
            this.undos.pop();

            if (this.undos.length > 0)
                this.eventUseEdit(vh.awt.Editor.EDIT_DOUNDO);
            else
                this.eventUseEdit(vh.awt.Editor.EDIT_LASTUNDO);

        }
    }

    Editor.prototype.redoEdit = function () {
        if (this.redos.length > 0) {
            var redo = this.redos[this.redos.length - 1];

            if (redo.action == ACTION_INSERT)
                this._insertFeatures(redo.features);
            else if (redo.action == ACTION_DELETE)
                this._deleteFeatures(redo.features);
            else if (redo.action == ACTION_UPDATE)
                this._historyFeatures(redo);

            this.undos.push(redo);
            this.redos.pop();
            if (this.redos.length > 0)
                this.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
            else
                this.eventUseEdit(vh.awt.Editor.EDIT_LASTREDO);
        }
    }

    Editor.prototype.updateAttribute = function (features) {
        this.undos.push({ features: features, action: ACTION_UPDATE });
        this.eventUseEdit(vh.awt.Editor.EDIT_DIRTY);
    }

    Editor.prototype.isDirty = function () {
        return (this.undos.length > 0);
    }

    Editor.prototype.extract = function (graphics) {
        var lid, feat, feats = [];
        for (var i = 0; i < graphics.length; i++) {
            feat = graphics[i];
            lid = feat.LID;
            feat = new esri.Graphic(dojo.clone(feat.geometry), undefined, dojo.clone(feat.attributes), feat.infoTemplate);
            feat.LID = lid;
            feat._layer = this.layers[lid];
            feats.push(feat);
        }
        this._insertFeatures(feats);
    }

    Editor.prototype.applyEdits = function () {
        if (this.undos.length > 0) {
            var inserts = [], updates = [], deletes = [];
            var inserted = [], updated = [], deleted = [];
            var features = [];
            for (var i = 0; i < this.layers.length; i++) {
                inserts[i] = [];
                updates[i] = [];
                deletes[i] = [];
                inserted[i] = {};
                updated[i] = {};
                deleted[i] = {};
                features[i] = {}
            }

            var feat, action, oid, id;
            for (var i = 0; i < this.undos.length; i++) {
                action = this.undos[i].action;
                for (var j = 0; j < this.undos[i].features.length; j++) {
                    feat = this.undos[i].features[j];
                    oid = feat.attributes[feat._layer.objectIdField];
                    id = feat._layer.layerId;
                    if (!features[id][oid])
                        features[id][oid] = feat;
                    if (action == ACTION_INSERT)
                        inserted[id][oid] = true;
                    else if (action == ACTION_UPDATE)
                        updated[id][oid] = true;
                    else if (action == ACTION_DELETE)
                        deleted[id][oid] = true;
                }
            }

            for (id = 0; id < features.length; id++) {
                for (var oid in features[id]) {
                    if (features[id].hasOwnProperty(oid)) {
                        feat = features[id][oid];
                        if (inserted[id][oid] && !deleted[id][oid]) {
                            feat.attributes.ACT = ACTION_INSERT;
                            inserts[id].push(feat);
                        } else if (deleted[id][oid] && !inserted[id][oid]) {
                            feat.attributes.ACT = ACTION_DELETE;
                            deletes[id].push(feat);
                        } else if (updated[id][oid] && !inserted[id][oid] && !deleted[id][oid]) {
                            if (feat.attributes.ACT != ACTION_INSERT && feat.attributes.ACT != ACTION_DELETE)
                                feat.attributes.ACT = ACTION_UPDATE;
                            updates[id].push(feat);
                        }
                    }
                }
            }

            for (id = 0; id < this.layers.length; id++) {
                if (inserts[id].length > 0 || updates[id].length > 0 || deletes[id].length > 0) {
                    this.layers[id].applyEdits(inserts[id], updates[id], deletes[id], this._onEditsComplete, this._errorHandler);
                }
            }

            that.redos = [];
            that.undos = [];
            this.eventUseEdit(vh.awt.Editor.EDIT_CLEAN);
        }
    }

    Editor.prototype._onEditsComplete = function (adds, updates, deletes) {
        that._conf.dynamicLayer.refresh();
        vh.awt.showNotify("Save edits done - Added: " + adds.length + ", Modified: " + updates.length + ", Deleted: " + deletes.length);
    }

    //end of contructor
    return Editor;
} ());

//enum of edit-status
vh.awt.Editor.EDIT_BEGIN = 1; vh.awt.Editor.EDIT_SELECT = 2; vh.awt.Editor.EDIT_ACTIVEMRS = 3; vh.awt.Editor.EDIT_ACTIVEVERTICES = 4; vh.awt.Editor.EDIT_NOSELECT = 5; vh.awt.Editor.EDIT_DIRTY = 6; vh.awt.Editor.EDIT_CLEAN = 7; vh.awt.Editor.EDIT_DOUNDO = 8; vh.awt.Editor.EDIT_END = 9; vh.awt.Editor.EDIT_LASTUNDO = 10; vh.awt.Editor.EDIT_LASTREDO = 11;
