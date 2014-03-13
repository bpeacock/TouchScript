var subview = require('subview');

require('./cursor.less');

var Cursor = subview('Cursor', {
    init: function() {
        var self = this;

        $(document).on('focus', 'input, div', function() {
            self.$wrapper.hide();
        });
    },
    paste: function(type) {
        //Make sure the cursor is shown
        this.$wrapper.show();
        $(':focus').blur();

        //Get the type
        var Type = subview.lookup(type);

        if(!Type) {
            console.error("Type '"+type+"' does not exist");
        }

        //Validate Position
        if(Type.View.prototype.validatePosition(this)) {

            //Paste the function
            var command = Type.spawn();
            
            this.$wrapper.before(command.$wrapper);
            command.focus();
        }
        
        return this;
    },
    error: function(msg) {
        console.error('Cursor: '+msg);
    }
});

module.exports = Cursor.spawn();
