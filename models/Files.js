var Files = function() {
    setTimeout(function() {
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

        if(window.requestFileSystem) {
            window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fs) {
                var directoryReader = fs.root.createReader();
                directoryReader.readEntries(function(entries) {
                    var i;
                    for (i=0; i<entries.length; i++) {
                        console.log(entries[i].name);
                    }
                }, function (error) {
                    alert(error.code);
                });
            }, function (error) {
                alert(error.code);
            });
        }
        else {
            console.warn("No local file system");
        }
    }, 1000);
};

Files.prototype = {
    list: function() {
        return [];
    }
};

module.exports = Files;