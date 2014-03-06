var console = require('../../console'),
    Func    = require('../Function');

require('./Print.less');

module.exports = Func.extend('Print', {
    run: function() {
        console.print(this.argument(0).val());
    },
    arguments: [
        {
            type: "String",
            name: "Message"
        }
    ]
});
