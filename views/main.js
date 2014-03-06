var subview  = require('subview'),
    editor   = require('Editor/Editor').spawn(),
    tray     = require('Tray/Tray').spawn(),
    console  = require('./console');

require('./main.less');

module.exports = subview('main', {
    init: function() {
        this.$wrapper
            .append(editor.$wrapper, tray.$wrapper, console.$wrapper);
    },
    template: require('main.hb')
});
