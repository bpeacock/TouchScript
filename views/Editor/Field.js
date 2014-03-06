var subview = require('subview'),
    parse   = require('../../models/parse');

require('./Field.less');

module.exports = subview('Field', {
    init: function() {

    },
    dump: function() {

    },
    val: function() {
        return parse(this.arguments[i].dump());
    }
});
