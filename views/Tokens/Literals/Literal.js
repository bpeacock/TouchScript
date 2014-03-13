require('./Literal.less');

module.exports = require('../Token').extend('Literal', {
    isLiteral: true,
    val: function() {}
});
