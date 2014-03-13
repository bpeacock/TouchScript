var subview = require('subview'),
    key     = require('onkey');

require('./Terminal.less');

module.exports = subview("Terminal", {
    print: function(string) {
        this.$wrapper.append("<div class='Terminal-line'>"+string+"</div>");
    },
    prompt: function(string, callback) {
        var $input = $("<input type='text' class='Terminal-prompt-input' />");

        $("<div class='Terminal-prompt'>"+string+": </div>")
            .append($input)
            .appendTo(this.$wrapper);
        
        key($input).down({
            'enter': function() {
                callback($input.val());
                this.destroy();
            }
        });
    },
    clear: function() {
        this.html('');
        return this;
    }
});
