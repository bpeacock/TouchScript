var Block = require('./Components/Block'),
    Environment = require('./Components/EnvironmentModel');

require('./Code.less');

var noop = function() {};

module.exports = Block.extend('Code', {
    init: function() {
        var self = this;

        this.environment = new Environment();
        this.focus();

        this.listenDown('error', function() {
            self.onError.apply(this, arguments);
        });
    },
    configure: function(config) {
        this.terminal = config.terminal || null;
        this.onError  = config.onError  || noop;
        return this;
    },
    beforeRun: function() {
        this.running = true;
        this.environment.clear();
    },
    kill: function() {
        this.running = false;
    },

    /*** Events ***/
    onError: noop
});
