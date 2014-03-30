var Block       = require('./Components/Block'),
    Environment = require('./Components/EnvironmentModel'),
    _           = require('underscore'),
    nop         = require('nop');

require('./Code.less');

module.exports = Block.extend('Code', {
    listeners: {
        'down:error': function() {
            this.onError.apply(this, arguments);
        }
    },
    init: function() {
        this.environment = new Environment();
        this.focus();
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
    dump: function() {
        return _.extend(this.super.dump.apply(this), {
            version: "0.0.1"
        });
    },

    /*** Events ***/
    onError: nop
});
