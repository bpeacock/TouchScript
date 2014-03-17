var Tooltip = require('../../Tooltip/Tooltip'),
    subview = require('subview');

require("./error.less");

var Err = Tooltip.extend('Code-Error');

module.exports = function(msg) {
    this.parent('Code').onError();

    return Err.spawn({
        msg:  msg,
        $el:  this.$wrapper
    });
};
