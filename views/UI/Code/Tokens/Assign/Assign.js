var Token       = require('../Token'),
    Argument    = require('../Argument');

require('./Assign.less');

module.exports = Token.extend('Code-Assign', {
    init: function() {
        this.$name = $("<input type='text' />");
        this.value = Argument.spawn();

        this.$wrapper
            .append(this.$name)
            .append(' = ')
            .append(this.value.$wrapper);
    },
    meta: {
        display: "Assign"
    },
    run: function() {
        var value = this.value.run();
        this.parent('Code-Block').environment.set(this.$name.val(), value);
        return value;
    },
    focus: function() {
        this.$name.focus();
    }
});