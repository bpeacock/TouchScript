var subview = require('subview');
require('./main.less');

module.exports = subview('main', {
    template: require('./main.handlebars'),
    subviews: {
        Toolbar:    require('./Toolbar/Toolbar'),
        editor:     require('./editor'),
        Tray:       require('./Tray/Tray'),
        terminal:    require('./terminal')
    }
});
