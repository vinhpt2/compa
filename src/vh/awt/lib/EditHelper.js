if (!vh) var vh = {};
if (!vh.awt) vh.awt = {};

//EditHelper - Công cụ trợ giúp khi edit
vh.awt.EditHelper = (function () {
    var that;

    function EditHelper(edit) {
        that = this;
        this._edit = edit;
        this._graphicLayerTemp = edit.map.graphics;

        edit.on("vertex-click", this._helper_onVertexClick);
        edit.on("vertex-mouse-over", this._helper_onVertexMouseOver);
        edit.on("vertex-mouse-out", this._helper_onVertexMouseOut);
        this.info = {};

        //init context menu
        this.popupEdge = new dijit.Menu();
        this.popupEdge.addChild(new dijit.MenuItem({
            label: "Add vertex",
            onClick: function () {
                var input = new dijit.form.NumberTextBox({ value: that.edgeLength / 2 });
                vh.awt.showInput("Distance (m) - negative to switch base point", input, function (evt) {
                    if (!isNaN(input.value)) {
                        that._addVertex(input.value);
                    }
                })
            }
        }));
        this.popupEdge.addChild(new dijit.MenuItem({ label: "Add vertex at XY" }));
        this.popupEdge.addChild(new dijit.MenuItem({
            label: "Edge length",
            onClick: function () {
                var input = new dijit.form.NumberTextBox({ value: that.edgeLength / 2 });
                vh.awt.showInput("Length (m) - negative to switch base point", input, function (evt) {
                    if (!isNaN(input.value)) {
                        that._setEdgeLength(input.value)
                    }
                })
            }
        }));
        this.popupEdge.addChild(new dijit.MenuSeparator());
        this.popupEdge.addChild(new dijit.MenuItem({ iconClass: "close-png", label: "Close" }));
        this.popupEdge.startup();

        this.popupVertex = new dijit.Menu();
        this.popupVertex.addChild(new dijit.MenuItem({
            label: "Delete vertex",
            onClick: function () {
                that._deleteVertex();
            }
        }));
        this.popupVertex.addChild(new dijit.MenuItem({ label: "Move vertex to XY" }));
        this.popupVertex.addChild(new dijit.MenuItem({ label: "Shift vertex dXdY" }));
        this.popupVertex.addChild(new dijit.MenuSeparator());
        this.popupVertex.addChild(new dijit.MenuItem({ iconClass: "close-png", label: "Close" }));
        this.popupVertex.startup();

    }

    EditHelper.prototype.eventEditGeometry = function (graphic) { /*event handler*/ };

    EditHelper.prototype._errorHandler = function (error) {
        Ext.Msg.show({ title: "Lỗi hệ thống", msg: error, buttons: Ext.Msg.OK, icon: Ext.MessageBox.ERROR });
    }

    EditHelper.prototype._clearIndicator = function () {
        this._graphicLayerTemp.remove(this.info.indicator);
        if (this.info.direction)
            this._graphicLayerTemp.remove(this.info.direction);
    }

    EditHelper.prototype._addVertex = function (distance) {
        this.info.graphic.cloneGeometry = dojo.clone(this.info.graphic.geometry);

        var p0, p1;
        if (this.info.graphic.geometry.rings) {
            p0 = this.info.graphic.geometry.rings[this.info.segmentIndex][this.info.pointIndex - 1];
            p1 = this.info.graphic.geometry.rings[this.info.segmentIndex][this.info.pointIndex];
        } else {
            p0 = this.info.graphic.geometry.paths[this.info.segmentIndex][this.info.pointIndex - 1];
            p1 = this.info.graphic.geometry.paths[this.info.segmentIndex][this.info.pointIndex];
        }
        var d0 = Math.sqrt((p1[0] - p0[0]) * (p1[0] - p0[0]) + (p1[1] - p0[1]) * (p1[1] - p0[1]));
        var d = (distance < 0) ? d0 - distance : distance;

        var mover = this._edit._vertexEditor._mpVertexMovers[this.info.segmentIndex][this.info.pointIndex - 1];
        mover.graphic.geometry.x = (p1[0] - p0[0]) * d / d0 + p0[0];
        mover.graphic.geometry.y = (p1[1] - p0[1]) * d / d0 + p0[1];

        this._edit._vertexEditor._moveStopHandler(mover, { dx: 1, dy: 1 });
        this.eventEditGeometry(this.info.graphic);
    }

    EditHelper.prototype._setEdgeLength = function (length) {
        this.info.graphic.cloneGeometry = dojo.clone(this.info.graphic.geometry);

        var p0 = this.info.graphic.geometry.getPoint(this.info.segmentIndex, this.info.pointIndex - 1);
        var p1 = this.info.graphic.geometry.getPoint(this.info.segmentIndex, this.info.pointIndex);
        var dd = Math.abs(length) / Math.sqrt((p1.x - p0.x) * (p1.x - p0.x) + (p1.y - p0.y) * (p1.y - p0.y));

        var x, y, index;
        if (length < 0) {
            x = (p0.x - p1.x) * dd + p1.x;
            y = (p0.y - p1.y) * dd + p1.y;
            index = this.info.pointIndex - 1;
        } else {
            x = (p1.x - p0.x) * dd + p0.x;
            y = (p1.y - p0.y) * dd + p0.y;
            index = this.info.pointIndex;
        }
        var mover = this._edit._vertexEditor._vertexMovers[this.info.segmentIndex][index];
        mover.graphic.geometry.x = x;
        mover.graphic.geometry.y = y;

        this._edit._vertexEditor._moveStopHandler(mover, { dx: 1, dy: 1 });

        this._graphicLayerTemp._draw(mover.graphic, true);
        this.eventEditGeometry(this.info.graphic);
    }

    EditHelper.prototype._deleteVertex = function () {
        this.info.graphic.cloneGeometry = dojo.clone(this.info.graphic.geometry);

        this._edit._vertexEditor._selectedMover = this._edit._vertexEditor._vertexMovers[this.info.segmentIndex][this.info.pointIndex];
        this._edit._vertexEditor._deleteHandler();
        this.eventEditGeometry(this.info.graphic);
    }

    EditHelper.prototype._helper_onVertexMouseOver = function (evt) {
        var str;
        if (evt.vertexinfo.isGhost) {
            var p = that.info.relatedGraphic.geometry.getPoint(evt.vertexinfo.segmentIndex, evt.vertexinfo.pointIndex);
            var p0 = that.info.relatedGraphic.geometry.getPoint(evt.vertexinfo.segmentIndex, evt.vertexinfo.pointIndex - 1);
            var d = Math.sqrt((p.x - p0.x) * (p.x - p0.x) + (p.y - p0.y) * (p.y - p0.y));
            str = "Cạnh " + that.info.pointIndex + "-" + (that.info.pointIndex + 1) + ": L=" + d.toFixed(2) + " m";
        } else {
            str = "Đỉnh " + (that.info.pointIndex + 1) + ": X=" + that.info.graphic.geometry.x.toFixed(2) + ", Y=" + that.info.graphic.geometry.y.toFixed(2);
        }
        that._edit.map.container.title = str;
    }

    EditHelper.prototype._helper_onVertexMouseOut = function (evt) {
        that._edit.map.container.removeAttribute("title");
    }

    EditHelper.prototype._helper_onVertexClick = function (evt) {
        if (evt.vertexinfo) {
            if (window.event.button != 0) {
                dojo.stopEvent(window.event);
                var p = evt.graphic.geometry.getPoint(evt.vertexinfo.segmentIndex, evt.vertexinfo.pointIndex);
                that.popupVertex.helper = that;
                if (evt.vertexinfo.isGhost) {
                    var p0 = evt.graphic.geometry.getPoint(evt.vertexinfo.segmentIndex, evt.vertexinfo.pointIndex - 1);
                    var line = new esri.geometry.Polyline(that._edit.map.spatialReference);
                    line.addPath([p0, p]);
                    var g = new esri.Graphic(line, vh.awt.SYMB_HELPER.direction);
                    that.info.direction = g;
                    that._graphicLayerTemp.add(g);

                    that.edgeLength = Math.sqrt((p.x - p0.x) * (p.x - p0.x) + (p.y - p0.y) * (p.y - p0.y));
                    that.popupEdge.helper = that;
                    dijit.popup.open({ popup: that.popupEdge, x: window.event.clientX, y: window.event.clientY, onExecute: function () { dijit.popup.close(that.popupEdge) } });
                } else {
                    dijit.popup.open({ popup: that.popupVertex, x: window.event.clientX, y: window.event.clientY, onExecute: function () { dijit.popup.close(that.popupVertex) } });
                }

                var g = new esri.Graphic(p, vh.awt.SYMB_HELPER.indicator);
                that._graphicLayerTemp.add(g);
                //g.getDojoShape().moveToFront();
                that.info.indicator = g;
                that.info.segmentIndex = evt.vertexinfo.segmentIndex;
                that.info.pointIndex = evt.vertexinfo.pointIndex;
                that.info.graphic = evt.graphic;
            }
        }
    }

    //end of contructor
    return EditHelper;
} ());
