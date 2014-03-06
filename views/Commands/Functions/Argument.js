var Field = require('../../Editor/Field');

module.exports = Field.extend('Argument', {
    init: function(config) {
        this.name = config.name || "";
        this.type = config.type || null;
    },
    validate: function() {
        
    }
});
