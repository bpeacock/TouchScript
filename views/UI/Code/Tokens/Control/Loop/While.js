var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Components/Block');

require('./While.less');

module.exports = Control.extend('Code-While', {
    init: function() {
        this.condition = Argument.spawn({
            type: "Condition"
        });

        this.block = Block.spawn();

        //Build the Wrapper
        this.$wrapper
            .append("while ")
            .append(this.condition.$wrapper)
            .append(':')
            .append(this.block.$wrapper);
    },
    meta: {
        display: 'while'
    },
    run: function() {
        while(this.condition.run()) {
            this.block.run();
        }
    },
    focus: function() {
        this.condition.focus();
    }
});
