var subview = require('subview'),
    Button  = require('Button/Button'),
    buttons = require('../Commands/index.js');

require('./Tray.less');

module.exports = subview('Tray', {
    init: function() {
        var i = buttons.length;
        while(i--) {
            this.$wrapper.append(Button.spawn(buttons[i]).$wrapper);
        }
    }
});
