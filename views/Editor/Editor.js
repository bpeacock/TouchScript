var subview = require('subview'),
    code    = require('./code'),
    toolbar = require('./toolbar'),
    programs = require('../../models/programs');

require('./Editor.less');

module.exports = subview('Editor', {
    init: function() {
        this.listen('open, save', function() {
            programs.set(toolbar.getName(), code.dump());
        });

        this.listen('openFile', function(fileName) {
            toolbar.setName(fileName);
            code.load(programs.get(fileName));
        });

        this.listen('new', function() {
            code.empty();

            setTimeout(function() {
                toolbar.focusName();
            }, 300);
        });
    },
    template: require('./Editor.handlebars'),
    subviews: {
        Toolbar:    toolbar,
        code:       code,
        Tray:       require('./Tray/Tray')
    }
});
