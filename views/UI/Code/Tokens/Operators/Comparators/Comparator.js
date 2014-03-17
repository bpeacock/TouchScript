var Operator = require('../Operator');
require('./Comparator.less');

module.exports = Operator.extend('Code-Comparator', {
    precedence: 1
});