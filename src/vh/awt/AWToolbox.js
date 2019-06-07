define([
    "dojo/_base/declare",
    "dijit/_Widget",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "xstyle/css!./css/awx.css",
    "dojo/text!./AWToolbox.html",
    "dijit/Menu",
    "dijit/MenuItem",
    "dijit/Dialog",
    "dijit/form/ComboButton"
],
function (declare, _Widget, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, css, html) {
    var that = null;

    //AWToolbox - Hộp công cụ AWT
    return declare("vh.awt.AWToolbox", [_Widget, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: html,
        iconClass: "awtoolbox-png",
        title: "AWToolbox",

        //conf={ map, dynamicLayer, graphicLayer, graphicLayerDraw, graphicLayerSketch, geometryService, edit, draw}
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
        cmdToolbox_onClick: function () {
            this.winAbout.show();
        },
        loadAWWidget: function (widgetClass, visible) {
            var div = document.createElement("div");
            this.divToolbox.appendChild(div);
            var widget = new widgetClass(this._conf, div);
            widget.startup();
            widget.domNode.hidden = !visible;
            var itm = new dijit.MenuItem({
                iconClass: widget.iconClass,
                checked: visible,
                title: widget.title,
                onClick: function (value) {
                    widget.domNode.hidden = !widget.domNode.hidden;
                    this.checked = !this.checked;
                    if (this.checked)
                        this.domNode.style.backgroundColor = "gold";
                    else
                        this.domNode.style.backgroundColor = "";
                }
            });
            if (visible)
                itm.domNode.style.backgroundColor = "gold";
            this.tbrToolbox.addChild(itm);
        },
        displayToolbox: function (hidden) {
            if (hidden)
                this.winToolbox.hide();
            else
                this.winToolbox.show();
        }
    })
})