var _ = require('underscore');

var Files = function(config) {
    var self = this;
    config = config || {};

    /*** Configure ***/
    this.extension = config.extension || null;

    /*** Initialize ***/
    setTimeout(function() {
        self.init();
    }, 1000);

    //Ready Functions
    this._readyFuncs = [];
};

Files.prototype = {

    /*** Public Methods ***/
    init: function() {
        var self = this;

        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

        if(window.requestFileSystem) {
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fs) {
                self.root = fs.root;
                console.log(fs);
                self.directory = fs.root.createReader();

                self.sync(function() {
                    self._fireReady();
                });
            }, console.error);
        }
        else {
            console.warn("No local file system");
        }
    },
    sync: function(callback) {
        var self  = this,
            regex = new RegExp("[a-z_ -]+\\."+this.extension, "i");

        this.directory.readEntries(function(data) {
            console.log(data);
            self.data = _.filter(data, function(file) {
                console.log(file.name);
                console.log(regex);
                return file.name.match(regex);
            });
            callback();
        }, console.error);

        return this;
    },
    list: function() {
        return this.data || [];
    },
    get: function(name, callback) {
        this.root.getFile(name, {}, function(fileEntry) {
            fileEntry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = function(e) {
                    callback(JSON.parse(this.result));
                };

                reader.readAsText(file);
            }, console.error);
        }, console.error);
    },
    set: function(name, content) {
        var self = this;
        name = name + (this.extension ? "." + this.extension : "");

        this.root.getFile(name, {create: true}, function(file) {
            file.createWriter(function(fileWriter) {
                fileWriter.onerror = function(e) {
                    console.error('Write failed: ' + e.toString());
                };

                fileWriter.write(new Blob([JSON.stringify(content)], {type: 'text/touchscript'}));

            }, console.error);
        }, console.error);
    },
    ready: function(callback) {
        this._readyFuncs.push(callback);
    },
    _fireReady: function() {
        var i = this._readyFuncs.length;
        while(i--) {
            this._readyFuncs[i].apply(this, []);
        }
    }
};

module.exports = Files;