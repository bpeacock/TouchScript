var _   = require('underscore'),
    log = require('loglevel');

var Files = function(config) {
    var self = this;
    config = config || {};

    /*** Configure ***/
    this.extension = "." + config.extension || "";

    var pass = function(value) {
        return value;
    };

    this.encode = config.encode || pass;
    this.decode = config.decode || pass;

    /*** Initialize ***/
    setTimeout(function() {
        self.init();
    }, 1000);

    //Ready Functions
    this._readyFuncs = [];
    this._bindings   = {};
};

Files.prototype = {

    /*** Public Methods ***/
    init: function() {
        var self = this,
            requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

        if(requestFileSystem) {
            if(window.navigator.webkitPersistentStorage) {
                window.navigator.webkitPersistentStorage.requestQuota(1024*1024*5, createFileSytem, log.error);
            }
            else {
                createFileSytem();
            }
        }
        else {
            log.warn("No local file system");
        }

        function createFileSytem(grantedBytes) {
            var type = window.LocalFileSystem ? window.LocalFileSystem.PERSISTENT : window.PERSISTENT,
                size = grantedBytes || 0;

            requestFileSystem(type, size, function(fs) {
                self.root = fs.root;
                self.directory = fs.root.createReader();

                self.sync(function() {
                    self._fireReady();
                });
            }, log.error);
        }
    },
    sync: function(callback) {
        var self  = this,
            regex = new RegExp("[a-z_ -]+\\"+this.extension, "i");

        this.directory.readEntries(function(data) {
            self.data = _.filter(data, function(file) {
                return file.name.match(regex);
            });

            callback();
        }, log.error);

        return this;
    },
    list: function() {
        return this.data || [];
    },
    get: function(name, callback) {
        var self = this;

        this.root.getFile(name + this.extension, {}, function(fileEntry) {
            fileEntry.file(function(file) {
                var reader = new FileReader();

                reader.onloadend = function(e) {
                    callback(self.decode(this.result));
                };

                reader.readAsText(file);
            }, log.error);
        }, log.error);
    },
    set: function(name, content) {
        var self = this;
        name = name + this.extension;

        //Add To Data Cache
        if(!_.findWhere(this.data, {name: name})) {
            this.data.push({name: name});
            this.trigger('add');
        }
        
        this.root.getFile(name, {create: true}, function(file) {
            file.createWriter(function(fileWriter) {
                fileWriter.onerror = function(e) {
                    log.error('Write failed: ' + e.toString());
                };

                fileWriter.write(new Blob([self.encode(content)], {
                    type: 'text/touchscript'
                }));
            }, log.error);
        }, log.error);
    },
    remove: function() {
        var i = this.data.indexOf(name);
        if(i != -1) {
            this.data.splice(i, 1);
            this.trigger('remove');

            this.root.getFile(name, {create: true}, function(file) {
                file.remove(function() {}, log.error);
            }, log.error);
        }
    },
    ready: function(callback) {
        this._readyFuncs.push(callback);
    },
    _fireReady: function() {
        var i = this._readyFuncs.length;
        while(i--) {
            this._readyFuncs[i].apply(this, []);
        }
    },
    bind: function(def, callback) {
        var names = def.split(','),
            i = names.length;

        while(i--) {
            var name = names[i].replace(/ /g, '');

            if(this._bindings[name]) {
                this._bindings[name].push(callback);
            }
            else {
                this._bindings[name] = [callback];
            }
        }
    },
    trigger: function(name) {
        var bindings = this._bindings[name];
        if(bindings) {
            for(var i=0; i<bindings.length; i++) {
                bindings[i]();
            }
        }
    }
};

module.exports = Files;