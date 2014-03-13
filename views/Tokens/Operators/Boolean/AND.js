module.exports = require('./Boolean').extend('AND', {
    template: "AND",
    run: function(first, second) {
        return first && second;
    }
});
