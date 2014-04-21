(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
            subview.init();
        }, false);
    }
};

},{"../../../views/main.js":138,"subview":24}],2:[function(require,module,exports){
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
},{"loglevel":11,"underscore":26}],3:[function(require,module,exports){
var Files = require('./Files');

module.exports = new Files({
    extension: "ts",
    encode: JSON.stringify,
    decode: JSON.parse
});
},{"./Files":2}],4:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

exports["default"] = Handlebars;
},{"./handlebars/base":5,"./handlebars/exception":6,"./handlebars/runtime":7,"./handlebars/safe-string":8,"./handlebars/utils":9}],5:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "1.3.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 4;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn, inverse) {
    if (toString.call(name) === objectType) {
      if (inverse || fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      if (inverse) { fn.not = inverse; }
      this.helpers[name] = fn;
    }
  },

  registerPartial: function(name, str) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      this.partials[name] = str;
    }
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(arg) {
    if(arguments.length === 2) {
      return undefined;
    } else {
      throw new Exception("Missing helper: '" + arg + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse || function() {}, fn = options.fn;

    if (isFunction(context)) { context = context.call(this); }

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      return fn(context);
    }
  });

  instance.registerHelper('each', function(context, options) {
    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          if (data) {
            data.index = i;
            data.first = (i === 0);
            data.last  = (i === (context.length-1));
          }
          ret = ret + fn(context[i], { data: data });
        }
      } else {
        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            if(data) { 
              data.key = key; 
              data.index = i;
              data.first = (i === 0);
            }
            ret = ret + fn(context[key], {data: data});
            i++;
          }
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    if (!Utils.isEmpty(context)) return options.fn(context);
  });

  instance.registerHelper('log', function(context, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, context);
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 3,

  // can be overridden in the host environment
  log: function(level, obj) {
    if (logger.level <= level) {
      var method = logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};
exports.logger = logger;
function log(level, obj) { logger.log(level, obj); }

exports.log = log;var createFrame = function(object) {
  var obj = {};
  Utils.extend(obj, object);
  return obj;
};
exports.createFrame = createFrame;
},{"./exception":6,"./utils":9}],6:[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var line;
  if (node && node.firstLine) {
    line = node.firstLine;

    message += ' - ' + line + ':' + node.firstColumn;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (line) {
    this.lineNumber = line;
    this.column = node.firstColumn;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],7:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  if (!env) {
    throw new Exception("No environment passed to template");
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  var invokePartialWrapper = function(partial, name, context, helpers, partials, data) {
    var result = env.VM.invokePartial.apply(this, arguments);
    if (result != null) { return result; }

    if (env.compile) {
      var options = { helpers: helpers, partials: partials, data: data };
      partials[name] = env.compile(partial, { data: data !== undefined }, env);
      return partials[name](context, options);
    } else {
      throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,
    programs: [],
    program: function(i, fn, data) {
      var programWrapper = this.programs[i];
      if(data) {
        programWrapper = program(i, fn, data);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(i, fn);
      }
      return programWrapper;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = {};
        Utils.extend(ret, common);
        Utils.extend(ret, param);
      }
      return ret;
    },
    programWithDepth: env.VM.programWithDepth,
    noop: env.VM.noop,
    compilerInfo: null
  };

  return function(context, options) {
    options = options || {};
    var namespace = options.partial ? options : env,
        helpers,
        partials;

    if (!options.partial) {
      helpers = options.helpers;
      partials = options.partials;
    }
    var result = templateSpec.call(
          container,
          namespace, context,
          helpers,
          partials,
          options.data);

    if (!options.partial) {
      env.VM.checkRevision(container.compilerInfo);
    }

    return result;
  };
}

exports.template = template;function programWithDepth(i, fn, data /*, $depth */) {
  var args = Array.prototype.slice.call(arguments, 3);

  var prog = function(context, options) {
    options = options || {};

    return fn.apply(this, [context, options.data || data].concat(args));
  };
  prog.program = i;
  prog.depth = args.length;
  return prog;
}

exports.programWithDepth = programWithDepth;function program(i, fn, data) {
  var prog = function(context, options) {
    options = options || {};

    return fn(context, options.data || data);
  };
  prog.program = i;
  prog.depth = 0;
  return prog;
}

exports.program = program;function invokePartial(partial, name, context, helpers, partials, data) {
  var options = { partial: true, helpers: helpers, partials: partials, data: data };

  if(partial === undefined) {
    throw new Exception("The partial " + name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;
},{"./base":5,"./exception":6,"./utils":9}],8:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],9:[function(require,module,exports){
"use strict";
/*jshint -W004 */
var SafeString = require("./safe-string")["default"];

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr] || "&amp;";
}

function extend(obj, value) {
  for(var key in value) {
    if(Object.prototype.hasOwnProperty.call(value, key)) {
      obj[key] = value[key];
    }
  }
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;

function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string instanceof SafeString) {
    return string.toString();
  } else if (!string && string !== 0) {
    return "";
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;
},{"./safe-string":8}],10:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime');

},{"./dist/cjs/handlebars.runtime":4}],11:[function(require,module,exports){
/*
 * loglevel - https://github.com/pimterry/loglevel
 *
 * Copyright (c) 2013 Tim Perry
 * Licensed under the MIT license.
 */

;(function (undefined) {
    var undefinedType = "undefined";

    (function (name, definition) {
        if (typeof module !== 'undefined') {
            module.exports = definition();
        } else if (typeof define === 'function' && typeof define.amd === 'object') {
            define(definition);
        } else {
            this[name] = definition();
        }
    }('log', function () {
        var self = {};
        var noop = function() {};

        function realMethod(methodName) {
            if (typeof console === undefinedType) {
                return noop;
            } else if (console[methodName] === undefined) {
                if (console.log !== undefined) {
                    return boundToConsole(console, 'log');
                } else {
                    return noop;
                }
            } else {
                return boundToConsole(console, methodName);
            }
        }

        function boundToConsole(console, methodName) {
            var method = console[methodName];
            if (method.bind === undefined) {
                if (Function.prototype.bind === undefined) {
                    return functionBindingWrapper(method, console);
                } else {
                    try {
                        return Function.prototype.bind.call(console[methodName], console);
                    } catch (e) {
                        // In IE8 + Modernizr, the bind shim will reject the above, so we fall back to wrapping
                        return functionBindingWrapper(method, console);
                    }
                }
            } else {
                return console[methodName].bind(console);
            }
        }

        function functionBindingWrapper(f, context) {
            return function() {
                Function.prototype.apply.apply(f, [context, arguments]);
            };
        }

        var logMethods = [
            "trace",
            "debug",
            "info",
            "warn",
            "error"
        ];

        function replaceLoggingMethods(methodFactory) {
            for (var ii = 0; ii < logMethods.length; ii++) {
                self[logMethods[ii]] = methodFactory(logMethods[ii]);
            }
        }

        function cookiesAvailable() {
            return (typeof window !== undefinedType &&
                    window.document !== undefined &&
                    window.document.cookie !== undefined);
        }

        function localStorageAvailable() {
            try {
                return (typeof window !== undefinedType &&
                        window.localStorage !== undefined);
            } catch (e) {
                return false;
            }
        }

        function persistLevelIfPossible(levelNum) {
            var localStorageFail = false,
                levelName;

            for (var key in self.levels) {
                if (self.levels.hasOwnProperty(key) && self.levels[key] === levelNum) {
                    levelName = key;
                    break;
                }
            }

            if (localStorageAvailable()) {
                /*
                 * Setting localStorage can create a DOM 22 Exception if running in Private mode
                 * in Safari, so even if it is available we need to catch any errors when trying
                 * to write to it
                 */
                try {
                    window.localStorage['loglevel'] = levelName;
                } catch (e) {
                    localStorageFail = true;
                }
            } else {
                localStorageFail = true;
            }

            if (localStorageFail && cookiesAvailable()) {
                window.document.cookie = "loglevel=" + levelName + ";";
            }
        }

        var cookieRegex = /loglevel=([^;]+)/;

        function loadPersistedLevel() {
            var storedLevel;

            if (localStorageAvailable()) {
                storedLevel = window.localStorage['loglevel'];
            }

            if (storedLevel === undefined && cookiesAvailable()) {
                var cookieMatch = cookieRegex.exec(window.document.cookie) || [];
                storedLevel = cookieMatch[1];
            }
            
            if (self.levels[storedLevel] === undefined) {
                storedLevel = "WARN";
            }

            self.setLevel(self.levels[storedLevel]);
        }

        /*
         *
         * Public API
         *
         */

        self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
            "ERROR": 4, "SILENT": 5};

        self.setLevel = function (level) {
            if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
                persistLevelIfPossible(level);

                if (level === self.levels.SILENT) {
                    replaceLoggingMethods(function () {
                        return noop;
                    });
                    return;
                } else if (typeof console === undefinedType) {
                    replaceLoggingMethods(function (methodName) {
                        return function () {
                            if (typeof console !== undefinedType) {
                                self.setLevel(level);
                                self[methodName].apply(self, arguments);
                            }
                        };
                    });
                    return "No console available for logging";
                } else {
                    replaceLoggingMethods(function (methodName) {
                        if (level <= self.levels[methodName.toUpperCase()]) {
                            return realMethod(methodName);
                        } else {
                            return noop;
                        }
                    });
                }
            } else if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
                self.setLevel(self.levels[level.toUpperCase()]);
            } else {
                throw "log.setLevel() called with invalid level: " + level;
            }
        };

        self.enableAll = function() {
            self.setLevel(self.levels.TRACE);
        };

        self.disableAll = function() {
            self.setLevel(self.levels.SILENT);
        };

        loadPersistedLevel();
        return self;
    }));
})();

},{}],12:[function(require,module,exports){
'use strict';

function nop(){}

module.exports = nop;

},{}],13:[function(require,module,exports){
var $ = require('unopinionate').selector;

var $document   = $(document),
    bindings    = {};

var click = function(events) {
    click.bind.apply(click, arguments);
    return click;
};

/*** Configuration Options ***/
click.distanceLimit = 10;
click.timeLimit     = 140;

/*** Useful Properties ***/
click.isTouch = ('ontouchstart' in window) ||
                window.DocumentTouch &&
                document instanceof DocumentTouch;

/*** Cached Functions ***/
var onTouchstart = function(e) {
    e.stopPropagation(); //Prevents multiple click events from happening

    click._doAnywheres(e);

    var $this       = $(this),
        startTime   = new Date().getTime(),
        startPos    = click._getPos(e);

    $this.one('touchend', function(e) {
        e.preventDefault(); //Prevents click event from firing
        
        var time        = new Date().getTime() - startTime,
            endPos      = click._getPos(e),
            distance    = Math.sqrt(
                Math.pow(endPos.x - startPos.x, 2) +
                Math.pow(endPos.y - startPos.y, 2)
            );

        if(time < click.timeLimit && distance < click.distanceLimit) {
            //Find the correct callback
            $.each(bindings, function(selector, callback) {
                if($this.is(selector)) {
                    callback.apply(e.target, [e]);
                    return false;
                }
            });
        }
    });
};

/*** API ***/
click.bind = function(events) {

    //Argument Surgery
    if(!$.isPlainObject(events)) {
        newEvents = {};
        newEvents[arguments[0]] = arguments[1];
        events = newEvents;
    }

    $.each(events, function(selector, callback) {

        /*** Register Binding ***/
        if(typeof bindings[selector] != 'undefined') {
            click.unbind(selector); //Ensure no duplicates
        }
        
        bindings[selector] = callback;

        /*** Touch Support ***/
        if(click.isTouch) {
            $document.delegate(selector, 'touchstart', onTouchstart);
        }

        /*** Mouse Support ***/
        $document.delegate(selector, 'click', function(e) {
            e.stopPropagation(); //Prevents multiple click events from happening
            //click._doAnywheres(e); //Do anywheres first to be consistent with touch order
            callback.apply(this, [e]);
        });
    });

    return this;
};

click.unbind = function(selector) {
    $document
        .undelegate(selector, 'touchstart')
        .undelegate(selector, 'click');

    delete bindings[selector];

    return this;
};

click.unbindAll = function() {
    $.each(bindings, function(selector, callback) {
        $document
            .undelegate(selector, 'touchstart')
            .undelegate(selector, 'click');
    });
    
    bindings = {};

    return this;
};

click.trigger = function(selector, e) {
    e = e || $.Event('click');

    if(typeof bindings[selector] != 'undefined') {
        bindings[selector](e);
    }
    else {
        console.error("No click events bound for selector '"+selector+"'.");
    }

    return this;
};

click.anywhere = function(callback) {
    click._anywheres.push(callback);
    return this;
};

/*** Internal (but useful) Methods ***/
click._getPos = function(e) {
    e = e.originalEvent;

    if(e.pageX || e.pageY) {
        return {
            x: e.pageX,
            y: e.pageY
        };
    }
    else if(e.changedTouches) {
        return {
            x: e.changedTouches[0].clientX,
            y: e.changedTouches[0].clientY
        };
    }
    else {
        return {
            x: e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
            y: e.clientY + document.body.scrollTop  + document.documentElement.scrollTop
        };
    }
};

click._anywheres = [];

click._doAnywheres = function(e) {
    var i = click._anywheres.length;
    while(i--) {
        click._anywheres[i](e);
    }
};

$(document).bind('mousedown', click._doAnywheres);

module.exports = click;


},{"unopinionate":27}],14:[function(require,module,exports){
var $ = require('unopinionate').selector,
    $document = $(document);

var Drag = function(selector, config) {
    
};

Drag.prototype = {
    /*horizontal: function() {

    },
    vertical: function() {

    }, */
    constrain: function(/*[direction, element], bounds**/) {

    },
    start: function() {

    },
    stop: function() {

    },
    move: function() {

    },
    revert: function() {

    },
    scroll: function() {

    }
};

module.exports = Drag;

},{"unopinionate":27}],15:[function(require,module,exports){
var $ = require('unopinionate').selector;

var Drop = function(selector, config) {

};

Drop.prototype = {

};

module.exports = Drop;
},{"unopinionate":27}],16:[function(require,module,exports){
var Drag = require("./Drag"),
    Drop = require("./Drop");

var dropIndex = {};

var onDrag = function(selector, config) {
    return new Drag(selector, config);
};

onDrag.drop = function(selector, config) {
    var drop = new Drop(selector, config);

    //drop indexing
    var addToIndex = function(name) {
        if(typeof dropIndex[name] == 'undefined') dropIndex[name] = [drop];
        else                                      dropIndex[name].push(drop);
    };

    if(!config.tag) {
        addToIndex('');
    }
    else if(typeof config.tag == 'String') {
        addToIndex(config.tag);
    }
    else {
        var i = config.tag.length;
        while(i--) {
            addToIndex(config.tag[i]);
        }
    }

    return drop;
};

module.exports = onDrag;

},{"./Drag":14,"./Drop":15}],17:[function(require,module,exports){
var $ = require('unopinionate').selector,
        specialKeys = require('./specialKeys');

var $window = $(window);

var Event = function(selector) {
    this.selector   = selector;
    this.$scope     = selector ? $(selector) : $window;
    this.callbacks  = [];
    this.active     = true;
};

Event.prototype = {
    up: function(events) {
        this.bind('up', events);
        return this;
    },
    down: function(events) {
        this.bind('down', events);
        return this;
    },
    bind: function(type, events) {
        var self = this;

        if($.isPlainObject(events)) {
            $.each(events, function(key, callback) {
                self._add(type, key, callback);
            });
        }
        else {
            this._add(type, false, events);
        }

        return this;
    },
    on: function() {
        this.active = true;
        return this;
    },
    off: function() {
        this.active = false;
        return this;
    },
    destroy: function() {
        this.$scope
            .unbind('keydown')
            .unbind('keyup');
    },

    /*** Internal Functions ***/
    _add: function(type, conditions, callback) {
        var self = this;

        if(!this.callbacks[type]) {
            this.callbacks[type] = [];

            this.$scope.bind('key' + type, function(e) {
                if(self.active) {
                    var callbacks = self.callbacks[type];

                    for(var i=0; i<callbacks.length; i++) {
                        var callback = callbacks[i];
                        if(!callback.conditions || self._validate(callback.conditions, e)) {
                            callback(e);
                        }
                    }
                }
            });
        }

        if(conditions) {
            callback.conditions = this._parseConditions(conditions);
        }

        this.callbacks[type].push(callback);
    },
    _parseConditions: function(c) {
        var conditions = {
            shift:   /\bshift\b/i.test(c),
            alt:     /\b(alt|alternate)\b/i.test(c),
            ctrl:    /\b(ctrl|control|cmd|command)\b/i.test(c)
        };

        //Key Binding
        var keys = c.match(/\b(?!shift|alt|alternate|ctrl|control|cmd|command)(\w+)\b/gi);

        if(!keys) {
            //Use modifier as key if there is no other key
            keys = c.match(/\b(\w+)\b/gi);

            //Modifiers should all be false
            conditions.shift =
            conditions.alt   =
            conditions.ctrl  = false;
        }

        if(keys) {
            conditions.key = keys[0];
            
            if(keys.length > 1) {
                console.warn("More than one key bound in '"+c+"'. Using the first one ("+keys[0]+").");
            }
        }
        else {
            conditions.key      = null;
            conditions.keyCode  = null;
        }

        return conditions;
    },
    _keyCodeTest: function(key, keyCode) {
        if(typeof specialKeys[keyCode] !== 'undefined') {
            var keyDef = specialKeys[keyCode];

            if(keyDef instanceof RegExp) {
                return keyDef.test(key);
            }
            else {
                return keyDef === key.toLowerCase();
            }
        }
        else if(key.length === 1) {
            return key.toUpperCase().charCodeAt(0) === keyCode;
        }
        else {
            return false;
        }
    },
    _validate: function(c, e) {
        return  (c.key ? this._keyCodeTest(c.key, e.which) : true) &&
                c.shift === e.shiftKey &&
                c.alt   === e.altKey &&
                (!c.ctrl || (c.ctrl === e.metaKey) !== (c.ctrl === e.ctrlKey));
    }
};

module.exports = Event;


},{"./specialKeys":19,"unopinionate":27}],18:[function(require,module,exports){
var Event = require('./Event.js'),
    events = [];

var key = function(selector) { //Factory for Event objects
    return key._createEvent(selector);
};

key.down = function(config) {
    return this._createEvent().down(config);
};

key.up = function(config) {
    return this._createEvent().up(config);
};

key.unbindAll = function() {
    while(events.length) {
        events.pop().destroy();
    }

    return this;
};

//Creates new Event objects (checking for existing first)
key._createEvent = function(selector) {
    var e = new Event(selector);
    events.push(e);
    return e;
};

module.exports = key;

},{"./Event.js":17}],19:[function(require,module,exports){
//Adopted from [jQuery hotkeys](https://github.com/jeresig/jquery.hotkeys/blob/master/jquery.hotkeys.js)

module.exports = {
    8: "backspace",
    9: "tab",
    10: /^(return|enter)$/i,
    13: /^(return|enter)$/i,
    16: "shift",
    17: /^(ctrl|control)$/i,
    18: /^(alt|alternate)$/i,
    19: "pause",
    20: "capslock",
    27: /^(esc|escape)$/i,
    32: "space",
    33: "pageup",
    34: "pagedown",
    35: "end",
    36: "home",
    37: "left",
    38: "up",
    39: "right",
    40: "down",
    45: "insert",
    46: /^(del|delete)$/i,
    91: /^(cmd|command)$/i,
    96: "0",
    97: "1",
    98: "2",
    99: "3",
    100: "4",
    101: "5",
    102: "6",
    103: "7",
    104: "8",
    105: "9",
    106: "*",
    107: "+",
    109: "-",
    110: ".",
    111 : "/",
    112: "f1",
    113: "f2",
    114: "f3",
    115: "f4",
    116: "f5",
    117: "f6",
    118: "f7",
    119: "f8",
    120: "f9",
    121: "f10",
    122: "f11",
    123: "f12",
    144: "numlock",
    145: "scroll",
    186: ";",
    187: "=",
    189: "-",
    190: ".",
    191: "/",
    192: "`",
    219: "[",
    220: "\\",
    221: "]",
    222: "'",
    224: "meta"
};

},{}],20:[function(require,module,exports){

var style = document.createElement('p').style
var prefixes = 'O ms Moz webkit'.split(' ')
var upper = /([A-Z])/g

var memo = {}

/**
 * memoized `prefix`
 *
 * @param {String} key
 * @return {String}
 * @api public
 */

module.exports = exports = function(key){
  return key in memo
    ? memo[key]
    : memo[key] = prefix(key)
}

exports.prefix = prefix
exports.dash = dashedPrefix

/**
 * prefix `key`
 *
 *   prefix('transform') // => webkitTransform
 *
 * @param {String} key
 * @return {String}
 * @api public
 */

function prefix(key){
  // camel case
  key = key.replace(/-([a-z])/g, function(_, char){
    return char.toUpperCase()
  })

  // without prefix
  if (style[key] !== undefined) return key

  // with prefix
  var Key = capitalize(key)
  var i = prefixes.length
  while (i--) {
    var name = prefixes[i] + Key
    if (style[name] !== undefined) return name
  }

  throw new Error('unable to prefix ' + key)
}

function capitalize(str){
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * create a dasherized prefix
 *
 * @param {String} key
 * @return {String}
 * @api public
 */

function dashedPrefix(key){
  key = prefix(key)
  if (upper.test(key)) key = '-' + key.replace(upper, '-$1')
  return key.toLowerCase()
}

},{}],21:[function(require,module,exports){
/*
 * loglevel - https://github.com/pimterry/loglevel
 *
 * Copyright (c) 2013 Tim Perry
 * Licensed under the MIT license.
 */

;(function (undefined) {
    var undefinedType = "undefined";

    (function (name, definition) {
        if (typeof module !== 'undefined') {
            module.exports = definition();
        } else if (typeof define === 'function' && typeof define.amd === 'object') {
            define(definition);
        } else {
            this[name] = definition();
        }
    }('log', function () {
        var self = {};
        var noop = function() {};

        function realMethod(methodName) {
            if (typeof console === undefinedType) {
                return noop;
            } else if (console[methodName] === undefined) {
                if (console.log !== undefined) {
                    return boundToConsole(console, 'log');
                } else {
                    return noop;
                }
            } else {
                return boundToConsole(console, methodName);
            }
        }

        function boundToConsole(console, methodName) {
            var method = console[methodName];
            if (method.bind === undefined) {
                if (Function.prototype.bind === undefined) {
                    return functionBindingWrapper(method, console);
                } else {
                    try {
                        return Function.prototype.bind.call(console[methodName], console);
                    } catch (e) {
                        // In IE8 + Modernizr, the bind shim will reject the above, so we fall back to wrapping
                        return functionBindingWrapper(method, console);
                    }
                }
            } else {
                return console[methodName].bind(console);
            }
        }

        function functionBindingWrapper(f, context) {
            return function() {
                Function.prototype.apply.apply(f, [context, arguments]);
            };
        }

        var logMethods = [
            "trace",
            "debug",
            "info",
            "warn",
            "error"
        ];

        function replaceLoggingMethods(methodFactory) {
            for (var ii = 0; ii < logMethods.length; ii++) {
                self[logMethods[ii]] = methodFactory(logMethods[ii]);
            }
        }

        function cookiesAvailable() {
            return (typeof window !== undefinedType &&
                    window.document !== undefined &&
                    window.document.cookie !== undefined);
        }

        function localStorageAvailable() {
            try {
                return (typeof window !== undefinedType &&
                        window.localStorage !== undefined);
            } catch (e) {
                return false;
            }
        }

        function persistLevelIfPossible(levelNum) {
            var levelName;

            for (var key in self.levels) {
                if (self.levels.hasOwnProperty(key) && self.levels[key] === levelNum) {
                    levelName = key;
                    break;
                }
            }

            if (localStorageAvailable()) {
                window.localStorage['loglevel'] = levelName;
            } else if (cookiesAvailable()) {
                window.document.cookie = "loglevel=" + levelName + ";";
            } else {
                return;
            }
        }

        var cookieRegex = /loglevel=([^;]+)/;

        function loadPersistedLevel() {
            var storedLevel;

            if (localStorageAvailable()) {
                storedLevel = window.localStorage['loglevel'];
            }

            if (!storedLevel && cookiesAvailable()) {
                var cookieMatch = cookieRegex.exec(window.document.cookie) || [];
                storedLevel = cookieMatch[1];
            }

            self.setLevel(self.levels[storedLevel] || self.levels.WARN);
        }

        /*
         *
         * Public API
         *
         */

        self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
            "ERROR": 4, "SILENT": 5};

        self.setLevel = function (level) {
            if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
                persistLevelIfPossible(level);

                if (level === self.levels.SILENT) {
                    replaceLoggingMethods(function () {
                        return noop;
                    });
                    return;
                } else if (typeof console === undefinedType) {
                    replaceLoggingMethods(function (methodName) {
                        return function () {
                            if (typeof console !== undefinedType) {
                                self.setLevel(level);
                                self[methodName].apply(self, arguments);
                            }
                        };
                    });
                    return "No console available for logging";
                } else {
                    replaceLoggingMethods(function (methodName) {
                        if (level <= self.levels[methodName.toUpperCase()]) {
                            return realMethod(methodName);
                        } else {
                            return noop;
                        }
                    });
                }
            } else if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
                self.setLevel(self.levels[level.toUpperCase()]);
            } else {
                throw "log.setLevel() called with invalid level: " + level;
            }
        };

        self.enableAll = function() {
            self.setLevel(self.levels.TRACE);
        };

        self.disableAll = function() {
            self.setLevel(self.levels.SILENT);
        };

        loadPersistedLevel();
        return self;
    }));
})();

},{}],22:[function(require,module,exports){
var log = require('loglevel'),
    noop = function() {};

var Subview = function() {};

Subview.prototype = {
    isSubview: true,

    /*** Life-Cycle ***/

    //These should be configured but will be pushed to their respective function stacks rather than overwriting
    once: function(config) { //Runs after render
        for(var i=0; i<this._onceFunctions.length; i++) {
            this._onceFunctions[i].apply(this, [config]);
        }
        return this;
    }, 
    _onceFunctions: [],
    init: function(config) { //Runs after render
        for(var i=0; i<this._initFunctions.length; i++) {
            this._initFunctions[i].apply(this, [config]);
        }
        return this;
    },
    _initFunctions: [],
    clean: function() { //Runs on remove
        for(var i=0; i<this._cleanFunctions.length; i++) {
            this._cleanFunctions[i].apply(this, []);
        }
        return this;
    }, 
    _cleanFunctions: [],

    //Static methods and properties
    active: false,

    remove: function() {
        if(this.active) {
            //Detach
            var parent = this.wrapper.parentNode;
            if(parent) {
                parent.removeChild(this.wrapper);
            }

            //Clean
            this.clean();

            this.pool._release(this);
        }

        return this;
    },


    /*** Templating ***/

    template:   "",

    //Data goes into the templates and may also be a function that returns an object
    data:       {},

    //Subviews are a set of subviews that will be fed into the templating engine
    subviews:   {},

    //Settings
    reRender:   false, //Determines if subview is re-rendered every time it is spawned
    tagName:    "div",
    className:  "",

    //Events
    preRender:  noop,
    postRender: noop,

    render: function() {
        var self = this,
            html = '';
            postLoad = false;

        this.preRender();

        //No Templating Engine
        if(typeof this.template == 'string') {
            html = this.template;
        }
        else {
            var data = typeof this.data == 'function' ? this.data() : this.data;
            
            //Define the subview variable
            data.subview = {};
            $.each(this.subviews, function(name, subview) {
                postLoad = true;
                data.subview[name] = "<script class='post-load-view' type='text/html' data-name='"+name+"'></script>";
            });

            //Run the templating engine
            if($.isFunction(this.template)) {
                //EJS
                if(typeof this.template.render == 'function') {
                    html = this.template.render(data);
                }
                //Handlebars & Underscore & Jade
                else {
                    html = this.template(data);
                }
            }
            else {
                log.error("Templating engine not recognized.");
            }
        }

        this.html(html);

        //Post Load Views
        if(postLoad) {
            var $postLoads = this.$wrapper.find('.post-load-view'),
                i = $postLoads.length;
            
            while(i--) {
                var $postLoad = $($postLoads[i]),
                    view  = self.subviews[$postLoad.attr('data-name')];

                if(view.isSubviewPool) {
                    view = view.spawn();
                }

                $postLoad
                    .after(view.$wrapper)
                    .remove();
            }
        }

        this.postRender();

        return this;
    },
    html: function(html) {
        //Remove & clean subviews in the wrapper 
        var $subviews = this.$('.'+this._subviewCssClass),
            i = $subviews.length;

        while(i--) {
            subview($subviews[i]).remove();
        }
        
        //Empty the wrapper
        this.wrapper.innerHTML = html;

        return this;
    },

    
    /*** Events ***/

    //listeners
    listeners: {
        //'[direction]:[event name]:[from type], ...': function(eventArguments*) {}
    },

    trigger: function(name, args) {
        var self = this;
        args = args || [];

        //Broadcast in all directions
        var directions = {
            up:     'find',
            down:   'parents',
            across: 'siblings',
            all:    null,
            self:   this.$wrapper
        };

        $.each(directions, function(direction, jqFunc) {
            var selector = '.listener-'+direction+'-'+name;
            selector = selector + ', ' + selector+'-'+self.type;

            //Select $wrappers with the right listener class in the right direction
            var $els = jqFunc ? 
                            jqFunc.jquery ? jqFunc :
                                self.$wrapper[jqFunc](selector) : $(selector);

            for(var i=0; i<$els.length; i++) {
                //Get the actual subview
                var recipient = subview($els[i]);

                //Check for a subview type specific callback
                var typedCallback = recipient.listeners[direction + ":" + name + ":" + self.type];
                if(typedCallback && typedCallback.apply(recipient, args) === false) {
                    return false; //Breaks if callback returns false
                }

                //Check for a general event callback
                var untypedCallback = recipient.listeners[direction + ":" + name];
                if(untypedCallback && untypedCallback.apply(recipient, args) === false) {
                    return false; //Breaks if callback returns false
                }
            }
        });
        
        return this;
    },

    //Gets called when a new Subview instance is created by the SubviewPool
    _bindListeners: function() {
        var self = this;

        $.each(this.listeners, function(events, callback) {

            //Parse the event format "[view type]:[event name], [view type]:[event name]"

            events = events.split(',');
            var i = events.length;

            while(i--) {
                var event       = events[i].replace(/ /g, ''),
                    eventParts  = event.split(':');
                
                var direction = eventParts[0],
                    name      = eventParts[1],
                    viewType  = eventParts[2] || null;
                
                //Add the listener class
                if(direction != 'self') {
                    self.$wrapper.addClass('listener-' + direction + '-' + name + (viewType ? '-' + viewType : ''));
                }

                //Fix the listeners callback
                self.listeners[event] = callback;
            }
        });

        return this;
    },

    
    /*** Traversing ***/

    $: function(selector) {
        return this.$wrapper.find(selector);
    },
    _traverse: function(jqFunc, type) {
        var $el = this.$wrapper[jqFunc]('.' + (type ? this._subviewCssClass + '-' + type : 'subview'));
        
        if($el) {
            if($el.length === 1) {
                return $el[0][subview._domPropertyName];
            }
            else if($el.length > 1) {
                var i = $el.length,
                    subviews = [];

                while(i--) {
                    subviews.push($el[i][subview._domPropertyName]);
                }

                return subviews;
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    },
    parent: function(type) {
        return this._traverse('closest', type);
    },
    next: function(type) {
        return this._traverse('next', type);
    },
    prev: function(type) {
        return this._traverse('prev', type);
    },
    children: function(type) {
        return this._traverse('find', type);
    },


    /*** Classes ***/

    _subviewCssClass: 'subview',
    _addDefaultClasses: function() {
        var classes = this.className.split(' ');

        classes.push(this._subviewCssClass + '-' + this.type);

        var superClass = this.super;
        while(true) {
            if(superClass.type) {
                classes.push(this._subviewCssClass + '-' + superClass.type);
                superClass = superClass.super;
            }
            else {
                break;
            }
        }

        //Add Default View Class
        classes.push(this._subviewCssClass);

        //Add classes to the DOM
        this.$wrapper.addClass(classes.join(' '));

        return this;
    },


    /*** Extensions ***/

    _loadExtensions: function() {
        var self = this;
        $.each(this, function(name, prop) {
            if(prop._isSubviewExtension) {
                self[name] = prop(self);
            }
        });
        return this;
    }
};

module.exports = Subview;


},{"loglevel":21}],23:[function(require,module,exports){
var $ = require("unopinionate").selector;

var SubviewPool = function(Subview) {
    //Configuration
    this.Subview    = Subview;
    this.type       = Subview.prototype.type;
    this.super      = Subview.prototype.super;
    
    //View Configuration
    this.Subview.prototype.pool = this;

    //Pool
    this.pool = [];
};

SubviewPool.prototype = {
    isSubviewPool: true,
    spawn: function(el, config) {
        //jQuery normalization
        var $el = el ? (el.jquery ? el : $(el)): null;
        el = el && el.jquery ? el[0] : el;

        //Argument surgery
        if(el && el.view) {
            return el.view;
        }
        else {
            var view;
            config = config || ($.isPlainObject(el) ? el : undefined);
            
            //Get the DOM node
            if(!el || !el.nodeType) {
                if(this.pool.length !== 0) {
                    view = this.pool.pop();
                }
                else {
                    el = document.createElement(this.Subview.prototype.tagName);
                    $el = $(el);
                }
            }

            var isNewView;
            if(!view) {
                isNewView   = true;
                view        = new this.Subview();

                //Bind to/from the element
                el[subview._domPropertyName] = view;
                view.wrapper  = el;
                view.$wrapper = $el;

                view._addDefaultClasses();
                view._bindListeners();
                view._loadExtensions();

                view.once();
            }
            
            //Make the view active
            view.active = true;

            //Render
            if(isNewView || view.reRender) {
                view.render();
            }

            //Initialize
            view.init(config);

            return view;
        }
    },
    extend: function(name, config) {
        return subview(name, this, config);
    },
    destroy: function() {
        this.pool = null;
        delete subview.Subviews[this.type];
    },

    _release: function(view) {
        view.active = false;
        this.pool.push(view);
        return this;
    }
};

module.exports = SubviewPool;

},{"unopinionate":27}],24:[function(require,module,exports){
var log             = require("loglevel"),
    $               = require("unopinionate").selector,
    ViewPool        = require("./SubviewPool"),
    ViewTemplate    = require("./Subview"),
    noop            = function() {},
    viewTypeRegex   = new RegExp('^' + ViewTemplate.prototype._subviewCssClass + '-');

var subview = function(name, protoViewPool, config) {
    var ViewPrototype;

    if(!name) {
        return null;
    }
    //Return View object from DOM element
    else if(name.nodeType || name.jquery) {
        return (name.jquery ? name[0] : name)[subview._domPropertyName] || null;
    }
    //Define a subview
    else {
        //Argument surgery
        if(protoViewPool && protoViewPool.isSubviewPool) {
            ViewPrototype = protoViewPool.Subview;
        }
        else {
            config          = protoViewPool;
            ViewPrototype   = ViewTemplate;
        }

        config = config || {};

        //Validate Name && Configuration
        if(subview._validateName(name) && subview._validateConfig(config)) {
            //Create the new View
            var View        = function() {},
                superClass  = new ViewPrototype();

            //Extend the existing init, config & clean functions rather than overwriting them
            var extendFunctions = ['once', 'init', 'clean'];

            for(var i=0; i<extendFunctions.length; i++) {
                var funcName = extendFunctions[i],
                    funcStackName = '_' + funcName + 'Functions';

                config[funcStackName] = superClass[funcStackName].slice(0); //Clone superClass init
                
                if(config[funcName]) {
                    config[funcStackName].push(config[funcName]);
                    delete config[funcName];
                }
            }

            //Extend the listeners object
            if(config.listeners) {
                $.each(superClass.listeners, function(event, callback) {
                    if(config.listeners[event]) {
                        //Extend the function
                        config.listeners[event] = (function(oldCallback, newCallback) {
                            return function() {
                                if(oldCallback.apply(this, arguments) === false) {
                                    return false;
                                }
                                
                                return newCallback.apply(this, arguments);
                            };
                        })(config.listeners[event], callback);
                    }
                    else {
                        config.listeners[event] = callback;
                    }
                });
            }

            //Extend the View
            for(var prop in config) {
                superClass[prop] = config[prop];
            }

            View.prototype = superClass;

            //Build The new view
            View.prototype.type  = name;
            View.prototype.super = ViewPrototype.prototype;
            
            //Save the New View
            var viewPool        = new ViewPool(View);
            subview.Subviews[name] = viewPool;

            return viewPool;
        }
        else {
            return null;
        }
    }
};

subview.Subviews = {};

//Obscure DOM property name for subview wrappers
subview._domPropertyName = "subview12345";

/*** API ***/
subview.lookup = function(name) {
    if(typeof name == 'string') {
        return this.Subviews[name];
    }
    else {
        if(name.isSubviewPool) {
            return name;
        }
        else if(name.isSubview) {
            return name.pool;
        }
        else {
            return undefined;
        }
    }
};

subview._validateName = function(name) {
    if(!name.match(/^[a-zA-Z0-9\-_]+$/)) {
        log.error("subview name '" + name + "' is not alphanumeric.");
        return false;
    }

    if(subview.Subviews[name]) {
        log.error("subview '" + name + "' is already defined.");
        return false;
    }

    return true;
};

subview._reservedMethods = [
    'html',
    'remove',
    'parent',
    'children',
    'next',
    'prev',
    'trigger',
    'traverse',
    '$',
    '_bindListeners',
    'active',
    '_subviewCssClass',
    '_addDefaultClasses',
    '$wrapper',
    'wrapper'
];

subview._validateConfig = function(config) {
    var success = true;

    $.each(config, function(name, value) {
        if(subview._reservedMethods.indexOf(name) !== -1) {
            log.error("Method '"+name+"' is reserved as part of the subview API.");
            success = false;
        }
    });

    return success;
};

subview.init = function() {
    var Main = subview.lookup('main');

    if(Main) {
        subview.main = Main.spawn();
        subview.main.$wrapper.appendTo('body');
    }
};

/*** Extensions ***/
subview.extension = function(extensionConfig) {

    //The Actual Extension Definition
    var Extension = function(userConfig, view) {
        this.view   = view;
        this.config = userConfig;
    };

    Extension.prototype = extensionConfig;

    if(!Extension.prototype.init) Extension.prototype.init = noop;

    // This function gets called by the user to pass in their configuration
    return function(userConfig) {

        // This function is called in view._loadExtensions
        var ExtensionFactory = function(view) {
            var extension = new Extension(userConfig, view);

            //Initialize the extension
            extension.init.apply(extension, [userConfig, view]);

            return extension;
        };

        ExtensionFactory._isSubviewExtension = true;

        return ExtensionFactory;
    };
};

/*** Export ***/
window.subview = module.exports = subview;

$(function() {
    if(!subview.noInit) {
        subview.init();
    }
});

},{"./Subview":22,"./SubviewPool":23,"loglevel":21,"unopinionate":27}],25:[function(require,module,exports){
var callbacks = [];

module.exports = function(callback) {
    if(callbacks.length === 0) {
        setEvent();
    }

    callbacks.push(callback);
};

function setEvent() {
    document.addEventListener(eventName(), function() {
        var i = callbacks.length;
        while(i--) {
            callbacks[i]();
        }

        callbacks = [];
    });
}

var _eventName;

function eventName() {
    if(!_eventName) {
        // Sourced from: http://stackoverflow.com/questions/5023514/how-do-i-normalize-css3-transition-functions-across-browsers
        var el = document.createElement('fakeelement');
            transitions = {
                transition:       'transitionend',
                OTransition:      'oTransitionEnd',
                MozTransition:    'transitionend',
                WebkitTransition: 'webkitTransitionEnd'
            };

        for(var t in transitions) {
            if(el.style[t] !== undefined) {
                _eventName = transitions[t];
            }
        }
    }

    return _eventName;
}

},{}],26:[function(require,module,exports){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

},{}],27:[function(require,module,exports){
(function (global){
(function(root) {
    var unopinionate = {
        selector: root.jQuery || root.Zepto || root.ender || root.$,
        template: root.Handlebars || root.Mustache
    };

    /*** Export ***/

    //AMD
    if(typeof define === 'function' && define.amd) {
        define([], function() {
            return unopinionate;
        });
    }
    //CommonJS
    else if(typeof module.exports !== 'undefined') {
        module.exports = unopinionate;
    }
    //Global
    else {
        root.unopinionate = unopinionate;
    }
})(typeof window != 'undefined' ? window : global);

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],28:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function";


  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Toolbar)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.code)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Tray)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  return buffer;
  });
},{"handlebars/runtime":10}],29:[function(require,module,exports){
var subview     = require('subview'),
    code        = require('./code'),
    toolbar     = require('./toolbar'),
    programs    = require('../../models/programs'),
    transitionComplete = require('transition-complete');

require('./Editor.less');

module.exports = subview('Editor', {
    listeners: {
        'all:open, all:save': function() {
            transitionComplete(function() {
                programs.set(toolbar.getName(), code.dump());

                toolbar.setName('');
                code.empty();
            });
        },
        'all:openFile': function(fileName) {
            transitionComplete(function() {
                toolbar.setName(fileName);
                
                programs.get(fileName, function(file) {
                    code.load(file);
                });
            });
        },
        'all:new': function() {
            code.empty();

            transitionComplete(function() {
                toolbar.focusName();
            });
        }
    },
    template: require('./Editor.handlebars'),
    subviews: {
        Toolbar:    toolbar,
        code:       code,
        Tray:       require('./Tray/Tray')
    }
});

},{"../../models/programs":3,"./Editor.handlebars":28,"./Editor.less":30,"./Tray/Tray":35,"./code":37,"./toolbar":38,"subview":24,"transition-complete":25}],30:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Toolbar{position:absolute;height:50px;width:100%}.subview-Code{position:absolute;bottom:150px;top:50px;width:100%}.subview-Tray{position:absolute;height:150px;bottom:0;width:100%}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],31:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Editor-Toolbar-open'>Open</button>\n\n<input type='text' class='Editor-Toolbar-name' placeholder='Untitled' />\n\n<button class='Editor-Toolbar-run'>Run</button>";
  });
},{"handlebars/runtime":10}],32:[function(require,module,exports){
var Toolbar  = require('../../UI/Toolbar/Toolbar'),
    click    = require('onclick'),
    code     = require('../code'),
    terminal = require('../../Run/terminal');

require('./Toolbar.less');

module.exports = Toolbar.extend('Editor-Toolbar', {
    init: function() {
        var self = this;

        click({
            '.Editor-Toolbar-run': function() {
                terminal.clear();

                setTimeout(function() {
                    self.trigger('run', [function() {
                        code.run();
                    }]);
                }, 0);
            },
            '.Editor-Toolbar-open': function() {
                self.trigger('open');
            }
        });
        
        this.$name = this.$wrapper.find('.Editor-Toolbar-name');
    },
    template: require('./Toolbar.handlebars'),
    getName: function() {
        return this.$name.val();
    },
    setName: function(name) {
        this.$name.val(name || '');
        return this;
    },
    focusName: function() {
        this.$name
            .val('')
            .focus();
    }
});

},{"../../Run/terminal":56,"../../UI/Toolbar/Toolbar":133,"../code":37,"./Toolbar.handlebars":31,"./Toolbar.less":33,"onclick":13}],33:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".Editor-Toolbar-run{float:right}.Editor-Toolbar-open{float:left}.Editor-Toolbar-name{position:absolute;left:50%;bottom:0;margin-left:-100px;width:200px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;background:0 0;border:0;text-align:center;font-size:inherit;font-family:inherit;color:inherit}.Editor-Toolbar-name:focus{outline:0}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],34:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var stack1, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, helper;
  buffer += "\n    <div class='Tray-Button' data-type='";
  if (helper = helpers.type) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.type); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "'>";
  if (helper = helpers.name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</div>\n";
  return buffer;
  }

  stack1 = helpers.each.call(depth0, (depth0 && depth0.buttons), {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  });
},{"handlebars/runtime":10}],35:[function(require,module,exports){
var subview = require('subview'),
    buttons = require('../../UI/Code/Tokens/index'),
    drag    = require('ondrag'),
    click   = require('onclick'),
    cursor  = require('../../UI/Code/cursor');

require('./Tray.less');

/*** Setup Dragging ***/

drag('.Tray-Button', {
    helper: "clone",
    start: function() {
        
    },
    move: function() {
        
    },
    stop: function() {
        var type = this.getAttribute('data-type');
    }
});

click('.Tray-Button', function(e) {
    e.preventDefault();
    
    var type = this.getAttribute('data-type');
    cursor.paste(type);
});

/*** Define the Subview ***/

module.exports = subview('Tray', {
    init: function() {
        
    },
    template: require("./Tray.handlebars"),
    data: function() {
        var data = [];

        var i = buttons.length;
        while(i--) {
            var Button = buttons[i];

            data.push({
                name: Button.Subview.prototype.meta.display || Button.Subview.prototype.template,
                type: Button.type
            });
        }

        return {
            buttons: data
        };
    }
});
},{"../../UI/Code/Tokens/index":128,"../../UI/Code/cursor":129,"./Tray.handlebars":34,"./Tray.less":36,"onclick":13,"ondrag":16,"subview":24}],36:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Tray{background:#F1F0F0;padding:5px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.Tray-Button{display:inline-block;padding:2px 5px;margin:2px 0;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;background:#1075F6;color:#fff;cursor:pointer}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],37:[function(require,module,exports){
var code = require('../UI/Code/Code').spawn();

code.configure({
    terminal: require('../Run/terminal'),
    onError: function() {
        this.trigger('edit');
    }
});

module.exports = code;

},{"../Run/terminal":56,"../UI/Code/Code":57}],38:[function(require,module,exports){
module.exports = require('./Toolbar/Toolbar').spawn();
},{"./Toolbar/Toolbar":32}],39:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, helper;
  buffer += "\n        <li class='FileSystem-file' data-name='";
  if (helper = helpers.name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "'>";
  if (helper = helpers.name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</li>\n    ";
  return buffer;
  }

  buffer += "<ul class='FileSystem-list'>\n    ";
  stack1 = helpers.each.call(depth0, (depth0 && depth0.programs), {hash:{},inverse:self.noop,fn:self.program(1, program1, data),data:data});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</ul>";
  return buffer;
  });
},{"handlebars/runtime":10}],40:[function(require,module,exports){
var subview  = require('subview'),
    click    = require('onclick'),
    _        = require('underscore'),
    programs = require("../../../models/programs"),
    transitionComplete = require('transition-complete');

require('./FileSystem.less');

module.exports = subview('FileSystem', {
    once: function() {
        var self = this;

        click('.FileSystem-file', function() {
            self.trigger('openFile', [this.getAttribute('data-name')]);
        });

        programs.bind('add, remove', function() {
            transitionComplete(function() {
                self.render();
            });
        });
    },
    init: function() {
        var self = this;

        programs.ready(function() {
            self.render();
        });
    },
    data: function() {
        return {
            programs: _.map(programs.list().sort(), function(item) {
                return {
                    name: item.name.replace(/\.[a-zA-Z]+$/, ''),
                    path: item.name
                };
            })
        };
    },
    template: require('./FileSystem.handlebars')
});
},{"../../../models/programs":3,"./FileSystem.handlebars":39,"./FileSystem.less":41,"onclick":13,"subview":24,"transition-complete":25,"underscore":26}],41:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".FileSystem-list{list-style:none;padding:0;margin:0;cursor:pointer}.FileSystem-file{line-height:46px;border-bottom:1px solid #F1F1F1;margin-left:15px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],42:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function";


  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Toolbar)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.FileSystem)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  return buffer;
  });
},{"handlebars/runtime":10}],43:[function(require,module,exports){
var subview = require('subview');

require('./Files.less');

module.exports = subview('Files', {
    template: require('./Files.handlebars'),
    subviews: {
        Toolbar:    require('./Toolbar/Toolbar'),
        FileSystem: require('./FileSystem/FileSystem')
    }
});

},{"./FileSystem/FileSystem":40,"./Files.handlebars":42,"./Files.less":44,"./Toolbar/Toolbar":46,"subview":24}],44:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-FileSystem{position:absolute;top:50px;bottom:0;overflow:auto;width:100%}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],45:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Files-Toolbar-new'>New</button>\n\nTouchScript\n\n<button class='Files-Toolbar-delete'>Delete</button>";
  });
},{"handlebars/runtime":10}],46:[function(require,module,exports){
var Toolbar  = require('../../UI/Toolbar/Toolbar'),
    click    = require('onclick');

require('./Toolbar.less');

module.exports = Toolbar.extend('Files-Toolbar', {
    init: function() {
        var self = this;

        click({
            '.Files-Toolbar-new': function() {
                self.trigger('new');
            },
            '.Files-Toolbar-delete': function() {
                
            }
        });
    },
    template: require('./Toolbar.handlebars')
});

},{"../../UI/Toolbar/Toolbar":133,"./Toolbar.handlebars":45,"./Toolbar.less":47,"onclick":13}],47:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".Files-Toolbar-delete{float:right}.Files-Toolbar-new{float:left}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],48:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function";


  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Toolbar)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.terminal)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  return buffer;
  });
},{"handlebars/runtime":10}],49:[function(require,module,exports){
var subview = require('subview');

require('./Run.less');

module.exports = subview('Run', {
    template: require('./Run.handlebars'),
    subviews: {
        Toolbar:  require('./Toolbar/Toolbar'),
        terminal: require('./terminal')
    }
});

},{"./Run.handlebars":48,"./Run.less":50,"./Toolbar/Toolbar":54,"./terminal":56,"subview":24}],50:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Run-Terminal{position:absolute;top:50px;bottom:0;width:100%;padding:10px;font-family:Consolas,monaco,monospace;-webkit-overflow-scrolling:touch;overflow:auto}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],51:[function(require,module,exports){
var subview = require('subview'),
    key     = require('onkey');

require('./Terminal.less');

module.exports = subview("Run-Terminal", {
    print: function(string) {
        this.$wrapper.append("<div class='Terminal-line'>"+string+"</div>");
    },
    prompt: function(string, callback) {
        var $input = $("<input type='text' class='Terminal-prompt-input' />");

        $("<div class='Terminal-prompt'>"+string+": </div>")
            .append($input)
            .appendTo(this.$wrapper);
        
        key($input).down({
            'enter': function() {
                callback($input.val());
                this.destroy();
            }
        });
    },
    clear: function() {
        this.html('');
        return this;
    }
});

},{"./Terminal.less":52,"onkey":18,"subview":24}],52:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],53:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Run-Toolbar-exit'>Exit</button>\n";
  });
},{"handlebars/runtime":10}],54:[function(require,module,exports){
var Toolbar  = require('../../UI/Toolbar/Toolbar'),
    click    = require('onclick'),
    code     = require('../../Editor/code');

require('./Toolbar.less');

module.exports = Toolbar.extend('Run-Toolbar', {
    init: function() {
        var self = this;

        click({
            '.Run-Toolbar-exit': function() {
                code.kill();
                self.trigger('edit');
            }
        });
    },
    template: require('./Toolbar.handlebars')
});

},{"../../Editor/code":37,"../../UI/Toolbar/Toolbar":133,"./Toolbar.handlebars":53,"./Toolbar.less":55,"onclick":13}],55:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".Run-Toolbar-exit{float:left}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],56:[function(require,module,exports){
module.exports = require('./Terminal/Terminal').spawn();

},{"./Terminal/Terminal":51}],57:[function(require,module,exports){
var Block       = require('./Components/Block'),
    Environment = require('./Components/EnvironmentModel'),
    _           = require('underscore'),
    nop         = require('nop');

require('./Code.less');

module.exports = Block.extend('Code', {
    listeners: {
        'down:error': function() {
            this.onError.apply(this, arguments);
        }
    },
    init: function() {
        this.environment = new Environment();
        this.focus();
    },
    configure: function(config) {
        this.terminal = config.terminal || null;
        this.onError  = config.onError  || noop;
        return this;
    },
    beforeRun: function() {
        this.running = true;
        this.environment.clear();
    },
    kill: function() {
        this.running = false;
    },
    dump: function() {
        return _.extend(this.super.dump.apply(this), {
            version: "0.0.1"
        });
    },

    /*** Events ***/
    onError: nop
});

},{"./Code.less":58,"./Components/Block":59,"./Components/EnvironmentModel":61,"nop":12,"underscore":26}],58:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code{overflow:auto;-webkit-overflow-scrolling:touch;font-family:Consolas,monaco,monospace;line-height:1.6em;-webkit-tap-highlight-color:rgba(0,0,0,0);-moz-user-select:none;-ms-user-select:none;-khtml-user-select:none;-webkit-user-select:none;-o-user-select:none;user-select:none}.subview-Code-Line{min-height:1.6em}[contenteditable=true]{-moz-user-select:text;-ms-user-select:text;-khtml-user-select:text;-webkit-user-select:text;-o-user-select:text;user-select:text}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],59:[function(require,module,exports){
var subview     = require('subview'),
    cursor      = require('../cursor'),
    Line        = require('./Line'),
    _           = require('underscore');

require('./Block.less');

module.exports = subview('Code-Block', {
    listeners: {
        'down:paste:Code-Cursor': function() {
            var last = subview(this.$wrapper.children().last());

            if(!last.isEmpty()) {
                this.addLine();
            }

            return false;
        }
    },
    init: function() {
        this.empty();
    },
    addLine: function(content) {
        var line = Line.spawn();

        if(content) {
            line.load(content);
        }

        this.$wrapper.append(line.$wrapper);
        return line;
    },
    focus: function() {
        subview(this.$wrapper.children().last()).focus();
    },
    beforeRun: function() {},
    run: function() {
        this.beforeRun();

        //Run every line asyncronously
        var children = this.$wrapper.children(),
            i   = 0,
            len = children.length;

        (function loop() {
            subview(children[i]).run(function() {
                if(i < len) {
                    i++;
                    loop();
                }
            });
        })();
    },
    dump: function() {
        return {
            type:  this.type,
            lines: _.map(this.$wrapper.children('.subview-Code-Line'), function(child) {
                return subview(child).dump();
            })
        };
    },
    empty: function() {
        this.html('');
        this.addLine();
    },
    load: function(file) {
        this.html('');
        console.log(file);
        
        for(var i=0; i<file.lines.length; i++) {
            this.addLine(file.lines[i]);
        }
    }
});

},{"../cursor":129,"./Block.less":60,"./Line":64,"subview":24,"underscore":26}],60:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Block{background:rgba(255,255,255,.36);-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px;color:#111}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],61:[function(require,module,exports){
var Environment = function() {
    this.clear();
};

Environment.prototype = {
    clear: function() {
        this.vars = {};
    },
    set: function(name, value) {
        this.vars[name] = value;
    },
    get: function(name) {
        return this.vars[name];
    }
};

module.exports = Environment;
},{}],62:[function(require,module,exports){
var subview = require('subview'),
    cursor  = require('../cursor'),
    click   = require('onclick'),
    _       = require('underscore');

require('./Field.less');

click('.subview-Code-Field', function(e) {
    subview(this).focus();
});

module.exports = subview('Code-Field', {
    focus: function() {
        cursor.appendTo(this.$wrapper);
        return this;
    },
    $getTokens: function() {
        return this.$wrapper.children('.subview-Code-Token');
    },
    run: function(callback) {
        var stack = [],
            token,
            prev,
            next;

        //Get Tokens
        var $tokens = this.$getTokens();

        //Ignore Empty Lines
        if($tokens.length === 0) {
            return;
        }
        //Special Case for one async token (for & while loops)
        else if($tokens.length === 1) {
            token = subview($tokens[0]);

            if(token.isAsync) {
                token.run(function(result) {
                    if(callback) {
                        callback(result);
                    }
                });

                return;
            }
        }

        //Build Stack
        for(var i=0; i<$tokens.length; i++) {
            token = subview($tokens[i]);

            if(token.isOperator) {
                stack.push(token);
            }
            else if(token.isLiteral) {
                //++ and -- that must operate on the raw variable
                next = subview($tokens[i + 1]);
                if(token && token.isVar && next.isVarOperator) {
                    stack.push(next.run(token));
                    i++;
                }
                else {
                    stack.push(token.val());
                }
            }
            else if(token.isToken) {
                stack.push(token.run());
            }
            else if(token.type != 'Code-Cursor') {
                console.error("Token not recognized");
            }
        }

        //Reduce operators
        var maxPrecedence = 5 + 1;
        while(maxPrecedence-- && stack.length > 1) {
            for(i=0; i<stack.length; i++) {
                token = stack[i];

                //Null tokens should be discarded
                //They are returned when a statement cancels its self out like NOT NOT or --4
                if(token && token.isNull) {
                    stack.splice(i, 1);
                    i--;
                }
                else if(token && token.isOperator && (typeof token.precedence == 'function' ? token.precedence(stack, i) : token.precedence) == maxPrecedence) {
                    //Operators like NOT that only operate on the token after
                    if(token.isSingleOperator) {
                        stack.splice(i, 2, token.run(stack[i + 1]));
                        i--;
                    }
                    //Standard operators that operate on token before and after
                    else {
                        prev = stack[i - 1];
                        next = stack[i + 1];

                        if(i === 0) {
                            token.error('No left-side for ' + token.template);
                            return;
                        }
                        else if(i == stack.length - 1) {
                            token.error('No right-side for ' + token.template);
                            return;
                        }
                        else if(prev && prev.isOperator) {
                            token.error('Invalid right-side for ' + token.template);
                        }
                        else if(next && next.isOperator) {
                            token.error('Invalid left-side for ' + token.template);
                        }
                        else {
                            stack.splice(i - 1, 3, token.run(prev, next));
                            i--;
                        }
                    }
                }
            }
        }

        //The stack should reduce to exactly one literal
        if(stack.length !== 1) {
            this.error("Syntax Error");
        }
        else {
            if(callback) {
                callback(stack[0]);
            }

            return stack[0];
        }
    },
    error: require('./error'),
    dump: function() {
        return {
            type:   this.type,
            tokens: _.map(this.$getTokens(), function(token) {
                return subview(token).dump();
            })
        };
    },
    load: function(file) {
        for(var i=0; i<file.tokens.length; i++) {
            var token = subview.lookup(file.tokens[i].type);

            token = token.spawn();
            token.load(file.tokens[i]);

            this.$wrapper.append(token.$wrapper);
        }
    }
});

},{"../cursor":129,"./Field.less":63,"./error":66,"onclick":13,"subview":24,"underscore":26}],63:[function(require,module,exports){
module.exports=require(52)
},{}],64:[function(require,module,exports){
var Field = require('./Field');

require('./Line.less');

module.exports = Field.extend('Code-Line', {
    isEmpty: function() {
        return this.$wrapper.children('.subview-Code-Token').length === 0;
    }
});

},{"./Field":62,"./Line.less":65}],65:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code{counter-reset:lineNumber}.subview-Code-Line{position:relative;padding-left:30px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.subview-Code-Line:before{font-family:Consolas,monaco,monospace;counter-increment:lineNumber;content:counter(lineNumber);position:absolute;height:100%;width:34px;left:-4px;padding-left:8px;padding-top:.1em;background:rgba(241,240,240,.53);border-right:1px solid rgba(0,0,0,.15);color:#555;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],66:[function(require,module,exports){
var Tooltip = require('../../Tooltip/Tooltip'),
    subview = require('subview'),
    click   = require('onclick');

require("./error.less");

var Err = Tooltip.extend('Code-Error', {
        init: function() {
            this.$arrow.addClass('Code-Error-arrow');
        }
    }),
    error;

click.anywhere(function() {
    if(error) {
        error.remove();
    }
});

module.exports = function(msg) {
    var self = this;

    this.trigger('error', [this, msg]);

    if(error) {
        error.remove();
    }
    
    //Wait for animation
    setTimeout(function() {
        error = Err.spawn({
            msg:  msg,
            $el:  self.$wrapper
        });
    }, 300);
    
    return error;
};

},{"../../Tooltip/Tooltip":136,"./error.less":67,"onclick":13,"subview":24}],67:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Error{background:#f70000;color:#fff;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;padding:2px 6px}.Code-Error-arrow{background:#f70000}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],68:[function(require,module,exports){
var Field = require('../Components/Field');
require('./Argument.less');

module.exports = Field.extend('Code-Argument', {
    init: function(config) {
        config = config || {};
        
        this.name = config.name || "";
        this.type = config.type || null;
    },
    template: "\u200B",
    tagName: 'span'
});

},{"../Components/Field":62,"./Argument.less":69}],69:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Argument{background:rgba(255,255,255,.5);padding:.3em}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],70:[function(require,module,exports){
var Token       = require('../Token'),
    Argument    = require('../Argument'),
    Var         = require('../Literals/Var/Var'),
    key         = require('onkey');

require('./Assign.less');

//Prevent Enter
key('.Code-Assign-Var').down({
    'enter': function(e) {
        e.preventDefault();
    }
});

module.exports = Token.extend('Code-Assign', {
    init: function() {
        this.name   = Var.spawn();
        this.value  = Argument.spawn();

        this.name.$wrapper.removeClass('view-Code-Token');

        this.$wrapper
            .append(this.name.$wrapper)
            .append(' &rArr; ')
            .append(this.value.$wrapper);
    },
    clean: function() {
        this.html('');
    },
    meta: {
        display: "&rArr;"
    },
    run: function() {
        var value = this.value.run();
        this.name.set(value);
        return value;
    },
    focus: function() {
        this.name.focus();
    },
    dump: function() {
        return {
            type:  this.type,
            name:  this.name.dump(),
            value: this.value.dump()
        };
    },
    load: function(content) {
        console.log(content);
        this.name.load(content.name);
        this.value.load(content.value);
    }
});
},{"../Argument":68,"../Literals/Var/Var":95,"../Token":126,"./Assign.less":71,"onkey":18}],71:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Assign{background:#87F08B;display:inline;padding:.3em 0 .3em 2px;margin:0 2px;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],72:[function(require,module,exports){
var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Components/Block'),
    _        = require('underscore');

require('./Conditional.less');

module.exports = Control.extend('Code-Conditional', {
    init: function() {
        //Define state variables
        this.conditions = [];
        this.elseCondition = null;

        //Add initial conditional
        this.addCondition('if');
    },
    meta: {
        display: 'if',
        name:    'if conditional'
    },
    addCondition: function(type) {
        var condition = {
            block: Block.spawn()
        };

        //Build Condition Objects
        if(type == "else") {
            this.elseCondition = condition;
        }
        else {
            condition.arg = Argument.spawn({
                type: "Conditional"
            });

            this.conditions.push(condition);
        }
        
        //Append to Wrapper
        var $condition = $("<div class='Code-Conditional-Block'>");
            $conditionHeader = $("<div class='Code-Control-Header'>");


        $conditionHeader.append(
            type == "else" ? "else:" :
            type == "else if" ? "else if " :
            type == "if" ? "if " : ""
        );
        
        if(type != "else") {
            $conditionHeader
                .append(condition.arg.$wrapper)
                .append(" then:");
        }
            
        $condition
            .append($conditionHeader)
            .append(condition.block.$wrapper);

        this.$wrapper.append($condition);

        return this;
    },
    run: function() {
        for(var i=0; i<this.conditions.length; i++) {
            var condition = this.conditions[i];

            if(condition.arg.run()) {
                condition.block.run();
                return;
            }
        }

        if(this.elseCondition) {
            this.elseCondition.block.run();
        }

        return;
    },
    focus: function() {
        this.conditions[0].arg.focus();
    },
    dump: function() {
        return {
            type: this.type,
            conditions: _.map(this.conditions, function(condition) {
                return {
                    block: condition.block.dump(),
                    arg:   condition.arg.dump()
                };
            }),
            elseCondition: this.elseCondition.block.dump()
        };
    },
    load: function(content) {

    }
});

},{"../../../Components/Block":59,"../../Argument":68,"../Control":74,"./Conditional.less":73,"underscore":26}],73:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Conditional{background:#BDE2FF;color:#19297C}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],74:[function(require,module,exports){
require('./Control.less');

module.exports = require('../Token').extend('Code-Control', {
    isControl: true,
    
    /*** Should Be Overwritten ***/
    run:    function() {},
    focus:  function() {},
    clean:  function() {
        this.html('');
    },

    /*** Functions ***/
    validatePosition: function(cursor) {
        if(subview(cursor.$wrapper.parent()).type == 'Code-Line') {
            return true;
        }
        else {
            cursor.error('A ' + this.meta.name + ' must go on its own line.');
            return false;
        }
    }
});

},{"../Token":126,"./Control.less":75}],75:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Control{background:#FFB2B2;color:#880A0A;padding:.05em 0 0;display:inline-block;min-width:100%}.Code-Control-Header{padding:2px 4px}.Code-Control-Header .subview-Code-Argument{-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;padding:.3em 2px}.subview-Code-Control .subview-Code-Block{min-width:240px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],76:[function(require,module,exports){
var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Components/Block');

require('./While.less');

module.exports = Control.extend('Code-While', {
    init: function() {
        this.condition = Argument.spawn({
            type: "Condition"
        });

        this.block = Block.spawn();

        //Build the Wrapper
        var $header = $("<div class='Code-Control-Header'>")
            .append("while ")
            .append(this.condition.$wrapper)
            .append(':');
        
        this.$wrapper
            .append($header)
            .append(this.block.$wrapper);
    },
    meta: {
        display: 'while',
        name:    'while loop'
    },
    isAsync: true,
    run: function(callback) {
        var self = this,
            code = this.parent('Code');
        
        var loop = setInterval(function() {
            if(self.condition.run() && code.running) {
                self.block.run();
            }
            else {
                clearInterval(loop);
                callback();
            }
        }, 0);
    },
    focus: function() {
        this.condition.focus();
    },
    dump: function() {
        return {
            type:       this.type,
            condition:  this.condition.dump(),
            block:      this.block.dump()
        };
    },
    load: function(content) {
        this.condition.load(content.condition);
        this.block.load(content.block);
    }
});

},{"../../../Components/Block":59,"../../Argument":68,"../Control":74,"./While.less":77}],77:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-While .Code-Control-Header .subview-Code-Argument{padding:.2em 2px .3em;top:-.05em;position:relative}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],78:[function(require,module,exports){
module.exports = [
    require("./Conditional/Conditional"),
    require("./Loop/While")
];
},{"./Conditional/Conditional":72,"./Loop/While":76}],79:[function(require,module,exports){
var Argument = require('../Argument'),
    cursor   = require('../../cursor'),
    _        = require('underscore');

require('./Function.less');

module.exports = require('../Token').extend('Function', {
    isFunction: true,
    init: function() {
        this.$wrapper.append(this.name+"(");

        this.argumentInstances = [];

        //Parse Arguments
        var i = this.arguments.length;
        while(i--) {
            var arg = Argument.spawn(this.arguments[i]);
            this.argumentInstances.push(arg);

            this.$wrapper.append(arg.$wrapper);
            if(i > 0) {
                this.$wrapper.append(", ");
            }
        }
        
        this.$wrapper.append(")");
    },
    clean: function() {
        this.html('');
    },

    /*** Should Be Overwritten ***/
    name: '',
    //Runs when the function is called
    run: function() {
        
    },
    argument: function(i) {
        return this.argumentInstances[i].run();
    },
    arguments: [],
    focus: function() {
        if(this.argumentInstances.length > 0) {
            this.argumentInstances[0].focus();
        }
        else {
            this.$wrapper.after(cursor);
        }
    },
    dump: function() {
        return {
            type: this.type,
            arguments: _.map(this.argumentInstances, function(arg) {
                return arg.dump();
            })
        };
    },
    load: function(content) {
        var self = this;
        _.each(content.arguments, function(arg, i) {
            self.argumentInstances[i].load(arg);
        });
    }
});

},{"../../cursor":129,"../Argument":68,"../Token":126,"./Function.less":80,"underscore":26}],80:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Function{display:inline;background:#D3FFC5;color:#2C2C2C;padding:.3em;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;margin:0 2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],81:[function(require,module,exports){
var Func = require('../Function');

require('./Parentheses.less');

module.exports = Func.extend('Parentheses', {
    meta: {
        display: '( )'
    },
    run: function() {
        return this.argument(0);
    },
    arguments: [
        {
            type: "Expression"
        }
    ]
});
},{"../Function":79,"./Parentheses.less":82}],82:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Parentheses{color:#000}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],83:[function(require,module,exports){
var Func = require('../Function');

require('./Print.less');

module.exports = Func.extend('print', {
    run: function() {
        var terminal = this.editor().terminal;
        
        if(terminal) {
            terminal.print(this.argument(0));
        }
    },
    arguments: [
        {
            type: "String",
            name: "Message"
        }
    ],
    name: 'print',
    meta: {
        display: 'print( )'
    }
});

},{"../Function":79,"./Print.less":84}],84:[function(require,module,exports){
module.exports=require(52)
},{}],85:[function(require,module,exports){
module.exports = [
    require('./Print/Print'),
    require('./Parentheses/Parentheses')
];

},{"./Parentheses/Parentheses":81,"./Print/Print":83}],86:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-false,.subview-true{color:#FFF;background:#53AEF7;line-height:1.3em;margin:.15em}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],87:[function(require,module,exports){
var Literal = require('../Literal');
require('./Boolean.less');

module.exports = Literal.extend('false', {
    tagName: 'span',
    meta: {
        display: 'false'
    },
    template: "false",
    val: function() {
        return false;
    }
});

},{"../Literal":89,"./Boolean.less":86}],88:[function(require,module,exports){
var Literal = require('../Literal');
require('./Boolean.less');

module.exports = Literal.extend('true', {
    tagName: 'span',
    meta: {
        display: 'true'
    },
    template: "true",
    val: function() {
        return true;
    }
});

},{"../Literal":89,"./Boolean.less":86}],89:[function(require,module,exports){
require('./Literal.less');

module.exports = require('../Token').extend('Literal', {
    isLiteral: true,
    val: function() {}
});

},{"../Token":126,"./Literal.less":90}],90:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Literal{display:inline-block;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;padding:0 4px;margin:0 1px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],91:[function(require,module,exports){
var Literal = require('../Literal');
require('./Number.less');

module.exports = Literal.extend('Code-Number', {
    init: function() {
        this.$input = this.$wrapper.find('.number-input');
    },
    tagName: 'span',
    meta: {
        display: '123'
    },
    template: "<input type='text' pattern='\\d*' class='number-input'/>",
    focus: function() {
        this.$input.focus();
    },
    clean: function() {
        this.$input.html('');
    },
    val: function() {
        return parseFloat(this.$input.val(), 10);
    },
    dump: function() {
        return {
            type:  this.type,
            value: this.val()
        };
    },
    load: function(content) {
        this.$input.val(content.value);
    }
});

},{"../Literal":89,"./Number.less":92}],92:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Number{color:purple}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],93:[function(require,module,exports){
var Literal = require('../Literal'),
    subview = require('subview');

require('./String.less');

module.exports = Literal.extend('Code-String', {
    init: function() {
        this.$input = this.$wrapper.find('.string-input');
    },
    tagName: 'span',
    meta: {
        display: '"abc"'
    },
    template: "&ldquo;<span contenteditable='true' class='string-input'></span>&rdquo;",
    focus: function() {
        this.$input.focus();
    },
    clean: function() {
        this.$input.html('');
    },
    val: function() {
        return this.$input.text();
    },
    dump: function() {
        return {
            type:  this.type,
            value: this.val()
        };
    },
    load: function(content) {
        this.$input.html(content.value);
    }
});

},{"../Literal":89,"./String.less":94,"subview":24}],94:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-String{color:#1B1BD3;background:#FDFDAA;display:inline;padding:.2em}.string-input{line-height:1em}.string-input:focus{outline:0}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],95:[function(require,module,exports){
var Literal = require('../Literal');

require('./Var.less');

module.exports = Literal.extend('Code-Var', {
    isVar: true,
    init: function() {
        this.$name = $("<span contenteditable='true' class='Code-Var-Input' autocorrect='off' autocapitalize='off' />");

        this.$wrapper
            .append(this.$name);
    },
    meta: {
        display: "Var"
    },
    name: function() {
        return this.$name.val();
    },
    set: function(val) {
        this.parent('Code').environment.set(this.name(), val);
        return val;
    },
    val: function() {
        return this.parent('Code').environment.get(this.name());
    },
    focus: function() {
        this.$name.focus();
    },
    dump: function() {
        return {
            type:  this.type,
            value: this.$name.html()
        };
    },
    load: function(content) {
        this.$name.html(content.value);
    }
});
},{"../Literal":89,"./Var.less":96}],96:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Var{background:#A6FF94;color:#1F1F1F;padding:0;line-height:1.3em;margin:.15em}.Code-Var-Input{display:inline-block;min-width:10px;padding:0 5px;background:rgba(255,255,255,.5);text-align:center}.Code-Var-Input:focus{outline:0}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],97:[function(require,module,exports){
module.exports = [
    require('./String/String'),
    require('./Number/Number'),
    require('./Booleans/True'),
    require('./Booleans/False'),
    require('./Var/Var')
];

},{"./Booleans/False":87,"./Booleans/True":88,"./Number/Number":91,"./String/String":93,"./Var/Var":95}],98:[function(require,module,exports){
module.exports = require('./Boolean').extend('AND', {
    template: "AND",
    run: function(first, second) {
        return first && second;
    }
});

},{"./Boolean":99}],99:[function(require,module,exports){
var Operator = require('../Operator');
require('./Boolean.less');

module.exports = Operator.extend('Code-Boolean', {
    precedence: 0
});
},{"../Operator":123,"./Boolean.less":100}],100:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Boolean{color:#FFF;background:#E97FE0}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],101:[function(require,module,exports){
module.exports = require('./Boolean').extend('Code-NOT', {
    isSingleOperator:   true,
    template:           "NOT",
    precedence:         5,
    run: function(exp) {
        if(exp.type == 'NOT') {
            return {
                isNull: true
            };
        }
        else {
            return !exp;
        }
    }
});

},{"./Boolean":99}],102:[function(require,module,exports){
module.exports = require('./Boolean').extend('OR', {
    template: "OR",
    run: function(first, second) {
        return first || second;
    }
});

},{"./Boolean":99}],103:[function(require,module,exports){
module.exports = require('./Boolean').extend('XOR', {
    template: "XOR",
    run: function(first, second) {
        return !first != !second;
    }
});

},{"./Boolean":99}],104:[function(require,module,exports){
module.exports = [
    require('./AND'),
    require('./OR'),
    require('./XOR'),
    require('./NOT')
];

},{"./AND":98,"./NOT":101,"./OR":102,"./XOR":103}],105:[function(require,module,exports){
var Operator = require('../Operator');
require('./Comparator.less');

module.exports = Operator.extend('Code-Comparator', {
    precedence: 1
});
},{"../Operator":123,"./Comparator.less":106}],106:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Comparator{color:#FFF;background:rgba(0,0,0,.75)}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],107:[function(require,module,exports){
module.exports = require('./Comparator').extend('Equals', {
    template: "=",
    run: function(first, second) {
        return first == second;
    }
});

},{"./Comparator":105}],108:[function(require,module,exports){
module.exports = require('./Comparator').extend('GreaterThan', {
    template: ">",
    run: function(first, second) {
        return first > second;
    }
});

},{"./Comparator":105}],109:[function(require,module,exports){
module.exports = require('./Comparator').extend('GreaterThanEquals', {
    template: "&ge;",
    run: function(first, second) {
        return first >= second;
    }
});

},{"./Comparator":105}],110:[function(require,module,exports){
module.exports = require('./Comparator').extend('LessThan', {
    template: "<",
    run: function(first, second) {
        return first < second;
    }
});
},{"./Comparator":105}],111:[function(require,module,exports){
module.exports = require('./Comparator').extend('LessThanEquals', {
    template: "&le;",
    run: function(first, second) {
        return first <= second;
    }
});

},{"./Comparator":105}],112:[function(require,module,exports){
module.exports = [
    require('./GreaterThan'),
    require('./GreaterThanEquals'),
    require('./Equals'),
    require('./LessThanEquals'),
    require('./LessThan')
];
},{"./Equals":107,"./GreaterThan":108,"./GreaterThanEquals":109,"./LessThan":110,"./LessThanEquals":111}],113:[function(require,module,exports){
module.exports = require('./Math').extend('Divide', {
    template: "&frasl;",
    precedence: 3,
    run: function(first, second) {
        return first/second;
    }
});

},{"./Math":115}],114:[function(require,module,exports){
module.exports = require('./Math').extend('Exp', {
    template: "^",
    precedence: 4,
    run: Math.pow
});
},{"./Math":115}],115:[function(require,module,exports){
var Operator = require('../Operator');
require('./Math.less');

module.exports = Operator.extend('Code-Math', {
    
});
},{"../Operator":123,"./Math.less":116}],116:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Code-Math{color:#FFF;background:#FFA45C}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],117:[function(require,module,exports){
module.exports = require('./Math').extend('Minus', {
    template: "-",
    precedence: function(stack, i) {
        if(i === 0 || stack[i - 1].isOperator) {
            this.isSingleOperator = true;
            return 5;
        }
        else {
            return 2;
        }
    },
    run: function(first, second) {

        //Negation Operator
        if(typeof second == 'undefined') {
            if(first.type == 'Minus') {
                return {
                    isNull: true
                };
            }
            else {
                return -first;
            }
        }

        //Minus Operator
        else {
            return first - second;
        }

        this.isSingleOperator = false;
    },
    clean: function() {
        this.isSingleOperator = false;
    }
});

},{"./Math":115}],118:[function(require,module,exports){
var _ = require('underscore');

module.exports = require('./Math').extend('Code-MinusMinus', {
    isVarOperator: true,
    template:   "--",
    precedence: 5,
    run: function(int) {
        if(_.isObject(int) && int.isToken && int.type == 'Code-Var') {
            var val = int.val();

            if(typeof val == 'number') {
                val--;
                return int.set(val);
            }
            else {
                console.warn("-- was used on a variable with non-integer value.");
                return int.val();
            }
        }
        else {
            this.error("-- can only be used on variables.");
        }
    }
});

},{"./Math":115,"underscore":26}],119:[function(require,module,exports){
module.exports = require('./Math').extend('Multiply', {
    template: "&times;",
    precedence: 3,
    run: function(first, second) {
        return first*second;
    }
});

},{"./Math":115}],120:[function(require,module,exports){
module.exports = require('./Math').extend('Plus', {
    template: "+",
    precedence: 2,
    run: function(first, second) {
        return first + second;
    }
});

},{"./Math":115}],121:[function(require,module,exports){
var _ = require('underscore');

module.exports = require('./Math').extend('Code-PlusPlus', {
    isVarOperator: true,
    template:   "++",
    precedence: 5,
    run: function(int) {
        if(_.isObject(int) && int.isToken && int.type == 'Code-Var') {
            var val = int.val();

            if(typeof val == 'number') {
                val++;
                return int.set(val);
            }
            else {
                console.warn("++ was used on a variable with non-integer value.");
                return int.val();
            }
        }
        else {
            this.error("++ can only be used on variables.");
        }
    }
});

},{"./Math":115,"underscore":26}],122:[function(require,module,exports){
module.exports = [
    require('./Exp'),
    require('./Divide'),
    require('./Multiply'),
    require('./Minus'),
    require('./Plus'),
    require('./PlusPlus'),
    require('./MinusMinus')
];

},{"./Divide":113,"./Exp":114,"./Minus":117,"./MinusMinus":118,"./Multiply":119,"./Plus":120,"./PlusPlus":121}],123:[function(require,module,exports){
require('./Operator.less');

module.exports = require('../Token').extend('Operator', {
    isOperator: true,
    tagName: 'span'
});

},{"../Token":126,"./Operator.less":124}],124:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Operator{display:inline-block;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;padding:0 6px;line-height:1.3em;margin:.15em 1px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],125:[function(require,module,exports){
module.exports = require('./Comparators/index').concat(
    require('./Math/index'),
    require('./Boolean/index')
);
},{"./Boolean/index":104,"./Comparators/index":112,"./Math/index":122}],126:[function(require,module,exports){
var subview = require('subview'),
    cursor  = require('../cursor'),
    nop     = require('nop');

require('./Token.less');

module.exports = subview('Code-Token', {
    isToken: true,
    meta: {},
    focus: function() {
        this.$wrapper.after(cursor);
    },
    error: require('../Components/error'),
    validatePosition: function(cursor) {
        return true;
    },
    editor: function() {
        return this.parent('Code');
    },
    dump: function() {
        return {
            type: this.type
        };
    },
    load: nop
});

},{"../Components/error":66,"../cursor":129,"./Token.less":127,"nop":12,"subview":24}],127:[function(require,module,exports){
module.exports=require(52)
},{}],128:[function(require,module,exports){
module.exports = require('./Functions/index').concat(
    require('./Literals/index'),
    require('./Operators/index'),
    require('./Control/index'),
    require('./Assign/Assign')
);
},{"./Assign/Assign":70,"./Control/index":78,"./Functions/index":85,"./Literals/index":97,"./Operators/index":125}],129:[function(require,module,exports){
var subview = require('subview');

require('./cursor.less');

var Cursor = subview('Code-Cursor', {
    init: function() {
        var self = this;

        //TODO: THIS IS WRONG
        $(document).on('focus', 'input, div', function() {
            self.hide();
        });
    },
    paste: function(type) {
        this.show();

        //Get the type
        var Type = subview.lookup(type);

        if(!Type) {
            console.error("Type '"+type+"' does not exist");
        }

        //Validate Position
        if(Type.Subview.prototype.validatePosition(this)) {

            //Paste the function
            var command = Type.spawn();
            
            this.$wrapper.before(command.$wrapper);
            command.focus();
        }

        //Event
        this.trigger('paste');
        
        return this;
    },
    show: function() {
        this.$wrapper.css('display', 'inline-block');
        $(':focus').blur();
    },
    hide: function() {
        this.$wrapper.css('display', 'none');
    },
    appendTo: function($el) {
        this.show();
        $el.append(this.$wrapper);
    },
    error: require('./Components/error')
});

module.exports = Cursor.spawn();

},{"./Components/error":66,"./cursor.less":130,"subview":24}],130:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "@-webkit-keyframes flash{0%,100%{opacity:1}50%{opacity:0}}.subview-Code-Cursor{position:relative;width:2px;height:1.2em;margin:-.1em -1px;top:.25em;background:#1279FC;-webkit-animation:flash 1s infinite}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],131:[function(require,module,exports){
var subview = require('subview'),
    prefix  = require('prefix'),
    $       = require('unopinionate').selector;

