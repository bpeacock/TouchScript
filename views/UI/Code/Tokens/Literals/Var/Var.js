var Literal     = require('../Literal'),
    Argument    = require('../../Argument');

require('./Var.less');

module.exports = Literal.extend('Code-Var', {
    isVar: true,
    init: function() {
        this.$name = $("<input type='text' />");

        this.$wrapper
            .append(this.$name);
    },
    meta: {
        display: "Var"
    },
    val: function() {
        return this.parent('Code-Block').environment.get(this.$name.val());
    },
    focus: function() {
        this.$name.focus();
    }
});