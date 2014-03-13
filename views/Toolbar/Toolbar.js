var subview = require('subview'),
    click   = require('onclick'),
    editor  = require('../editor'),
    terminal = require('../terminal');

require('./Toolbar.less');

module.exports = subview("Toolbar", {
    init: function() {
        click({
            '.Toolbar-run': function() {
                terminal.clear();
                editor.run();
            }
        });
    },
    template: require('./Toolbar.handlebars')
});
