var terminal = require('../../../terminal'),
    Func    = require('../Function');

require('./Print.less');

module.exports = Func.extend('print', {
    run: function() {
        terminal.print(this.argument(0));
    },
    arguments: [
        {
            type: "String",
            name: "Message"
        }
    ],
    name: 'print',
    meta: {
        display: 'print( )'
    }
});
