var subview = require('subview'),
    $       = require('unopinionate').selector;

var $body = $('body');

require('./Tooltip.less');

module.exports = subview('Tooltip', {
    config: function(config) {
        this.msg = config.msg;
        this.$el = config.$el;
        this.$constrain = config.$constrain || $body; //Constraint should always have relative or absolute positioning
    },
    init: function() {

        /*** Append to Document ***/
        // Do this here so that the default dimensions show up
        this.$constrain.append(this.$wrapper);
        this.$wrapper.append(this.$arrow);

        /*** Get position data ***/
        var el      = this.$el.position(),
            con     = this.$constrain.position();

        el.width    = this.$el.outerWidth();
        el.height   = this.$el.outerHeight();

        con.width   = this.$constrain.outerWidth();
        con.height  = this.$constrain.outerHeight();

        var wrapH   = this.$wrapper.outerHeight(),
            wrapW   = this.$wrapper.outerWidth();

        //Get derived position data
        el.mid = el.left + el.width/2;

        /*** Determine vertical position ***/
        var topSpace    = el.top - con.top,
            bottomSpace = (con.top + con.height) - (el.top + el.height);

        console.log(el);
        console.log(con);

        console.log(topSpace);
        console.log(bottomSpace);

        //Put it above the element
        if(topSpace > bottomSpace) {
            console.log('above');
            if(wrapH > topSpace) {
                wrapH = topSpace;
            }

            this.$wrapper.css('top', el.top - wrapH);
        }

        //Put it below the element
        else {
            console.log('below');
            console.log(wrapH);
            if(wrapH > bottomSpace) {
                wrapH = topSpace;
            }

            this.$wrapper.css('top', el.top + el.height);
        }

        this.$wrapper.css('height', wrapH);

        /*** Determine Horizontal Position ***/
        var centerLeft = el.mid - wrapW/2;
        
        if(centerLeft < con.left) {
            this.$wrapper.css('left', 0);
        }
        else if(centerLeft + wrapW > con.left + con.width) {
            this.$wrapper.css('right', centerLeft);
        }
        else {
            this.$wrapper.css('left', centerLeft);
        }
        
        
    },
    clean: function() {
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