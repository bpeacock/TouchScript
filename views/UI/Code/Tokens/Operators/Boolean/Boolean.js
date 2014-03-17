var Operator = require('../Operator');
require('./Boolean.less');

module.exports = Operator.extend('Boolean', {
    precedence: 0
});