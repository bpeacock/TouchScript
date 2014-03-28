var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Components/Block');

require('./For.less');

module.exports = Control.extend('Code-For', {
    init: function() {
        this.condition = Argument.spawn({
            type: "Condition"
        });

        this.block = Block.spawn();

        //Build the Wrapper
        var $header = $("<div class='Code-Control-Header'>")
            .append("for ")
            .append(this.condition.$wrapper)
            .append(':');
        
        this.$wrapper
            .append($header)
            .append(this.block.$wrapper);
    },
    meta: {
        display: 'for',
        name:    'for loop'
    },
    isAsync: true,
    run: function(callback) {
        var self = this,
            code = this.parent('Code');
        
        var loop = setInterval(function() {
            if(self.condition.run() && code.running) {
                self.block.run();
            }
            else {
                clearInterval(loop);
                callback();
            }
        }, 0);
    },
    focus: function() {
        this.condition.focus();
    },
    dump: function() {
        return {
            type: this.type,
            
        };
    },
    load: function(content) {

    }
});
