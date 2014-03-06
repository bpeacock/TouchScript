var Command  = require('../Command'),
    Argument = require('./Argument');

require('./Function.less');

module.exports = Command.extend('Function', {
    init: function() {
        //Parse Arguments
        var i = this.arguments.length;
        while(i--) {
            this.arguments[i] = Argument.spawn(this.arguments[i]);
        }
    },
    //Runs when the function is called
    run: function() {
        
    },
    argument: function(i) {
        return this.arguments[i];
    },
    arguments: []
});
