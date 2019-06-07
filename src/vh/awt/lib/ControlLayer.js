if (!vh) var vh = {};
if (!vh.awt) vh.awt = {};

//ControlLayer - Cấu hình layers khi edit
vh.awt.ControlLayer = (function () {
    var that;

    function ControlLayer(layerInfos) {
        that = this;

        this.infos = dojo.clone(layerInfos);
        for (var i = 0; i < layerInfos.length; i++) {
            this.infos[i].edit = false;
            this.infos[i].visible = layerInfos[i].defaultVisibility;
            this.infos[i].select = layerInfos[i].defaultVisibility;
            this.infos[i]._snap = layerInfos[i].defaultVisibility;
        }
    }

    ControlLayer.prototype.getVisibleConfig = function () {
        var config = [];
        for (var i = 0; i < this.infos.length; i++)
            if (this.infos[i].visible) config.push(i);
        return config;
    }

    ControlLayer.prototype.getSelectConfig = function () {
        var config = [];
        for (var i = 0; i < this.infos.length; i++)
            if (this.infos[i].select) config.push(i);
        return config;
    }

    ControlLayer.prototype.getSnapConfig = function () {
        var config = [];
        for (var i = 0; i < this.infos.length; i++)
            if (this.infos[i]._snap) config.push(i);
        return config;
    }
    ControlLayer.prototype.setEdit = function (index) {
        this.edit = index;
        for (var i = 0; i < this.infos.length; i++)
            this.infos[i].edit = (i == index);
    }

    //end of contructor
    return ControlLayer;
} ());