var subview = require('subview'),
    key     = require('onkey');

require('./Console.less');

module.exports = subview("Console", {
    print: function(string) {
        this.$wrapper.append("<div class='Console-line'>"+string+"</div>");
    },
    prompt: function(string, callback) {
        var $input = $("<input type='text' class='Console-prompt-input' />");

        $("<div class='Console-prompt'>"+string+": </div>")
            .append($input)
            .appendTo(this.$wrapper);

        key($input).down({
            'enter': function() {
                callback($input.val());
                this.destroy();
            }
        });
    }
});
