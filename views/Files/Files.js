var subview = require('subview');

require('./Files.less');

module.exports = subview('Files', {
    template: require('./Files.handlebars'),
    subviews: {
        Toolbar:    require('./Toolbar/Toolbar'),
        FileSystem: require('./FileSystem/FileSystem')
    }
});
