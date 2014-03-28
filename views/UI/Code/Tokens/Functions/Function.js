var Argument = require('../Argument'),
    cursor   = require('../../cursor'),
    _        = require('underscore');

require('./Function.less');

module.exports = require('../Token').extend('Function', {
    isFunction: true,
    init: function() {
        this.$wrapper.append(this.name+"(");

        this.argumentInstances = [];

        //Parse Arguments
        var i = this.arguments.length;
        while(i--) {
            var arg = Argument.spawn(this.arguments[i]);
            this.argumentInstances.push(arg);

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
        return this.argumentInstances[i].run();
    },
    arguments: [],
    focus: function() {
        if(this.argumentInstances.length > 0) {
            this.argumentInstances[0].focus();
        }
        else {
            this.$wrapper.after(cursor);
        }
    },
    dump: function() {
        return {
            type: this.type,
            arguments: _.map(this.argumentInstances, function(arg) {
                return arg.dump();
            })
        };
    },
    load: function(content) {
        var self = this;
        _.each(content.arguments, function(arg, i) {
            self.argumentInstances[i].load(arg);
        });
    }
});
