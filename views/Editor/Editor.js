var subview     = require('subview'),
    code        = require('./code'),
    toolbar     = require('./toolbar'),
    programs    = require('../../models/programs'),
    transitionComplete = require('transition-complete');

require('./Editor.less');

module.exports = subview('Editor', {
    listeners: {
        'all:open, all:save': function() {
            transitionComplete(function() {
                programs.set(toolbar.getName(), code.dump());

                toolbar.setName('');
                code.empty();
            });
        },
        'all:openFile': function(fileName) {
            transitionComplete(function() {
                toolbar.setName(fileName);
                
                programs.get(fileName, function(file) {
                    code.load(file);
                });
            });
        },
        'all:new': function() {
            code.empty();

            transitionComplete(function() {
                toolbar.focusName();
            });
        }
    },
    template: require('./Editor.handlebars'),
    subviews: {
        Toolbar:    toolbar,
        code:       code,
        Tray:       require('./Tray/Tray')
    }
});
