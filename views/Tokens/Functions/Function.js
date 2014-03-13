var Argument = require('../Argument'),
    cursor   = require('../../Editor/cursor');

require('./Function.less');

module.exports = require('../Token').extend('Function', {
    isFunction: true,
    init: function() {
        this.$wrapper.append(this.name+"(");

        //Parse Arguments
        var i = this.arguments.length;
        while(i--) {
            var arg = Argument.spawn(this.arguments[i]);
            this.arguments[i] = arg;

            this.$wrapper.append(arg.$wrapper);
            if(i > 0) {
                this.$wrapper.append(", ");
            }
        }
        
        this.$wrapper.append(")");
    },

    /*** Should Be Overwritten ***/
    name: '',
    //Runs when the function is called
    run: function() {
        
    },
    argument: function(i) {
        return this.arguments[i].run();
    },
    arguments: [],
    focus: function() {
        if(this.arguments.length > 0) {
            this.arguments[0].focus();
        }
        else {
            this.$wrapper.after(cursor);
        }
    }
});
