var subview = require('subview'),
    cursor  = require('../cursor'),
    nop     = require('nop');

require('./Token.less');

module.exports = subview('Code-Token', {
    isToken: true,
    meta: {},
    focus: function() {
        this.$wrapper.after(cursor);
    },
    error: require('../Components/error'),
    validatePosition: function(cursor) {
        return true;
    },
    editor: function() {
        return this.parent('Code');
    },
    dump: function() {
        return {
            type: this.type
        };
    },
    load: nop
});
