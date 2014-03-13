module.exports = require('./Comparator').extend('Equals', {
    template: "=",
    run: function(first, second) {
        return first == second;
    }
});
