var Slider = require('./UI/Slider/Slider');

require('./main.less');

module.exports = Slider.extend('main', {
    init: function() {
        var self = this;

        this.listenDown({
            open: function() {
                self.show('files');
            },
            'edit, new': function() {
                console.log('new');
                self.show('editor');
            },
            run: function(callback) {
                self.show('run', callback);
            }
        });

        this.bind('slide', function() {
            $(":focus").blur();
        });
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
