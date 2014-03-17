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
        var self = this,
            code = this.parent('Code');
        
        var loop = setInterval(function() {
            if(self.condition.run() && code.running) {
                self.block.run();
            }
            else {
                clearInterval(loop);
            }
        }, 0);
    },
    focus: function() {
        this.condition.focus();
    }
});
