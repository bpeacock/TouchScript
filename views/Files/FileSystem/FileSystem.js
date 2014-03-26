var subview  = require('subview'),
    click    = require('onclick'),
    _        = require('underscore'),
    programs = require("../../../models/programs");

require('./FileSystem.less');

module.exports = subview('FileSystem', {
    init: function() {
        var self = this;

        programs.ready(function() {
            self.render();
        });

        click('.FileSystem-file', function() {
            self.trigger('openFile', [this.getAttribute('data-name')]);
        });
    },
    data: function() {
        return {
            programs: _.map(programs.list(), function(item) {
                return {
                    name: item.name.replace(/\.[a-zA-Z]+$/, ''),
                    path: item.name
                };
            })
        };
    },
    template: require('./FileSystem.handlebars')
});