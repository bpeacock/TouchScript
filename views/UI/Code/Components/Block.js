var subview     = require('subview'),
    cursor      = require('../cursor'),
    Line        = require('./Line');

require('./Block.less');

module.exports = subview('Code-Block', {
    init: function() {
        var self = this;

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

        //Run every line asyncronously
        var children = this.$wrapper.children(),
            i   = 0,
            len = children.length;

        var loop = function() {
            subview(children[i]).run(function() {
                if(i < len) {
                    i++;
                    loop();
                }
            });
        };

        loop();

        return this;
    }
});
