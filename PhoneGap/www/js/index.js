var subview = require('subview');

//Prevents premature initialization
subview.noInit = true;

require("../../../views/main.js");

window.app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', function() {
            subview.load();
        }, false);
    }
};
