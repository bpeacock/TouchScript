var Operator = require('../Operator');
require('./Boolean.less');

module.exports = Operator.extend('Code-Boolean', {
    precedence: 0
});