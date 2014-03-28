var Slider = require('./UI/Slider/Slider');

require('./main.less');

module.exports = Slider.extend('main', {
    listeners: {
        'down:open': function() {
            this.show('files');
        },
        'down:new, down:edit': function() {
            this.show('editor');
        },
        'down:run': function(callback) {
            this.show('run', callback);
        },
        'self:slide': function() {
            $(":focus").blur();
        }
    },
    panels: [
        {
            name:       'files',
            content:    require('./Files/Files')
        },
        {
            name:       'editor',
            content:    require('./Editor/Editor')
        },
        {
            name:       'run',
            content:    require('./Run/Run')
        }
    ],
    defaultPanel: 'files'
});
