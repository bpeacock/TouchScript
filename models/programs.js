var Files = require('./Files');

module.exports = new Files({
    extension: "ts",
    encode: JSON.stringify,
    decode: function(json) {
        return JSON.parse(json);
    }
});