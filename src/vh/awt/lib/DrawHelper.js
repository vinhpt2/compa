if (!vh) var vh = {};
if (!vh.awt) vh.awt = {};

//DrawHelper - Công cụ trợ giúp khi draw
vh.awt.DrawHelper = (function () {
    var that;

    //conf={map, draw, graphicLayerSketch}
    function DrawHelper(conf) {
        that = this;
        this._conf = conf;
		
        this.layer = conf.graphicLayerSketch;
		this._graphicLayerTemp = conf.map.graphics;

        this.curX = undefined;
        this.curY = undefined;
        this.intersects = undefined;
        this.event = undefined;

        //init context menu
        this.popupSketch = new dijit.Menu();
        this.popupSketch.addChild(new dijit.MenuItem({ iconClass: "close-png", label: "Close" }));
        this.popupSketch.addChild(new dijit.MenuSeparator());
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Finish", onClick: this.finish }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Undo", onClick: this.undo }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Cancel", onClick: this.cancel }));
        this.popupSketch.addChild(new dijit.MenuSeparator());
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Length", onClick: this.length }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Angle", onClick: this.angle }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Parallel", onClick: this.parallel }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Perpendicular", onClick: this.perpendicular }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "Extend", onClick: this.extend }));
        this.popupSketch.addChild(new dijit.MenuItem({ label: "At X,Y", onClick: this.xy }));
        this.popupSketch.addChild(new dijit.MenuSeparator());
		var mnuMore=new dijit.Menu();
        mnuMore.addChild(new dijit.MenuItem({ label: "Distance Parallel", onClick: function () { alert("NOT IMPLEMENT!") } }));
        mnuMore.addChild(new dijit.MenuItem({ label: "Divide Point", onClick: function () { alert("NOT IMPLEMENT!") } }));
        mnuMore.addChild(new dijit.MenuItem({ label: "Divide Line", onClick: function () { alert("NOT IMPLEMENT!") } }));
        mnuMore.addChild(new dijit.MenuItem({ label: "dX, dY", onClick: function () { alert("NOT IMPLEMENT!") } }));
        this.popupSketch.addChild(new dijit.PopupMenuItem({label:"More...", popup:mnuMore}));
		this.popupSketch.startup();

        this._conf.map.on("mouse-up", function (evt) {
            if (evt.button == 2 && that._conf.draw._graphic) {
				that.event = evt;
				dijit.popup.open({ popup: that.popupSketch, x: evt.clientX, y: evt.clientY, onExecute: function () { dijit.popup.close(that.popupSketch) } });
            }
        });

        this._conf.map.on("click", this.onClick);
        this._conf.map.on("mouse-move", this.onMouseMove);
    }

    DrawHelper.prototype.insertDrawPoint = function (p) {
        if (this._conf.draw._graphic) {
            this._conf.draw._points.push(p);
            var geometry = this._conf.draw._graphic.geometry;
            var index = (geometry.paths) ? geometry.paths[0].length : geometry.rings[0].length;
            geometry.insertPoint(0, index, p);
            this._graphicLayerTemp._draw(this._conf.draw._graphic, true);
        } else {
            this._conf.draw._onClickHandler({ mapPoint: p });
        }
    }

    DrawHelper.prototype.lineCircleIntersect = function (x1, y1, x2, y2, x, y, r) {//mathworld.wolfram.com/Circle-LineIntersection.html
        var dx = x2 - x1;
        var dy = y2 - y1;
        var dr = dx * dx + dy * dy;
        var D = (x1 - x) * (y2 - y) - (x2 - x) * (y1 - y);
        var delta = r * r * dr - D * D;
        if (delta == 0) {
            return [[D * dy / dr, -D * dx / dr]];
        } else if (delta > 0) {
            delta = Math.sqrt(delta);
            var sdy = (dy < 0) ? -1 : 1;
            return [[(D * dy + sdy * dx * delta) / dr + x, (-D * dx + Math.abs(dy) * delta) / dr + y], [(D * dy - sdy * dx * delta) / dr + x, (-D * dx - Math.abs(dy) * delta) / dr + y]];
        } else {
            return [];
        }
    }

    DrawHelper.prototype.createCircle = function (p, r) {
        var xy = [];
        var delta = Math.PI / 90;
        for (var i = 0; i <= 180; i++) {
            xy.push([r * Math.sin(i * delta) + p.x, r * Math.cos(i * delta) + p.y]);
        }

        var circle = new esri.geometry.Polyline(p.spatialReference);
        circle.addPath(xy);
        return circle;
    }

    DrawHelper.prototype.createLine = function (p, t) {
        var p0, p1, extent = this._conf.map.extent;
        var g = (extent.xmin - p.x) * t + p.y;
        if (g >= extent.ymin && g <= extent.ymax) {
            p0 = new esri.geometry.Point(extent.xmin, g, p.spatialReference);
        }
        g = (extent.xmax - p.x) * t + p.y;
        if (g >= extent.ymin && g <= extent.ymax) {
            if (p0)
                p1 = new esri.geometry.Point(extent.xmax, g, p.spatialReference);
            else
                p0 = new esri.geometry.Point(extent.xmax, g, p.spatialReference);
        }
        g = (extent.ymin - p.y) / t + p.x;
        if (g >= extent.xmin && g <= extent.xmax) {
            if (p0)
                p1 = new esri.geometry.Point(g, extent.ymin, p.spatialReference);
            else
                p0 = new esri.geometry.Point(g, extent.ymin, p.spatialReference);
        }
        g = (extent.ymax - p.y) / t + p.x;
        if (g >= extent.xmin && g <= extent.xmax) {
            if (p0)
                p1 = new esri.geometry.Point(g, extent.ymax, p.spatialReference);
            else
                p0 = new esri.geometry.Point(g, extent.ymax, p.spatialReference);
        }

        var line = new esri.geometry.Polyline(p.spatialReference);
        line.addPath([p0, p1]);
        return line;
    }

    DrawHelper.prototype.cancel = function () {
        dojo.disconnect(that._conf.draw._onMouseMoveHandler_connect);
        that._conf.draw._clear();
        that.layer.clear();
        that.intersects = undefined;
    }

    DrawHelper.prototype.finish = function () {
        that._conf.draw.finishDrawing();
        that.layer.clear();
        that.intersects = undefined;
    }

    DrawHelper.prototype.undo = function () {
        if (that._conf.draw._graphic) {
            var geometry = that._conf.draw._graphic.geometry;
            var index = (geometry.paths) ? geometry.paths[0].length - 1 : geometry.rings[0].length - 1;
            if (index > 0) {
                geometry.removePoint(0, index);
                that._graphicLayerTemp._draw(that._conf.draw._graphic, true);
                that._conf.draw._points.splice(index, 1);
                var tGeometry = that._conf.draw._tGraphic.geometry;
                tGeometry.setPoint(0, 0, geometry.getPoint(0, index - 1));
                that._graphicLayerTemp._draw(that._conf.draw._tGraphic, true);
            }
            that.layer.clear();
            that.intersects = undefined;
        }
    }

    DrawHelper.prototype.length = function () {
        var d;
        if (that._conf.draw._tGraphic) {
            var ps = that._conf.draw._tGraphic.geometry.paths[0];
            d = Math.sqrt((ps[1][0] - ps[0][0]) * (ps[1][0] - ps[0][0]) + (ps[1][1] - ps[0][1]) * (ps[1][1] - ps[0][1]))
        } else {
            d = 0;
        }

        var input = new dijit.form.NumberTextBox({ value: d });
        vh.awt.showInput("Length (m) - of next edge", input, function (evt) {
            if (!isNaN(input.value)) {
                var center, r = Math.abs(input.value);
                if (that._conf._snap && that._conf._snap.P) {
                    center = that._conf._snap.P;
                } else {
                    center = (that._conf.draw._tGraphic) ? that._conf.draw._tGraphic.geometry.getPoint(0, 0) : that.event.mapPoint;
                }
                var circle = that.createCircle(center, r);
                var graphic = new esri.Graphic(circle, vh.awt.SYMB_HELPER.sketch);
                graphic.X = center.x;
                graphic.Y = center.y
                graphic.R = r;
                that.layer.add(graphic);
            }
        })
    }

    DrawHelper.prototype.extend = function () {
        var p1, p0, geometry;
        if (that._conf._snap && that._conf._snap.P1 && that._conf._snap.P2) {
            geometry = that.createLine(that._conf._snap.P1, (that._conf._snap.P2.y - that._conf._snap.P1.y) / (that._conf._snap.P2.x - that._conf._snap.P1.x));
        } else if (that._conf.draw._graphic) {
            var index = (that._conf.draw._graphic.geometry.paths) ? that._conf.draw._graphic.geometry.paths[0].length - 1 : that._conf.draw._graphic.geometry.rings[0].length - 1;
            p1 = that._conf.draw._graphic.geometry.getPoint(0, index);
            p0 = that._conf.draw._graphic.geometry.getPoint(0, index - 1);
            geometry = that.createLine(p0, (p1.y - p0.y) / (p1.x - p0.x));
        }
        if (geometry) {
            that.layer.add(new esri.Graphic(geometry, vh.awt.SYMB_HELPER.sketch));
        }
    }

    DrawHelper.prototype.angle = function (d) {
        if (that._conf.draw._graphic) {
            var geometry = that._conf.draw._graphic.geometry;
            var index = (geometry.paths) ? geometry.paths[0].length - 1 : geometry.rings[0].length - 1;
            var p1 = (that._conf._snap && that._conf._snap.P2) ? that._conf._snap.P2 : geometry.getPoint(0, index);
            var p0 = (that._conf._snap && that._conf._snap.P1) ? that._conf._snap.P1 : geometry.getPoint(0, index - 1);
            var ps = that._conf.draw._tGraphic.geometry.paths[0];
            var angle = (180 * (Math.atan2(ps[1][1] - ps[0][1], ps[1][0] - ps[0][0]) - Math.atan2(p1.y - p0.y, p1.x - p0.x)) / Math.PI);

            var input = new dijit.form.NumberTextBox({ value: angle });
            vh.awt.showInput("Angle (º) - negative to switch side", input, function (evt) {
                if (!isNaN(input.value)) {
                    var d = input.value;
                    var angle = d * Math.PI / 180 + Math.atan2(p1.y - p0.y, p1.x - p0.x);
                    geometry = that.createLine(geometry.getPoint(0, index), Math.tan(angle));
                    if (geometry)
                        that.layer.add(new esri.Graphic(geometry, vh.awt.SYMB_HELPER.sketch));
                }
            });
        }
    }

    DrawHelper.prototype.parallel = function () {
        if (that._conf.draw._graphic) {
            var geometry = that._conf.draw._graphic.geometry;
            var index = (geometry.paths) ? geometry.paths[0].length - 1 : geometry.rings[0].length - 1;
            var p1 = (that._conf._snap && that._conf._snap.P2) ? that._conf._snap.P2 : geometry.getPoint(0, index);
            var p0 = (that._conf._snap && that._conf._snap.P1) ? that._conf._snap.P1 : geometry.getPoint(0, index - 1);
            geometry = that.createLine(geometry.getPoint(0, index), (p1.y - p0.y) / (p1.x - p0.x));
            if (geometry)
                that.layer.add(new esri.Graphic(geometry, vh.awt.SYMB_HELPER.sketch));
        }
    }

    DrawHelper.prototype.perpendicular = function () {
        if (that._conf.draw._graphic) {
            var geometry = that._conf.draw._graphic.geometry;
            var index = (geometry.paths) ? geometry.paths[0].length - 1 : geometry.rings[0].length - 1;
            var p1 = (that._conf._snap && that._conf._snap.P2) ? that._conf._snap.P2 : geometry.getPoint(0, index);
            var p0 = (that._conf._snap && that._conf._snap.P1) ? that._conf._snap.P1 : geometry.getPoint(0, index - 1);
            geometry = that.createLine(geometry.getPoint(0, index), (p0.x - p1.x) / (p1.y - p0.y));
            if (geometry)
                that.layer.add(new esri.Graphic(geometry, vh.awt.SYMB_HELPER.sketch));
        }
    }
    DrawHelper.prototype.xy = function () {
		var input = new dijit.form.Textarea({ value: that.event.mapPoint.x.toFixed(2) + "," + that.event.mapPoint.y.toFixed(2) });
		vh.awt.showInput("X,Y - separate by , or tab", input, function (evt) {
            if (input.value) {
                var cells = input.value.split(",");
                if (cells.length == 1) cells = input.value.split("\t");

                if (cells.length == 2) {
                    x = parseFloat(cells[0]);
                    y = parseFloat(cells[1]);
                    if (isNaN(x) || isNaN(y))
                        vh.awt.showWarning("'" + input.value + "' are not X, Y number");
                    else
                        that.insertDrawPoint(new esri.geometry.Point(x, y, that._conf.map.spatialReference));
                } else {
                    vh.awt.showWarning("'" + input.value + "' have " + cells.length + " value(s)");
                }
            }
        }, that, false, );
    }

    DrawHelper.prototype.onMouseMove = function (evt) {
        that.event = evt;
        that.curX = undefined;
        that.curY = undefined;

        if (that.layer.graphics.length == 1) {
            var graphic = that.layer.graphics[0];
            if (graphic.R) {//là hình tròn
                var d = Math.sqrt((evt.mapPoint.x - graphic.X) * (evt.mapPoint.x - graphic.X) + (evt.mapPoint.y - graphic.Y) * (evt.mapPoint.y - graphic.Y));
                that.curX = (evt.mapPoint.x - graphic.X) * graphic.R / d + graphic.X;
                that.curY = (evt.mapPoint.y - graphic.Y) * graphic.R / d + graphic.Y;
            } else {
                var ps = graphic.geometry.paths[0];
                var t = (ps[1][1] - ps[0][1]) / (ps[1][0] - ps[0][0]);
                that.curX = (t * ps[0][0] + evt.mapPoint.x / t + evt.mapPoint.y - ps[0][1]) / (t + 1 / t);
                that.curY = (t * evt.mapPoint.y + ps[0][1] / t + evt.mapPoint.x - ps[0][0]) / (t + 1 / t);
            }
        } else if (that.layer.graphics.length == 2) {
            g1 = that.layer.graphics[0];
            g2 = that.layer.graphics[1];

            if (!that.intersects) {
                if (g1.R && g2.R) {// circle - circle
                } else if (!g1.R && !g2.R) {// line - line
                    var p = esri.geometry.getLineIntersection(g1.geometry.getPoint(0, 0), g1.geometry.getPoint(0, 1), g2.geometry.getPoint(0, 0), g2.geometry.getPoint(0, 1));
                    that.curX = p.x;
                    that.curY = p.y;
                } else {// line - circle
                    var l, g;
                    if (g2.R) {
                        l = g1.geometry.paths[0];
                        g = g2;
                    } else {
                        l = g2.geometry.paths[0];
                        g = g1;
                    }

                    that.intersects = that.lineCircleIntersect(l[0][0], l[0][1], l[1][0], l[1][1], g.X, g.Y, g.R);
                }
            }
            if (that.intersects.length == 1) {
                that.curX = that.intersects[0][0];
                that.curY = that.intersects[0][1];
            } else if (that.intersects.length == 2) {
                var d1 = (evt.mapPoint.x - that.intersects[0][0]) * (evt.mapPoint.x - that.intersects[0][0]) + (evt.mapPoint.y - that.intersects[0][1]) * (evt.mapPoint.y - that.intersects[0][1]);
                var d2 = (evt.mapPoint.x - that.intersects[1][0]) * (evt.mapPoint.x - that.intersects[1][0]) + (evt.mapPoint.y - that.intersects[1][1]) * (evt.mapPoint.y - that.intersects[1][1]);
                if (d1 < d2) {
                    that.curX = that.intersects[0][0];
                    that.curY = that.intersects[0][1];
                } else {
                    that.curX = that.intersects[1][0];
                    that.curY = that.intersects[1][1];
                }
            }
        }

        if (that.curX && that.curY)
            evt.mapPoint.update(that.curX, that.curY);
    }

    DrawHelper.prototype.onClick = function (evt) {
		if (that.layer.graphics.length == 1) {
            if (that._conf._snap && that._conf._snap.P1 && that._conf._snap.P2) {
                var graphic = that.layer.graphics[0];
                if (graphic.R) {//là hình tròn
                    var ps = that.lineCircleIntersect(that._conf._snap.P1.x, that._conf._snap.P1.y, that._conf._snap.P2.x, that._conf._snap.P2.y, graphic.X, graphic.Y, graphic.R);

                    if (ps.length == 1) {
                        that._conf._snap._snappingPoint = new esri.geometry.Point(ps[0][0], ps[0][1], that._map.spatialReference);
                    } else if (ps.length == 2) {
                        var d1 = (evt.mapPoint.x - ps[0][0]) * (evt.mapPoint.x - ps[0][0]) + (evt.mapPoint.y - ps[0][1]) * (evt.mapPoint.y - ps[0][1]);
                        var d2 = (evt.mapPoint.x - ps[1][0]) * (evt.mapPoint.x - ps[1][0]) + (evt.mapPoint.y - ps[1][1]) * (evt.mapPoint.y - ps[1][1]);
                        if (d1 < d2)
                            that._conf._snap._snappingPoint = new esri.geometry.Point(ps[0][0], ps[0][1], that._map.spatialReference);
                        else
                            that._conf._snap._snappingPoint = new esri.geometry.Point(ps[1][0], ps[1][1], that._map.spatialReference);
                    }

                } else {
                    that._conf._snap._snappingPoint = esri.geometry.getLineIntersection(that._conf._snap.P1, that._conf._snap.P2, graphic.geometry.getPoint(0, 0), graphic.geometry.getPoint(0, 1));
                }
            } else {
                if (that.curX && that.curY) evt.mapPoint.update(that.curX, that.curY);
            }
        } else if (that.layer.graphics.length == 2) {
            if (that.curX && that.curY) evt.mapPoint.update(that.curX, that.curY);
        }
        that.layer.clear();
        that.intersects = undefined;
    }

    //end of contructor
    return DrawHelper
} ());
