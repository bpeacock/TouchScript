var subview = require('subview'),
    cursor  = require('../Editor/cursor');

require('./Token.less');

module.exports = subview('Token', {
    init: function() {},
    meta: {},
    focus: function() {
        this.$wrapper.after(cursor);
    },
    error: function(msg) {
        console.error(msg);
    },
    validatePosition: function(cursor) {
        return true;
    }
});
