module.exports = require('./Comparator').extend('GreaterThanEquals', {
    template: "&ge;",
    run: function(first, second) {
        return first >= second;
    }
});
