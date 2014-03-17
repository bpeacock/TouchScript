var subview     = require('subview'),
    cursor      = require('../cursor'),
    Line        = require('./Line'),
    Environment = require('./EnvironmentModel');

require('./Block.less');

module.exports = subview('Code-Block', {
    init: function() {
        var self = this;

        this.environment = new Environment();
        this.empty();

        this.listenDown('Code-Cursor:paste', function() {
            var last = subview(self.$wrapper.children().last());

            if(!last.isEmpty()) {
                self.addLine();
            }

            return false;
        });
    },
    empty: function() {
        this.html('');
        this.addLine();

        return this;
    },
    addLine: function(i) {
        var line = Line.spawn();
        this.$wrapper.append(line.$wrapper);
        return line;
    },
    focus: function() {
        subview(this.$wrapper.children().last()).focus();
        return this;
    },
    beforeRun: function() {},
    run: function() {
        this.beforeRun();

        //Run every line
        var children = this.$wrapper.children();
        for(var i=0; i<children.length; i++) {
            subview(children[i]).run();
        }

        return this;
    }
});
