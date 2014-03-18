var subview = require('subview'),
    programs = require("../../../models/programs");

require('./FileSystem.less');

module.exports = subview('FileSystem', {
    data: {
        programs: programs.list()
    },
    template: require('./FileSystem.handlebars'),
    init: function() {

    }
});