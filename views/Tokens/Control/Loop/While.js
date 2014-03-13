var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Editor/Block');

require('./Conditional.less');

module.exports = Control.extend('While', {
    init: function() {
        this.arg = Argument.spawn({
            type: "Conditional"
        });

        this.block = Block.spawn();

        //Build the Wrapper
        this.$wrapper
            .append("While ")
            .append(this.arg.$wrapper)
            .append(':')
            .append(this.block.$wrapper);
    },
    meta: {
        display: 'while'
    },
    run: function() {
        while(this.arg.run()) {
            this.block.run();
        }
    },
    focus: function() {
        this.conditions[0].arg.focus();
    }
});
