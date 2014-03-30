var subview     = require('subview'),
    cursor      = require('../cursor'),
    Line        = require('./Line'),
    _           = require('underscore');

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
    addLine: function(content) {
        var line = Line.spawn();

        if(content) {
            line.load(content);
        }

        this.$wrapper.append(line.$wrapper);
        return line;
    },
    focus: function() {
        subview(this.$wrapper.children().last()).focus();
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
    },
    dump: function() {
        return {
            type:  this.type,
            lines: _.map(this.$wrapper.children('.subview-Code-Line'), function(child) {
                return subview(child).dump();
            })
        };
    },
    empty: function() {
        this.html('');
        this.addLine();
    },
    load: function(file) {
        this.html('');
        console.log(file);
        
        for(var i=0; i<file.lines.length; i++) {
            this.addLine(file.lines[i]);
        }
    }
});
