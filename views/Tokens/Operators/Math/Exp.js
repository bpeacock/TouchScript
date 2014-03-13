module.exports = require('./Math').extend('Exp', {
    template: "^",
    precedence: 4,
    run: Math.pow
});