var Toolbar  = require('../../UI/Toolbar/Toolbar'),
    click    = require('onclick'),
    code     = require('../code'),
    terminal = require('../../Run/terminal');

require('./Toolbar.less');

module.exports = Toolbar.extend('Editor-Toolbar', {
    init: function() {
        var self = this;

        click({
            '.Editor-Toolbar-run': function() {
                terminal.clear();

                setTimeout(function() {
                    self.trigger('run', function() {
                        code.run();
                    });
                }, 0);
            },
            '.Editor-Toolbar-open': function() {
                self.trigger('open');
            }
        });
        
        this.$name = this.$wrapper.find('.Editor-Toolbar-name');
    },
    template: require('./Toolbar.handlebars'),
    getName: function() {
        return this.$name.val();
    },
    setName: function(name) {
        this.$name.val(name || '');
        return this;
    },
    focusName: function() {
        this.$name
            .val('')
            .focus();
    }
});
