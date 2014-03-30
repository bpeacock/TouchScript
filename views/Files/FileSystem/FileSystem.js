var subview  = require('subview'),
    click    = require('onclick'),
    _        = require('underscore'),
    programs = require("../../../models/programs"),
    transitionComplete = require('transition-complete');

require('./FileSystem.less');

module.exports = subview('FileSystem', {
    once: function() {
        var self = this;

        click('.FileSystem-file', function() {
            self.trigger('openFile', [this.getAttribute('data-name')]);
        });

        programs.bind('add, remove', function() {
            transitionComplete(function() {
                self.render();
            });
        });
    },
    init: function() {
        var self = this;

        programs.ready(function() {
            self.render();
        });
    },
    data: function() {
        return {
            programs: _.map(programs.list().sort(), function(item) {
                return {
                    name: item.name.replace(/\.[a-zA-Z]+$/, ''),
                    path: item.name
                };
            })
        };
    },
    template: require('./FileSystem.handlebars')
});