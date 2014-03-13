module.exports = require('./Boolean').extend('OR', {
    template: "OR",
    run: function(first, second) {
        return first || second;
    }
});
