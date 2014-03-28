var subview = require('subview'),
    code    = require('./code'),
    toolbar = require('./toolbar'),
    programs = require('../../models/programs');

require('./Editor.less');

module.exports = subview('Editor', {
    listeners: {
        'all:open, all:save': function() {
            console.log(code.dump());
            programs.set(toolbar.getName(), code.dump());
        },
        'all:openFile': function(fileName) {
            toolbar.setName(fileName);
            programs.get(fileName, function(file) {
                code.load(file);
            });
        },
        'all:new': function() {
            code.empty();

            setTimeout(function() {
                toolbar.focusName();
            }, 300);
        }
    },
    template: require('./Editor.handlebars'),
    subviews: {
        Toolbar:    toolbar,
        code:       code,
        Tray:       require('./Tray/Tray')
    }
});
