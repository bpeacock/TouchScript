var Files = require('./Files');

module.exports = new Files({
    extension: "ts",
    encode: JSON.stringify,
    decode: JSON.parse
});