require('./Slider.less');

module.exports = subview('Slider', {

    /*** Configuration ***/
    panels:         [],
    defaultPanel:   0,
    speed:          300,

    /*** Core Functionality ***/
    once: function() {
        this.$slider = $("<div class='Slider-Slider'>")
            .appendTo(this.$wrapper);

        //Configure Transitions
        this._setupTransitions();
    },
    render: function() {
        this.panelWidth = 100/this.panels.length;
        
        //Build the panels
        for(var i=0; i<this.panels.length; i++) {
            var panel = this.panels[i],
                subview = panel.content.isSubviewPool ? panel.content.spawn() : panel.content;

            //Configure the Panel
            panel.content   = subview;
            panel.$wrapper  = subview.$wrapper;

            //Add Class
            panel.$wrapper
                .addClass('Slider-Panel')
                .css('width', this.panelWidth + '%');

            //Append
            this.$slider.append(panel.$wrapper);
        }

        //Set Slider Width
        this.$slider.css('width', (this.panels.length*100) + '%');
    },
    init: function() {
        this.show(this.defaultPanel);
    },

    /*** Methods ***/
    show: function(i, callback) {
        if(typeof i == 'string') {
            i = this._getPanelNum(i);
        }

        this.$slider.css(
            prefix.dash('transform'), 
            'translate(-' + (i*this.panelWidth) + '%)'
        );

        this.trigger('slide', [i]);

        if(callback) {
            setTimeout(callback, this.speed);
        }
    },

    /*** Internal Methods ***/
    _getPanelNum: function(name) {
        var i = this.panels.length;
        while(i--) {
            if(this.panels[i].name == name) {
                return i;
            }
        }

        console.error('Panel "'+name+'" is not defined.');
        return 0;
    },
    _setupTransitions: function() {
        this.$slider.css(prefix.dash('transition'), prefix.dash('transform') + ' ' + (this.speed/1000) + 's');
    },
    _removeTransitions: function() {
        this.$slider.css(prefix.dash('transition'), 'none');
    }

});

},{"./Slider.less":132,"prefix":20,"subview":24,"unopinionate":27}],132:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Slider{position:relative;width:100%;height:100%;overflow:hidden}.Slider-Slider{position:absolute;left:0;top:0;height:100%;white-space:nowrap}.Slider-Panel{display:inline-block;position:relative;height:100%;vertical-align:top;white-space:normal}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],133:[function(require,module,exports){
var subview     = require('subview'),
    click    = require('onclick');

require('./Toolbar.less');

module.exports = subview("Toolbar");

},{"./Toolbar.less":134,"onclick":13,"subview":24}],134:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Toolbar{position:absolute;height:50px;width:100%;background:#F1F0F0;border-bottom:solid 1px #CCC;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;padding-top:20px;text-align:center;color:#414141}.subview-Toolbar button{color:#2A90FF;border:0;background:0 0;font-size:15px;outline:0;padding:0 5px;height:100%}.subview-Toolbar button:active{color:#BADBFF}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],135:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  if (helper = helpers.msg) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.msg); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  return escapeExpression(stack1);
  });
},{"handlebars/runtime":10}],136:[function(require,module,exports){
var subview = require('subview'),
    $       = require('unopinionate').selector;

var $body = $('body');

require('./Tooltip.less');

var arrowSpace  = 10,
    arrowOffset = 6,
    margin      = 5;

module.exports = subview('Tooltip', {
    config: function(config) {
        this.msg = config.msg;
    },
    init: function(config) {
        var $el = config.$el,
            $constrain = config.$constrain || $body; //Constraint should always have relative or absolute positioning

        /*** Append to Document ***/
        // Do this here so that the default dimensions show up
        $constrain
            .append(this.$wrapper)
            .append(this.$arrow);

        /*** Get position data ***/
        var el      = $el.offset(),
            con     = $constrain.offset();

        el.width    = $el.outerWidth();
        el.height   = $el.outerHeight();

        con.width   = $constrain.outerWidth();
        con.height  = $constrain.outerHeight();

        var wrapH   = this.$wrapper.outerHeight(),
            wrapW   = this.$wrapper.outerWidth();

        //Get derived position data
        el.mid = el.left + el.width/2;

        /*** Determine vertical position ***/
        var topSpace    = el.top - con.top - margin - arrowSpace,
            bottomSpace = (con.top + con.height) - (el.top + el.height) - margin - arrowSpace,
            top;

        //Put it above the element
        if(topSpace > bottomSpace) {
            if(wrapH > topSpace) {
                wrapH = topSpace;
            }

            top = el.top - wrapH - arrowSpace;

            this.$wrapper.css('top', top);
            this.$arrow.css('top', top + wrapH + arrowOffset);
        }

        //Put it below the element
        else {
            if(wrapH > bottomSpace) {
                wrapH = topSpace;
            }

            top = el.top + el.height + arrowSpace;

            this.$wrapper.css('top', top);
            this.$arrow.css('top', top - arrowOffset);
        }

        this.$wrapper.css('height', wrapH);

        /*** Determine Horizontal Position ***/
        var centerLeft = el.mid - wrapW/2;
        this.$arrow.css('left', el.mid - arrowOffset);
        
        if(centerLeft < con.left) {
            this.$wrapper.css('left', margin);
        }
        else if(centerLeft + wrapW > con.left + con.width) {
            this.$wrapper.css('right', margin);
        }
        else {
            this.$wrapper.css('left', centerLeft);
        }
        
        
    },
    clean: function() {
        this.$arrow.detach();
        this.$wrapper
            .css('height', 'auto')
            .css('left', 'auto')
            .css('right', 'auto');
    },
    template: require('./Tooltip.handlebars'),
    data: function() {
        return {
            msg: this.msg
        };
    },
    $arrow: $("<div class='Tooltip-arrow'>")
});
},{"./Tooltip.handlebars":135,"./Tooltip.less":137,"subview":24,"unopinionate":27}],137:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".subview-Tooltip{position:absolute;max-width:100%;max-height:100%;overflow:auto;z-index:1001}.Tooltip-arrow{position:absolute;-webkit-transform:rotate(45deg);-moz-transform:rotate(45deg);-o-transform:rotate(45deg);-ms-transform:rotate(45deg);transform:rotate(45deg);width:12px;height:12px;z-index:1000}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],138:[function(require,module,exports){
var Slider = require('./UI/Slider/Slider');

require('./main.less');

module.exports = Slider.extend('main', {
    listeners: {
        'down:open': function() {
            this.show('files');
        },
        'down:new, down:openFile, down:edit': function() {
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

},{"./Editor/Editor":29,"./Files/Files":43,"./Run/Run":49,"./UI/Slider/Slider":131,"./main.less":139}],139:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "body,html{height:100%;width:100%}body{-moz-user-select:none;-ms-user-select:none;-khtml-user-select:none;-webkit-user-select:none;-o-user-select:none;user-select:none;margin:0;position:absolute;font-family:Avenir,\"Helvetica Neue\",Helvetica,sans-serif;-webkit-tap-highlight-color:rgba(0,0,0,0)}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}]},{},[1])