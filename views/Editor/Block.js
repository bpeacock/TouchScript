var subview     = require('subview'),
    Line        = require('./Line.js'),
    cursor      = require('./cursor'),
    Line        = require('./Line'),
    Environment = require('../../models/Environment');

require('./Block.less');

module.exports = subview('Block', {
    init: function() {
        this.environment = new Environment();
        this.empty();
    },
    empty: function() {
        this.html('');
        var line = Line.spawn();
        this.$wrapper.append(line.$wrapper);

        return this;
    },
    focus: function() {
        subview(this.$wrapper.children().last()).focus();
        return this;
    },
    run: function() {
        //Clear the environment
        this.environment.clear();

        //Run every line
        var children = this.$wrapper.children();
        for(var i=0; i<children.length; i++) {
            subview(children[i]).run();
        }

        return this;
    }
});
