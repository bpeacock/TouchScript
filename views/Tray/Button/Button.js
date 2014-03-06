var subview = require('subview'),
    drag    = require('ondrag');

require('./Button.less');

module.exports = subview('Button', {
    init: function(Command) {
        this.Command = Command;

        //Name the Button
        this.$wrapper.html(Command.type);

        //Dragging
        drag(this.$wrapper, {
            helper: "clone",
            start: function() {
                
            },
            move: function() {
                
            },
            stop: function() {

            }
        });
    }
});
