var Block = require('./Block');
require('./Editor.less');

module.exports = Block.extend('Editor', {
    init: function() {
        this.focus();
    }
});
