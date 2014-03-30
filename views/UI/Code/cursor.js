var subview = require('subview');

require('./cursor.less');

var Cursor = subview('Code-Cursor', {
    init: function() {
        var self = this;

        //TODO: THIS IS WRONG
        $(document).on('focus', 'input, div', function() {
            self.hide();
        });
    },
    paste: function(type) {
        this.show();

        //Get the type
        var Type = subview.lookup(type);

        if(!Type) {
            console.error("Type '"+type+"' does not exist");
        }

        //Validate Position
        if(Type.Subview.prototype.validatePosition(this)) {

            //Paste the function
            var command = Type.spawn();
            
            this.$wrapper.before(command.$wrapper);
            command.focus();
        }

        //Event
        this.trigger('paste');
        
        return this;
    },
    show: function() {
        this.$wrapper.css('display', 'inline-block');
        $(':focus').blur();
    },
    hide: function() {
        this.$wrapper.css('display', 'none');
    },
    appendTo: function($el) {
        this.show();
        $el.append(this.$wrapper);
    },
    error: require('./Components/error')
});

module.exports = Cursor.spawn();
