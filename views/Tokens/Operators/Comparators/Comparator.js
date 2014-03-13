var Operator = require('../Operator');
require('./Comparator.less');

module.exports = Operator.extend('Comparator', {
    precedence: 1
});