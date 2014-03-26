var subview = require('subview'),
    $       = require('unopinionate').selector;

var $body = $('body');

require('./Tooltip.less');

var arrowSpace  = 10,
    arrowOffset = 6,
    margin      = 5;

module.exports = subview('Tooltip', {
    config: function(config) {
        this.msg = config.msg;
    },
    init: function(config) {
        var $el = config.$el,
            $constrain = config.$constrain || $body; //Constraint should always have relative or absolute positioning

        /*** Append to Document ***/
        // Do this here so that the default dimensions show up
        $constrain
            .append(this.$wrapper)
            .append(this.$arrow);

        /*** Get position data ***/
        var el      = $el.offset(),
            con     = $constrain.offset();

        el.width    = $el.outerWidth();
        el.height   = $el.outerHeight();

        con.width   = $constrain.outerWidth();
        con.height  = $constrain.outerHeight();

        var wrapH   = this.$wrapper.outerHeight(),
            wrapW   = this.$wrapper.outerWidth();

        //Get derived position data
        el.mid = el.left + el.width/2;

        /*** Determine vertical position ***/
        var topSpace    = el.top - con.top - margin - arrowSpace,
            bottomSpace = (con.top + con.height) - (el.top + el.height) - margin - arrowSpace,
            top;

        //Put it above the element
        if(topSpace > bottomSpace) {
            if(wrapH > topSpace) {
                wrapH = topSpace;
            }

            top = el.top - wrapH - arrowSpace;

            this.$wrapper.css('top', top);
            this.$arrow.css('top', top + wrapH + arrowOffset);
        }

        //Put it below the element
        else {
            if(wrapH > bottomSpace) {
                wrapH = topSpace;
            }

            top = el.top + el.height + arrowSpace;

            this.$wrapper.css('top', top);
            this.$arrow.css('top', top - arrowOffset);
        }

        this.$wrapper.css('height', wrapH);

        /*** Determine Horizontal Position ***/
        var centerLeft = el.mid - wrapW/2;
        this.$arrow.css('left', el.mid - arrowOffset);
        
        if(centerLeft < con.left) {
            this.$wrapper.css('left', margin);
        }
        else if(centerLeft + wrapW > con.left + con.width) {
            this.$wrapper.css('right', margin);
        }
        else {
            this.$wrapper.css('left', centerLeft);
        }
        
        
    },
    clean: function() {
        this.$arrow.detach();
        this.$wrapper
            .css('height', 'auto')
            .css('left', 'auto')
            .css('right', 'auto');
    },
    template: require('./Tooltip.handlebars'),
    data: function() {
        return {
            msg: this.msg
        };
    },
    $arrow: $("<div class='Tooltip-arrow'>")
});