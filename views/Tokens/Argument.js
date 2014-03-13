var Field = require('../Editor/Field');
require('./Argument.less');

module.exports = Field.extend('Argument', {
    init: function(config) {
        this.name = config.name || "";
        this.type = config.type || null;
    },
    template: "\u200B",
    tagName: 'span'
});
