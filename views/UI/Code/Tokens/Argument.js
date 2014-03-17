var Field = require('../Components/Field');
require('./Argument.less');

module.exports = Field.extend('Argument', {
    init: function(config) {
        config = config || {};
        
        this.name = config.name || "";
        this.type = config.type || null;
    },
    template: "\u200B",
    tagName: 'span'
});
