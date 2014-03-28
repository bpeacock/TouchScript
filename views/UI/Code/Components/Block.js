var subview     = require('subview'),
    cursor      = require('../cursor'),
    Line        = require('./Line');

require('./Block.less');

module.exports = subview('Code-Block', {
    listeners: {
        'down:paste:Code-Cursor': function() {
            var last = subview(this.$wrapper.children().last());

            if(!last.isEmpty()) {
                this.addLine();
            }

            return false;
        }
    },
    init: function() {
        this.empty();
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

        (function loop() {
            subview(children[i]).run(function() {
                if(i < len) {
                    i++;
                    loop();
                }
            });
        })();

        return this;
    },
    dump: function() {
        
    },
    load: function() {
        
    }
});
