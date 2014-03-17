var Block = require('./Components/Block');
require('./Code.less');

var noop = function() {};

module.exports = Block.extend('Code', {
    init: function() {
        this.focus();
    },
    configure: function(config) {
        this.terminal = config.terminal || null;
        this.onError  = config.onError  || noop;
        return this;
    },
    beforeRun: function() {
        this.environment.clear();
    },

    /*** Events ***/
    onError: noop
});
