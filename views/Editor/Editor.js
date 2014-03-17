var subview = require('subview');
require('./Editor.less');

module.exports = subview('Editor', {
    template: require('./Editor.handlebars'),
    subviews: {
        Toolbar:    require('./Toolbar/Toolbar'),
        code:       require('./code'),
        Tray:       require('./Tray/Tray')
    }
});
