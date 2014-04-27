var nop = require('nop');

require('./Literal.less');

module.exports = require('../Token').extend('Literal', {
    isLiteral:  true,
    val:        nop
});
