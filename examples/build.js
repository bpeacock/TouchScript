(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require("../views/main.js");


},{"../views/main.js":138}],2:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL2dydW50LWJyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9leGFtcGxlcy9leGFtcGxlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L21vZGVscy9GaWxlcy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9tb2RlbHMvcHJvZ3JhbXMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy5ydW50aW1lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvYmFzZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2V4Y2VwdGlvbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3J1bnRpbWUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9zYWZlLXN0cmluZy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3V0aWxzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL3J1bnRpbWUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL2xvZ2xldmVsL2xpYi9sb2dsZXZlbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvbm9wL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9vbmNsaWNrL3NyYy9vbkNsaWNrLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9vbmRyYWcvc3JjL0RyYWcuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL29uZHJhZy9zcmMvRHJvcC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvb25kcmFnL3NyYy9tYWluLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9vbmtleS9zcmMvRXZlbnQuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL29ua2V5L3NyYy9tYWluLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9vbmtleS9zcmMvc3BlY2lhbEtleXMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL3ByZWZpeC9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvc3Vidmlldy9ub2RlX21vZHVsZXMvbG9nbGV2ZWwvbGliL2xvZ2xldmVsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9zdWJ2aWV3L3NyYy9TdWJ2aWV3LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy9zdWJ2aWV3L3NyYy9TdWJ2aWV3UG9vbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvc3Vidmlldy9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC9ub2RlX21vZHVsZXMvdHJhbnNpdGlvbi1jb21wbGV0ZS90cmFuc2l0aW9uLWNvbXBsZXRlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L25vZGVfbW9kdWxlcy91bmRlcnNjb3JlL3VuZGVyc2NvcmUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvbm9kZV9tb2R1bGVzL3Vub3BpbmlvbmF0ZS91bm9waW5pb25hdGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRWRpdG9yL0VkaXRvci5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL0VkaXRvci9FZGl0b3IuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRWRpdG9yL0VkaXRvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL0VkaXRvci9Ub29sYmFyL1Rvb2xiYXIuaGFuZGxlYmFycyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9FZGl0b3IvVG9vbGJhci9Ub29sYmFyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL0VkaXRvci9Ub29sYmFyL1Rvb2xiYXIubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9FZGl0b3IvVHJheS9UcmF5LmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRWRpdG9yL1RyYXkvVHJheS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9FZGl0b3IvVHJheS9UcmF5Lmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRWRpdG9yL2NvZGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRWRpdG9yL3Rvb2xiYXIuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRmlsZXMvRmlsZVN5c3RlbS9GaWxlU3lzdGVtLmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRmlsZXMvRmlsZVN5c3RlbS9GaWxlU3lzdGVtLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL0ZpbGVzL0ZpbGVTeXN0ZW0vRmlsZVN5c3RlbS5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL0ZpbGVzL0ZpbGVzLmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRmlsZXMvRmlsZXMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRmlsZXMvRmlsZXMubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9GaWxlcy9Ub29sYmFyL1Rvb2xiYXIuaGFuZGxlYmFycyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9GaWxlcy9Ub29sYmFyL1Rvb2xiYXIuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvRmlsZXMvVG9vbGJhci9Ub29sYmFyLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvUnVuL1J1bi5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1J1bi9SdW4uanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvUnVuL1J1bi5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1J1bi9UZXJtaW5hbC9UZXJtaW5hbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9SdW4vVGVybWluYWwvVGVybWluYWwubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9SdW4vVG9vbGJhci9Ub29sYmFyLmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvUnVuL1Rvb2xiYXIvVG9vbGJhci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9SdW4vVG9vbGJhci9Ub29sYmFyLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvUnVuL3Rlcm1pbmFsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvQ29kZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL0NvZGUubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL0NvbXBvbmVudHMvQmxvY2suanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Db21wb25lbnRzL0Jsb2NrLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Db21wb25lbnRzL0Vudmlyb25tZW50TW9kZWwuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Db21wb25lbnRzL0ZpZWxkLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9MaW5lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9MaW5lLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Db21wb25lbnRzL2Vycm9yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9lcnJvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0FyZ3VtZW50LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0FyZ3VtZW50Lmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvQXNzaWduL0Fzc2lnbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9Bc3NpZ24vQXNzaWduLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvQ29udHJvbC9Db25kaXRpb25hbC9Db25kaXRpb25hbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9Db250cm9sL0NvbmRpdGlvbmFsL0NvbmRpdGlvbmFsLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvQ29udHJvbC9Db250cm9sLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0NvbnRyb2wvQ29udHJvbC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0NvbnRyb2wvTG9vcC9XaGlsZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9Db250cm9sL0xvb3AvV2hpbGUubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9Db250cm9sL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0Z1bmN0aW9ucy9GdW5jdGlvbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9GdW5jdGlvbnMvRnVuY3Rpb24ubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9GdW5jdGlvbnMvUGFyZW50aGVzZXMvUGFyZW50aGVzZXMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvRnVuY3Rpb25zL1BhcmVudGhlc2VzL1BhcmVudGhlc2VzLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvRnVuY3Rpb25zL1ByaW50L1ByaW50LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0Z1bmN0aW9ucy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9Cb29sZWFucy9Cb29sZWFuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvTGl0ZXJhbHMvQm9vbGVhbnMvRmFsc2UuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvTGl0ZXJhbHMvQm9vbGVhbnMvVHJ1ZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9MaXRlcmFsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL0xpdGVyYWwubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9OdW1iZXIvTnVtYmVyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL051bWJlci9OdW1iZXIubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9TdHJpbmcvU3RyaW5nLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL1N0cmluZy9TdHJpbmcubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9WYXIvVmFyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL1Zhci9WYXIubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9BTkQuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0Jvb2xlYW4vQm9vbGVhbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9Cb29sZWFuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0Jvb2xlYW4vTk9ULmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL09SLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL1hPUi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvQ29tcGFyYXRvci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvQ29tcGFyYXRvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9FcXVhbHMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0NvbXBhcmF0b3JzL0dyZWF0ZXJUaGFuLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9HcmVhdGVyVGhhbkVxdWFscy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvTGVzc1RoYW4uanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0NvbXBhcmF0b3JzL0xlc3NUaGFuRXF1YWxzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9EaXZpZGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvRXhwLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9NYXRoL01hdGguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvTWF0aC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9NYXRoL01pbnVzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9NYXRoL01pbnVzTWludXMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvTXVsdGlwbHkuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvUGx1cy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9QbHVzUGx1cy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvT3BlcmF0b3IuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL09wZXJhdG9yLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL1Rva2VuLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvVG9rZW5zL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvY3Vyc29yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL0NvZGUvY3Vyc29yLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvU2xpZGVyL1NsaWRlci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9TbGlkZXIvU2xpZGVyLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hTY3JpcHQvdmlld3MvVUkvVG9vbGJhci9Ub29sYmFyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL1Rvb2xiYXIvVG9vbGJhci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL1Rvb2x0aXAvVG9vbHRpcC5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL1VJL1Rvb2x0aXAvVG9vbHRpcC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9VSS9Ub29sdGlwL1Rvb2x0aXAubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaFNjcmlwdC92aWV3cy9tYWluLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoU2NyaXB0L3ZpZXdzL21haW4ubGVzcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25MQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy96Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTs7QUNBQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFFQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJyZXF1aXJlKFwiLi4vdmlld3MvbWFpbi5qc1wiKTtcblxuIiwidmFyIF8gICA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSxcbiAgICBsb2cgPSByZXF1aXJlKCdsb2dsZXZlbCcpO1xuXG52YXIgRmlsZXMgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgY29uZmlnID0gY29uZmlnIHx8IHt9O1xuXG4gICAgLyoqKiBDb25maWd1cmUgKioqL1xuICAgIHRoaXMuZXh0ZW5zaW9uID0gXCIuXCIgKyBjb25maWcuZXh0ZW5zaW9uIHx8IFwiXCI7XG5cbiAgICB2YXIgcGFzcyA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9O1xuXG4gICAgdGhpcy5lbmNvZGUgPSBjb25maWcuZW5jb2RlIHx8IHBhc3M7XG4gICAgdGhpcy5kZWNvZGUgPSBjb25maWcuZGVjb2RlIHx8IHBhc3M7XG5cbiAgICAvKioqIEluaXRpYWxpemUgKioqL1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYuaW5pdCgpO1xuICAgIH0sIDEwMDApO1xuXG4gICAgLy9SZWFkeSBGdW5jdGlvbnNcbiAgICB0aGlzLl9yZWFkeUZ1bmNzID0gW107XG4gICAgdGhpcy5fYmluZGluZ3MgICA9IHt9O1xufTtcblxuRmlsZXMucHJvdG90eXBlID0ge1xuXG4gICAgLyoqKiBQdWJsaWMgTWV0aG9kcyAqKiovXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIHJlcXVlc3RGaWxlU3lzdGVtID0gd2luZG93LnJlcXVlc3RGaWxlU3lzdGVtIHx8IHdpbmRvdy53ZWJraXRSZXF1ZXN0RmlsZVN5c3RlbTtcblxuICAgICAgICBpZihyZXF1ZXN0RmlsZVN5c3RlbSkge1xuICAgICAgICAgICAgaWYod2luZG93Lm5hdmlnYXRvci53ZWJraXRQZXJzaXN0ZW50U3RvcmFnZSkge1xuICAgICAgICAgICAgICAgIHdpbmRvdy5uYXZpZ2F0b3Iud2Via2l0UGVyc2lzdGVudFN0b3JhZ2UucmVxdWVzdFF1b3RhKDEwMjQqMTAyNCo1LCBjcmVhdGVGaWxlU3l0ZW0sIGxvZy5lcnJvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVGaWxlU3l0ZW0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGxvZy53YXJuKFwiTm8gbG9jYWwgZmlsZSBzeXN0ZW1cIik7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBjcmVhdGVGaWxlU3l0ZW0oZ3JhbnRlZEJ5dGVzKSB7XG4gICAgICAgICAgICB2YXIgdHlwZSA9IHdpbmRvdy5Mb2NhbEZpbGVTeXN0ZW0gPyB3aW5kb3cuTG9jYWxGaWxlU3lzdGVtLlBFUlNJU1RFTlQgOiB3aW5kb3cuUEVSU0lTVEVOVCxcbiAgICAgICAgICAgICAgICBzaXplID0gZ3JhbnRlZEJ5dGVzIHx8IDA7XG5cbiAgICAgICAgICAgIHJlcXVlc3RGaWxlU3lzdGVtKHR5cGUsIHNpemUsIGZ1bmN0aW9uKGZzKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yb290ID0gZnMucm9vdDtcbiAgICAgICAgICAgICAgICBzZWxmLmRpcmVjdG9yeSA9IGZzLnJvb3QuY3JlYXRlUmVhZGVyKCk7XG5cbiAgICAgICAgICAgICAgICBzZWxmLnN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX2ZpcmVSZWFkeSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSwgbG9nLmVycm9yKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgc3luYzogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgID0gdGhpcyxcbiAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChcIlthLXpfIC1dK1xcXFxcIit0aGlzLmV4dGVuc2lvbiwgXCJpXCIpO1xuXG4gICAgICAgIHRoaXMuZGlyZWN0b3J5LnJlYWRFbnRyaWVzKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIHNlbGYuZGF0YSA9IF8uZmlsdGVyKGRhdGEsIGZ1bmN0aW9uKGZpbGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmlsZS5uYW1lLm1hdGNoKHJlZ2V4KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9LCBsb2cuZXJyb3IpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgbGlzdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEgfHwgW107XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLnJvb3QuZ2V0RmlsZShuYW1lICsgdGhpcy5leHRlbnNpb24sIHt9LCBmdW5jdGlvbihmaWxlRW50cnkpIHtcbiAgICAgICAgICAgIGZpbGVFbnRyeS5maWxlKGZ1bmN0aW9uKGZpbGUpIHtcbiAgICAgICAgICAgICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblxuICAgICAgICAgICAgICAgIHJlYWRlci5vbmxvYWRlbmQgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKHNlbGYuZGVjb2RlKHRoaXMucmVzdWx0KSk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGUpO1xuICAgICAgICAgICAgfSwgbG9nLmVycm9yKTtcbiAgICAgICAgfSwgbG9nLmVycm9yKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24obmFtZSwgY29udGVudCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIG5hbWUgPSBuYW1lICsgdGhpcy5leHRlbnNpb247XG5cbiAgICAgICAgLy9BZGQgVG8gRGF0YSBDYWNoZVxuICAgICAgICBpZighXy5maW5kV2hlcmUodGhpcy5kYXRhLCB7bmFtZTogbmFtZX0pKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGEucHVzaCh7bmFtZTogbmFtZX0pO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdhZGQnKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy5yb290LmdldEZpbGUobmFtZSwge2NyZWF0ZTogdHJ1ZX0sIGZ1bmN0aW9uKGZpbGUpIHtcbiAgICAgICAgICAgIGZpbGUuY3JlYXRlV3JpdGVyKGZ1bmN0aW9uKGZpbGVXcml0ZXIpIHtcbiAgICAgICAgICAgICAgICBmaWxlV3JpdGVyLm9uZXJyb3IgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvZy5lcnJvcignV3JpdGUgZmFpbGVkOiAnICsgZS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgZmlsZVdyaXRlci53cml0ZShuZXcgQmxvYihbc2VsZi5lbmNvZGUoY29udGVudCldLCB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0L3RvdWNoc2NyaXB0J1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0sIGxvZy5lcnJvcik7XG4gICAgICAgIH0sIGxvZy5lcnJvcik7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaSA9IHRoaXMuZGF0YS5pbmRleE9mKG5hbWUpO1xuICAgICAgICBpZihpICE9IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmRhdGEuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKCdyZW1vdmUnKTtcblxuICAgICAgICAgICAgdGhpcy5yb290LmdldEZpbGUobmFtZSwge2NyZWF0ZTogdHJ1ZX0sIGZ1bmN0aW9uKGZpbGUpIHtcbiAgICAgICAgICAgICAgICBmaWxlLnJlbW92ZShmdW5jdGlvbigpIHt9LCBsb2cuZXJyb3IpO1xuICAgICAgICAgICAgfSwgbG9nLmVycm9yKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVhZHk6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX3JlYWR5RnVuY3MucHVzaChjYWxsYmFjayk7XG4gICAgfSxcbiAgICBfZmlyZVJlYWR5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGkgPSB0aGlzLl9yZWFkeUZ1bmNzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICB0aGlzLl9yZWFkeUZ1bmNzW2ldLmFwcGx5KHRoaXMsIFtdKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgYmluZDogZnVuY3Rpb24oZGVmLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgbmFtZXMgPSBkZWYuc3BsaXQoJywnKSxcbiAgICAgICAgICAgIGkgPSBuYW1lcy5sZW5ndGg7XG5cbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IG5hbWVzW2ldLnJlcGxhY2UoLyAvZywgJycpO1xuXG4gICAgICAgICAgICBpZih0aGlzLl9iaW5kaW5nc1tuYW1lXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW25hbWVdLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3NbbmFtZV0gPSBbY2FsbGJhY2tdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHZhciBiaW5kaW5ncyA9IHRoaXMuX2JpbmRpbmdzW25hbWVdO1xuICAgICAgICBpZihiaW5kaW5ncykge1xuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8YmluZGluZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBiaW5kaW5nc1tpXSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBGaWxlczsiLCJ2YXIgRmlsZXMgPSByZXF1aXJlKCcuL0ZpbGVzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IEZpbGVzKHtcbiAgICBleHRlbnNpb246IFwidHNcIixcbiAgICBlbmNvZGU6IEpTT04uc3RyaW5naWZ5LFxuICAgIGRlY29kZTogSlNPTi5wYXJzZVxufSk7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmdsb2JhbHMgSGFuZGxlYmFyczogdHJ1ZSAqL1xudmFyIGJhc2UgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2Jhc2VcIik7XG5cbi8vIEVhY2ggb2YgdGhlc2UgYXVnbWVudCB0aGUgSGFuZGxlYmFycyBvYmplY3QuIE5vIG5lZWQgdG8gc2V0dXAgaGVyZS5cbi8vIChUaGlzIGlzIGRvbmUgdG8gZWFzaWx5IHNoYXJlIGNvZGUgYmV0d2VlbiBjb21tb25qcyBhbmQgYnJvd3NlIGVudnMpXG52YXIgU2FmZVN0cmluZyA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvc2FmZS1zdHJpbmdcIilbXCJkZWZhdWx0XCJdO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvdXRpbHNcIik7XG52YXIgcnVudGltZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvcnVudGltZVwiKTtcblxuLy8gRm9yIGNvbXBhdGliaWxpdHkgYW5kIHVzYWdlIG91dHNpZGUgb2YgbW9kdWxlIHN5c3RlbXMsIG1ha2UgdGhlIEhhbmRsZWJhcnMgb2JqZWN0IGEgbmFtZXNwYWNlXG52YXIgY3JlYXRlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBoYiA9IG5ldyBiYXNlLkhhbmRsZWJhcnNFbnZpcm9ubWVudCgpO1xuXG4gIFV0aWxzLmV4dGVuZChoYiwgYmFzZSk7XG4gIGhiLlNhZmVTdHJpbmcgPSBTYWZlU3RyaW5nO1xuICBoYi5FeGNlcHRpb24gPSBFeGNlcHRpb247XG4gIGhiLlV0aWxzID0gVXRpbHM7XG5cbiAgaGIuVk0gPSBydW50aW1lO1xuICBoYi50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHNwZWMpIHtcbiAgICByZXR1cm4gcnVudGltZS50ZW1wbGF0ZShzcGVjLCBoYik7XG4gIH07XG5cbiAgcmV0dXJuIGhiO1xufTtcblxudmFyIEhhbmRsZWJhcnMgPSBjcmVhdGUoKTtcbkhhbmRsZWJhcnMuY3JlYXRlID0gY3JlYXRlO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEhhbmRsZWJhcnM7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi91dGlsc1wiKTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgVkVSU0lPTiA9IFwiMS4zLjBcIjtcbmV4cG9ydHMuVkVSU0lPTiA9IFZFUlNJT047dmFyIENPTVBJTEVSX1JFVklTSU9OID0gNDtcbmV4cG9ydHMuQ09NUElMRVJfUkVWSVNJT04gPSBDT01QSUxFUl9SRVZJU0lPTjtcbnZhciBSRVZJU0lPTl9DSEFOR0VTID0ge1xuICAxOiAnPD0gMS4wLnJjLjInLCAvLyAxLjAucmMuMiBpcyBhY3R1YWxseSByZXYyIGJ1dCBkb2Vzbid0IHJlcG9ydCBpdFxuICAyOiAnPT0gMS4wLjAtcmMuMycsXG4gIDM6ICc9PSAxLjAuMC1yYy40JyxcbiAgNDogJz49IDEuMC4wJ1xufTtcbmV4cG9ydHMuUkVWSVNJT05fQ0hBTkdFUyA9IFJFVklTSU9OX0NIQU5HRVM7XG52YXIgaXNBcnJheSA9IFV0aWxzLmlzQXJyYXksXG4gICAgaXNGdW5jdGlvbiA9IFV0aWxzLmlzRnVuY3Rpb24sXG4gICAgdG9TdHJpbmcgPSBVdGlscy50b1N0cmluZyxcbiAgICBvYmplY3RUeXBlID0gJ1tvYmplY3QgT2JqZWN0XSc7XG5cbmZ1bmN0aW9uIEhhbmRsZWJhcnNFbnZpcm9ubWVudChoZWxwZXJzLCBwYXJ0aWFscykge1xuICB0aGlzLmhlbHBlcnMgPSBoZWxwZXJzIHx8IHt9O1xuICB0aGlzLnBhcnRpYWxzID0gcGFydGlhbHMgfHwge307XG5cbiAgcmVnaXN0ZXJEZWZhdWx0SGVscGVycyh0aGlzKTtcbn1cblxuZXhwb3J0cy5IYW5kbGViYXJzRW52aXJvbm1lbnQgPSBIYW5kbGViYXJzRW52aXJvbm1lbnQ7SGFuZGxlYmFyc0Vudmlyb25tZW50LnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IEhhbmRsZWJhcnNFbnZpcm9ubWVudCxcblxuICBsb2dnZXI6IGxvZ2dlcixcbiAgbG9nOiBsb2csXG5cbiAgcmVnaXN0ZXJIZWxwZXI6IGZ1bmN0aW9uKG5hbWUsIGZuLCBpbnZlcnNlKSB7XG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcbiAgICAgIGlmIChpbnZlcnNlIHx8IGZuKSB7IHRocm93IG5ldyBFeGNlcHRpb24oJ0FyZyBub3Qgc3VwcG9ydGVkIHdpdGggbXVsdGlwbGUgaGVscGVycycpOyB9XG4gICAgICBVdGlscy5leHRlbmQodGhpcy5oZWxwZXJzLCBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGludmVyc2UpIHsgZm4ubm90ID0gaW52ZXJzZTsgfVxuICAgICAgdGhpcy5oZWxwZXJzW25hbWVdID0gZm47XG4gICAgfVxuICB9LFxuXG4gIHJlZ2lzdGVyUGFydGlhbDogZnVuY3Rpb24obmFtZSwgc3RyKSB7XG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobmFtZSkgPT09IG9iamVjdFR5cGUpIHtcbiAgICAgIFV0aWxzLmV4dGVuZCh0aGlzLnBhcnRpYWxzLCAgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGFydGlhbHNbbmFtZV0gPSBzdHI7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiByZWdpc3RlckRlZmF1bHRIZWxwZXJzKGluc3RhbmNlKSB7XG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdoZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24oYXJnKSB7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIk1pc3NpbmcgaGVscGVyOiAnXCIgKyBhcmcgKyBcIidcIik7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignYmxvY2tIZWxwZXJNaXNzaW5nJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBpbnZlcnNlID0gb3B0aW9ucy5pbnZlcnNlIHx8IGZ1bmN0aW9uKCkge30sIGZuID0gb3B0aW9ucy5mbjtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRleHQpKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICAgIGlmKGNvbnRleHQgPT09IHRydWUpIHtcbiAgICAgIHJldHVybiBmbih0aGlzKTtcbiAgICB9IGVsc2UgaWYoY29udGV4dCA9PT0gZmFsc2UgfHwgY29udGV4dCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgICB9IGVsc2UgaWYgKGlzQXJyYXkoY29udGV4dCkpIHtcbiAgICAgIGlmKGNvbnRleHQubGVuZ3RoID4gMCkge1xuICAgICAgICByZXR1cm4gaW5zdGFuY2UuaGVscGVycy5lYWNoKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmbihjb250ZXh0KTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdlYWNoJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBmbiA9IG9wdGlvbnMuZm4sIGludmVyc2UgPSBvcHRpb25zLmludmVyc2U7XG4gICAgdmFyIGkgPSAwLCByZXQgPSBcIlwiLCBkYXRhO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYgKG9wdGlvbnMuZGF0YSkge1xuICAgICAgZGF0YSA9IGNyZWF0ZUZyYW1lKG9wdGlvbnMuZGF0YSk7XG4gICAgfVxuXG4gICAgaWYoY29udGV4dCAmJiB0eXBlb2YgY29udGV4dCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChpc0FycmF5KGNvbnRleHQpKSB7XG4gICAgICAgIGZvcih2YXIgaiA9IGNvbnRleHQubGVuZ3RoOyBpPGo7IGkrKykge1xuICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBkYXRhLmluZGV4ID0gaTtcbiAgICAgICAgICAgIGRhdGEuZmlyc3QgPSAoaSA9PT0gMCk7XG4gICAgICAgICAgICBkYXRhLmxhc3QgID0gKGkgPT09IChjb250ZXh0Lmxlbmd0aC0xKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldCA9IHJldCArIGZuKGNvbnRleHRbaV0sIHsgZGF0YTogZGF0YSB9KTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gY29udGV4dCkge1xuICAgICAgICAgIGlmKGNvbnRleHQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgaWYoZGF0YSkgeyBcbiAgICAgICAgICAgICAgZGF0YS5rZXkgPSBrZXk7IFxuICAgICAgICAgICAgICBkYXRhLmluZGV4ID0gaTtcbiAgICAgICAgICAgICAgZGF0YS5maXJzdCA9IChpID09PSAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldCA9IHJldCArIGZuKGNvbnRleHRba2V5XSwge2RhdGE6IGRhdGF9KTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihpID09PSAwKXtcbiAgICAgIHJldCA9IGludmVyc2UodGhpcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJldDtcbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2lmJywgZnVuY3Rpb24oY29uZGl0aW9uYWwsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjb25kaXRpb25hbCkpIHsgY29uZGl0aW9uYWwgPSBjb25kaXRpb25hbC5jYWxsKHRoaXMpOyB9XG5cbiAgICAvLyBEZWZhdWx0IGJlaGF2aW9yIGlzIHRvIHJlbmRlciB0aGUgcG9zaXRpdmUgcGF0aCBpZiB0aGUgdmFsdWUgaXMgdHJ1dGh5IGFuZCBub3QgZW1wdHkuXG4gICAgLy8gVGhlIGBpbmNsdWRlWmVyb2Agb3B0aW9uIG1heSBiZSBzZXQgdG8gdHJlYXQgdGhlIGNvbmR0aW9uYWwgYXMgcHVyZWx5IG5vdCBlbXB0eSBiYXNlZCBvbiB0aGVcbiAgICAvLyBiZWhhdmlvciBvZiBpc0VtcHR5LiBFZmZlY3RpdmVseSB0aGlzIGRldGVybWluZXMgaWYgMCBpcyBoYW5kbGVkIGJ5IHRoZSBwb3NpdGl2ZSBwYXRoIG9yIG5lZ2F0aXZlLlxuICAgIGlmICgoIW9wdGlvbnMuaGFzaC5pbmNsdWRlWmVybyAmJiAhY29uZGl0aW9uYWwpIHx8IFV0aWxzLmlzRW1wdHkoY29uZGl0aW9uYWwpKSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5pbnZlcnNlKHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gb3B0aW9ucy5mbih0aGlzKTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCd1bmxlc3MnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICAgIHJldHVybiBpbnN0YW5jZS5oZWxwZXJzWydpZiddLmNhbGwodGhpcywgY29uZGl0aW9uYWwsIHtmbjogb3B0aW9ucy5pbnZlcnNlLCBpbnZlcnNlOiBvcHRpb25zLmZuLCBoYXNoOiBvcHRpb25zLmhhc2h9KTtcbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3dpdGgnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYgKCFVdGlscy5pc0VtcHR5KGNvbnRleHQpKSByZXR1cm4gb3B0aW9ucy5mbihjb250ZXh0KTtcbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2xvZycsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgbGV2ZWwgPSBvcHRpb25zLmRhdGEgJiYgb3B0aW9ucy5kYXRhLmxldmVsICE9IG51bGwgPyBwYXJzZUludChvcHRpb25zLmRhdGEubGV2ZWwsIDEwKSA6IDE7XG4gICAgaW5zdGFuY2UubG9nKGxldmVsLCBjb250ZXh0KTtcbiAgfSk7XG59XG5cbnZhciBsb2dnZXIgPSB7XG4gIG1ldGhvZE1hcDogeyAwOiAnZGVidWcnLCAxOiAnaW5mbycsIDI6ICd3YXJuJywgMzogJ2Vycm9yJyB9LFxuXG4gIC8vIFN0YXRlIGVudW1cbiAgREVCVUc6IDAsXG4gIElORk86IDEsXG4gIFdBUk46IDIsXG4gIEVSUk9SOiAzLFxuICBsZXZlbDogMyxcblxuICAvLyBjYW4gYmUgb3ZlcnJpZGRlbiBpbiB0aGUgaG9zdCBlbnZpcm9ubWVudFxuICBsb2c6IGZ1bmN0aW9uKGxldmVsLCBvYmopIHtcbiAgICBpZiAobG9nZ2VyLmxldmVsIDw9IGxldmVsKSB7XG4gICAgICB2YXIgbWV0aG9kID0gbG9nZ2VyLm1ldGhvZE1hcFtsZXZlbF07XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnICYmIGNvbnNvbGVbbWV0aG9kXSkge1xuICAgICAgICBjb25zb2xlW21ldGhvZF0uY2FsbChjb25zb2xlLCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcbmV4cG9ydHMubG9nZ2VyID0gbG9nZ2VyO1xuZnVuY3Rpb24gbG9nKGxldmVsLCBvYmopIHsgbG9nZ2VyLmxvZyhsZXZlbCwgb2JqKTsgfVxuXG5leHBvcnRzLmxvZyA9IGxvZzt2YXIgY3JlYXRlRnJhbWUgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgdmFyIG9iaiA9IHt9O1xuICBVdGlscy5leHRlbmQob2JqLCBvYmplY3QpO1xuICByZXR1cm4gb2JqO1xufTtcbmV4cG9ydHMuY3JlYXRlRnJhbWUgPSBjcmVhdGVGcmFtZTsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGVycm9yUHJvcHMgPSBbJ2Rlc2NyaXB0aW9uJywgJ2ZpbGVOYW1lJywgJ2xpbmVOdW1iZXInLCAnbWVzc2FnZScsICduYW1lJywgJ251bWJlcicsICdzdGFjayddO1xuXG5mdW5jdGlvbiBFeGNlcHRpb24obWVzc2FnZSwgbm9kZSkge1xuICB2YXIgbGluZTtcbiAgaWYgKG5vZGUgJiYgbm9kZS5maXJzdExpbmUpIHtcbiAgICBsaW5lID0gbm9kZS5maXJzdExpbmU7XG5cbiAgICBtZXNzYWdlICs9ICcgLSAnICsgbGluZSArICc6JyArIG5vZGUuZmlyc3RDb2x1bW47XG4gIH1cblxuICB2YXIgdG1wID0gRXJyb3IucHJvdG90eXBlLmNvbnN0cnVjdG9yLmNhbGwodGhpcywgbWVzc2FnZSk7XG5cbiAgLy8gVW5mb3J0dW5hdGVseSBlcnJvcnMgYXJlIG5vdCBlbnVtZXJhYmxlIGluIENocm9tZSAoYXQgbGVhc3QpLCBzbyBgZm9yIHByb3AgaW4gdG1wYCBkb2Vzbid0IHdvcmsuXG4gIGZvciAodmFyIGlkeCA9IDA7IGlkeCA8IGVycm9yUHJvcHMubGVuZ3RoOyBpZHgrKykge1xuICAgIHRoaXNbZXJyb3JQcm9wc1tpZHhdXSA9IHRtcFtlcnJvclByb3BzW2lkeF1dO1xuICB9XG5cbiAgaWYgKGxpbmUpIHtcbiAgICB0aGlzLmxpbmVOdW1iZXIgPSBsaW5lO1xuICAgIHRoaXMuY29sdW1uID0gbm9kZS5maXJzdENvbHVtbjtcbiAgfVxufVxuXG5FeGNlcHRpb24ucHJvdG90eXBlID0gbmV3IEVycm9yKCk7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gRXhjZXB0aW9uOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHNcIik7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBDT01QSUxFUl9SRVZJU0lPTiA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuQ09NUElMRVJfUkVWSVNJT047XG52YXIgUkVWSVNJT05fQ0hBTkdFUyA9IHJlcXVpcmUoXCIuL2Jhc2VcIikuUkVWSVNJT05fQ0hBTkdFUztcblxuZnVuY3Rpb24gY2hlY2tSZXZpc2lvbihjb21waWxlckluZm8pIHtcbiAgdmFyIGNvbXBpbGVyUmV2aXNpb24gPSBjb21waWxlckluZm8gJiYgY29tcGlsZXJJbmZvWzBdIHx8IDEsXG4gICAgICBjdXJyZW50UmV2aXNpb24gPSBDT01QSUxFUl9SRVZJU0lPTjtcblxuICBpZiAoY29tcGlsZXJSZXZpc2lvbiAhPT0gY3VycmVudFJldmlzaW9uKSB7XG4gICAgaWYgKGNvbXBpbGVyUmV2aXNpb24gPCBjdXJyZW50UmV2aXNpb24pIHtcbiAgICAgIHZhciBydW50aW1lVmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW2N1cnJlbnRSZXZpc2lvbl0sXG4gICAgICAgICAgY29tcGlsZXJWZXJzaW9ucyA9IFJFVklTSU9OX0NIQU5HRVNbY29tcGlsZXJSZXZpc2lvbl07XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGVtcGxhdGUgd2FzIHByZWNvbXBpbGVkIHdpdGggYW4gb2xkZXIgdmVyc2lvbiBvZiBIYW5kbGViYXJzIHRoYW4gdGhlIGN1cnJlbnQgcnVudGltZS4gXCIrXG4gICAgICAgICAgICBcIlBsZWFzZSB1cGRhdGUgeW91ciBwcmVjb21waWxlciB0byBhIG5ld2VyIHZlcnNpb24gKFwiK3J1bnRpbWVWZXJzaW9ucytcIikgb3IgZG93bmdyYWRlIHlvdXIgcnVudGltZSB0byBhbiBvbGRlciB2ZXJzaW9uIChcIitjb21waWxlclZlcnNpb25zK1wiKS5cIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFVzZSB0aGUgZW1iZWRkZWQgdmVyc2lvbiBpbmZvIHNpbmNlIHRoZSBydW50aW1lIGRvZXNuJ3Qga25vdyBhYm91dCB0aGlzIHJldmlzaW9uIHlldFxuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGEgbmV3ZXIgdmVyc2lvbiBvZiBIYW5kbGViYXJzIHRoYW4gdGhlIGN1cnJlbnQgcnVudGltZS4gXCIrXG4gICAgICAgICAgICBcIlBsZWFzZSB1cGRhdGUgeW91ciBydW50aW1lIHRvIGEgbmV3ZXIgdmVyc2lvbiAoXCIrY29tcGlsZXJJbmZvWzFdK1wiKS5cIik7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydHMuY2hlY2tSZXZpc2lvbiA9IGNoZWNrUmV2aXNpb247Ly8gVE9ETzogUmVtb3ZlIHRoaXMgbGluZSBhbmQgYnJlYWsgdXAgY29tcGlsZVBhcnRpYWxcblxuZnVuY3Rpb24gdGVtcGxhdGUodGVtcGxhdGVTcGVjLCBlbnYpIHtcbiAgaWYgKCFlbnYpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiTm8gZW52aXJvbm1lbnQgcGFzc2VkIHRvIHRlbXBsYXRlXCIpO1xuICB9XG5cbiAgLy8gTm90ZTogVXNpbmcgZW52LlZNIHJlZmVyZW5jZXMgcmF0aGVyIHRoYW4gbG9jYWwgdmFyIHJlZmVyZW5jZXMgdGhyb3VnaG91dCB0aGlzIHNlY3Rpb24gdG8gYWxsb3dcbiAgLy8gZm9yIGV4dGVybmFsIHVzZXJzIHRvIG92ZXJyaWRlIHRoZXNlIGFzIHBzdWVkby1zdXBwb3J0ZWQgQVBJcy5cbiAgdmFyIGludm9rZVBhcnRpYWxXcmFwcGVyID0gZnVuY3Rpb24ocGFydGlhbCwgbmFtZSwgY29udGV4dCwgaGVscGVycywgcGFydGlhbHMsIGRhdGEpIHtcbiAgICB2YXIgcmVzdWx0ID0gZW52LlZNLmludm9rZVBhcnRpYWwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHsgcmV0dXJuIHJlc3VsdDsgfVxuXG4gICAgaWYgKGVudi5jb21waWxlKSB7XG4gICAgICB2YXIgb3B0aW9ucyA9IHsgaGVscGVyczogaGVscGVycywgcGFydGlhbHM6IHBhcnRpYWxzLCBkYXRhOiBkYXRhIH07XG4gICAgICBwYXJ0aWFsc1tuYW1lXSA9IGVudi5jb21waWxlKHBhcnRpYWwsIHsgZGF0YTogZGF0YSAhPT0gdW5kZWZpbmVkIH0sIGVudik7XG4gICAgICByZXR1cm4gcGFydGlhbHNbbmFtZV0oY29udGV4dCwgb3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUaGUgcGFydGlhbCBcIiArIG5hbWUgKyBcIiBjb3VsZCBub3QgYmUgY29tcGlsZWQgd2hlbiBydW5uaW5nIGluIHJ1bnRpbWUtb25seSBtb2RlXCIpO1xuICAgIH1cbiAgfTtcblxuICAvLyBKdXN0IGFkZCB3YXRlclxuICB2YXIgY29udGFpbmVyID0ge1xuICAgIGVzY2FwZUV4cHJlc3Npb246IFV0aWxzLmVzY2FwZUV4cHJlc3Npb24sXG4gICAgaW52b2tlUGFydGlhbDogaW52b2tlUGFydGlhbFdyYXBwZXIsXG4gICAgcHJvZ3JhbXM6IFtdLFxuICAgIHByb2dyYW06IGZ1bmN0aW9uKGksIGZuLCBkYXRhKSB7XG4gICAgICB2YXIgcHJvZ3JhbVdyYXBwZXIgPSB0aGlzLnByb2dyYW1zW2ldO1xuICAgICAgaWYoZGF0YSkge1xuICAgICAgICBwcm9ncmFtV3JhcHBlciA9IHByb2dyYW0oaSwgZm4sIGRhdGEpO1xuICAgICAgfSBlbHNlIGlmICghcHJvZ3JhbVdyYXBwZXIpIHtcbiAgICAgICAgcHJvZ3JhbVdyYXBwZXIgPSB0aGlzLnByb2dyYW1zW2ldID0gcHJvZ3JhbShpLCBmbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gcHJvZ3JhbVdyYXBwZXI7XG4gICAgfSxcbiAgICBtZXJnZTogZnVuY3Rpb24ocGFyYW0sIGNvbW1vbikge1xuICAgICAgdmFyIHJldCA9IHBhcmFtIHx8IGNvbW1vbjtcblxuICAgICAgaWYgKHBhcmFtICYmIGNvbW1vbiAmJiAocGFyYW0gIT09IGNvbW1vbikpIHtcbiAgICAgICAgcmV0ID0ge307XG4gICAgICAgIFV0aWxzLmV4dGVuZChyZXQsIGNvbW1vbik7XG4gICAgICAgIFV0aWxzLmV4dGVuZChyZXQsIHBhcmFtKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSxcbiAgICBwcm9ncmFtV2l0aERlcHRoOiBlbnYuVk0ucHJvZ3JhbVdpdGhEZXB0aCxcbiAgICBub29wOiBlbnYuVk0ubm9vcCxcbiAgICBjb21waWxlckluZm86IG51bGxcbiAgfTtcblxuICByZXR1cm4gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBuYW1lc3BhY2UgPSBvcHRpb25zLnBhcnRpYWwgPyBvcHRpb25zIDogZW52LFxuICAgICAgICBoZWxwZXJzLFxuICAgICAgICBwYXJ0aWFscztcblxuICAgIGlmICghb3B0aW9ucy5wYXJ0aWFsKSB7XG4gICAgICBoZWxwZXJzID0gb3B0aW9ucy5oZWxwZXJzO1xuICAgICAgcGFydGlhbHMgPSBvcHRpb25zLnBhcnRpYWxzO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gdGVtcGxhdGVTcGVjLmNhbGwoXG4gICAgICAgICAgY29udGFpbmVyLFxuICAgICAgICAgIG5hbWVzcGFjZSwgY29udGV4dCxcbiAgICAgICAgICBoZWxwZXJzLFxuICAgICAgICAgIHBhcnRpYWxzLFxuICAgICAgICAgIG9wdGlvbnMuZGF0YSk7XG5cbiAgICBpZiAoIW9wdGlvbnMucGFydGlhbCkge1xuICAgICAgZW52LlZNLmNoZWNrUmV2aXNpb24oY29udGFpbmVyLmNvbXBpbGVySW5mbyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cblxuZXhwb3J0cy50ZW1wbGF0ZSA9IHRlbXBsYXRlO2Z1bmN0aW9uIHByb2dyYW1XaXRoRGVwdGgoaSwgZm4sIGRhdGEgLyosICRkZXB0aCAqLykge1xuICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMyk7XG5cbiAgdmFyIHByb2cgPSBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgW2NvbnRleHQsIG9wdGlvbnMuZGF0YSB8fCBkYXRhXS5jb25jYXQoYXJncykpO1xuICB9O1xuICBwcm9nLnByb2dyYW0gPSBpO1xuICBwcm9nLmRlcHRoID0gYXJncy5sZW5ndGg7XG4gIHJldHVybiBwcm9nO1xufVxuXG5leHBvcnRzLnByb2dyYW1XaXRoRGVwdGggPSBwcm9ncmFtV2l0aERlcHRoO2Z1bmN0aW9uIHByb2dyYW0oaSwgZm4sIGRhdGEpIHtcbiAgdmFyIHByb2cgPSBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICByZXR1cm4gZm4oY29udGV4dCwgb3B0aW9ucy5kYXRhIHx8IGRhdGEpO1xuICB9O1xuICBwcm9nLnByb2dyYW0gPSBpO1xuICBwcm9nLmRlcHRoID0gMDtcbiAgcmV0dXJuIHByb2c7XG59XG5cbmV4cG9ydHMucHJvZ3JhbSA9IHByb2dyYW07ZnVuY3Rpb24gaW52b2tlUGFydGlhbChwYXJ0aWFsLCBuYW1lLCBjb250ZXh0LCBoZWxwZXJzLCBwYXJ0aWFscywgZGF0YSkge1xuICB2YXIgb3B0aW9ucyA9IHsgcGFydGlhbDogdHJ1ZSwgaGVscGVyczogaGVscGVycywgcGFydGlhbHM6IHBhcnRpYWxzLCBkYXRhOiBkYXRhIH07XG5cbiAgaWYocGFydGlhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBmb3VuZFwiKTtcbiAgfSBlbHNlIGlmKHBhcnRpYWwgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIHJldHVybiBwYXJ0aWFsKGNvbnRleHQsIG9wdGlvbnMpO1xuICB9XG59XG5cbmV4cG9ydHMuaW52b2tlUGFydGlhbCA9IGludm9rZVBhcnRpYWw7ZnVuY3Rpb24gbm9vcCgpIHsgcmV0dXJuIFwiXCI7IH1cblxuZXhwb3J0cy5ub29wID0gbm9vcDsiLCJcInVzZSBzdHJpY3RcIjtcbi8vIEJ1aWxkIG91dCBvdXIgYmFzaWMgU2FmZVN0cmluZyB0eXBlXG5mdW5jdGlvbiBTYWZlU3RyaW5nKHN0cmluZykge1xuICB0aGlzLnN0cmluZyA9IHN0cmluZztcbn1cblxuU2FmZVN0cmluZy5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIFwiXCIgKyB0aGlzLnN0cmluZztcbn07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gU2FmZVN0cmluZzsiLCJcInVzZSBzdHJpY3RcIjtcbi8qanNoaW50IC1XMDA0ICovXG52YXIgU2FmZVN0cmluZyA9IHJlcXVpcmUoXCIuL3NhZmUtc3RyaW5nXCIpW1wiZGVmYXVsdFwiXTtcblxudmFyIGVzY2FwZSA9IHtcbiAgXCImXCI6IFwiJmFtcDtcIixcbiAgXCI8XCI6IFwiJmx0O1wiLFxuICBcIj5cIjogXCImZ3Q7XCIsXG4gICdcIic6IFwiJnF1b3Q7XCIsXG4gIFwiJ1wiOiBcIiYjeDI3O1wiLFxuICBcImBcIjogXCImI3g2MDtcIlxufTtcblxudmFyIGJhZENoYXJzID0gL1smPD5cIidgXS9nO1xudmFyIHBvc3NpYmxlID0gL1smPD5cIidgXS87XG5cbmZ1bmN0aW9uIGVzY2FwZUNoYXIoY2hyKSB7XG4gIHJldHVybiBlc2NhcGVbY2hyXSB8fCBcIiZhbXA7XCI7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZChvYmosIHZhbHVlKSB7XG4gIGZvcih2YXIga2V5IGluIHZhbHVlKSB7XG4gICAgaWYoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCBrZXkpKSB7XG4gICAgICBvYmpba2V5XSA9IHZhbHVlW2tleV07XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydHMuZXh0ZW5kID0gZXh0ZW5kO3ZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5leHBvcnRzLnRvU3RyaW5nID0gdG9TdHJpbmc7XG4vLyBTb3VyY2VkIGZyb20gbG9kYXNoXG4vLyBodHRwczovL2dpdGh1Yi5jb20vYmVzdGllanMvbG9kYXNoL2Jsb2IvbWFzdGVyL0xJQ0VOU0UudHh0XG52YXIgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG59O1xuLy8gZmFsbGJhY2sgZm9yIG9sZGVyIHZlcnNpb25zIG9mIENocm9tZSBhbmQgU2FmYXJpXG5pZiAoaXNGdW5jdGlvbigveC8pKSB7XG4gIGlzRnVuY3Rpb24gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG4gIH07XG59XG52YXIgaXNGdW5jdGlvbjtcbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSA/IHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nIDogZmFsc2U7XG59O1xuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gZXNjYXBlRXhwcmVzc2lvbihzdHJpbmcpIHtcbiAgLy8gZG9uJ3QgZXNjYXBlIFNhZmVTdHJpbmdzLCBzaW5jZSB0aGV5J3JlIGFscmVhZHkgc2FmZVxuICBpZiAoc3RyaW5nIGluc3RhbmNlb2YgU2FmZVN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcudG9TdHJpbmcoKTtcbiAgfSBlbHNlIGlmICghc3RyaW5nICYmIHN0cmluZyAhPT0gMCkge1xuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgLy8gRm9yY2UgYSBzdHJpbmcgY29udmVyc2lvbiBhcyB0aGlzIHdpbGwgYmUgZG9uZSBieSB0aGUgYXBwZW5kIHJlZ2FyZGxlc3MgYW5kXG4gIC8vIHRoZSByZWdleCB0ZXN0IHdpbGwgZG8gdGhpcyB0cmFuc3BhcmVudGx5IGJlaGluZCB0aGUgc2NlbmVzLCBjYXVzaW5nIGlzc3VlcyBpZlxuICAvLyBhbiBvYmplY3QncyB0byBzdHJpbmcgaGFzIGVzY2FwZWQgY2hhcmFjdGVycyBpbiBpdC5cbiAgc3RyaW5nID0gXCJcIiArIHN0cmluZztcblxuICBpZighcG9zc2libGUudGVzdChzdHJpbmcpKSB7IHJldHVybiBzdHJpbmc7IH1cbiAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKGJhZENoYXJzLCBlc2NhcGVDaGFyKTtcbn1cblxuZXhwb3J0cy5lc2NhcGVFeHByZXNzaW9uID0gZXNjYXBlRXhwcmVzc2lvbjtmdW5jdGlvbiBpc0VtcHR5KHZhbHVlKSB7XG4gIGlmICghdmFsdWUgJiYgdmFsdWUgIT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZXhwb3J0cy5pc0VtcHR5ID0gaXNFbXB0eTsiLCIvLyBDcmVhdGUgYSBzaW1wbGUgcGF0aCBhbGlhcyB0byBhbGxvdyBicm93c2VyaWZ5IHRvIHJlc29sdmVcbi8vIHRoZSBydW50aW1lIG9uIGEgc3VwcG9ydGVkIHBhdGguXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vZGlzdC9janMvaGFuZGxlYmFycy5ydW50aW1lJyk7XG4iLCIvKlxuICogbG9nbGV2ZWwgLSBodHRwczovL2dpdGh1Yi5jb20vcGltdGVycnkvbG9nbGV2ZWxcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgVGltIFBlcnJ5XG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gKi9cblxuOyhmdW5jdGlvbiAodW5kZWZpbmVkKSB7XG4gICAgdmFyIHVuZGVmaW5lZFR5cGUgPSBcInVuZGVmaW5lZFwiO1xuXG4gICAgKGZ1bmN0aW9uIChuYW1lLCBkZWZpbml0aW9uKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGRlZmluZShkZWZpbml0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXNbbmFtZV0gPSBkZWZpbml0aW9uKCk7XG4gICAgICAgIH1cbiAgICB9KCdsb2cnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxmID0ge307XG4gICAgICAgIHZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcblxuICAgICAgICBmdW5jdGlvbiByZWFsTWV0aG9kKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY29uc29sZSA9PT0gdW5kZWZpbmVkVHlwZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb25zb2xlW21ldGhvZE5hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29uc29sZS5sb2cgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYm91bmRUb0NvbnNvbGUoY29uc29sZSwgJ2xvZycpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJvdW5kVG9Db25zb2xlKGNvbnNvbGUsIG1ldGhvZE5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gYm91bmRUb0NvbnNvbGUoY29uc29sZSwgbWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgdmFyIG1ldGhvZCA9IGNvbnNvbGVbbWV0aG9kTmFtZV07XG4gICAgICAgICAgICBpZiAobWV0aG9kLmJpbmQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGlmIChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbkJpbmRpbmdXcmFwcGVyKG1ldGhvZCwgY29uc29sZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuYmluZC5jYWxsKGNvbnNvbGVbbWV0aG9kTmFtZV0sIGNvbnNvbGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJbiBJRTggKyBNb2Rlcm5penIsIHRoZSBiaW5kIHNoaW0gd2lsbCByZWplY3QgdGhlIGFib3ZlLCBzbyB3ZSBmYWxsIGJhY2sgdG8gd3JhcHBpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbkJpbmRpbmdXcmFwcGVyKG1ldGhvZCwgY29uc29sZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlW21ldGhvZE5hbWVdLmJpbmQoY29uc29sZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBmdW5jdGlvbkJpbmRpbmdXcmFwcGVyKGYsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYXBwbHkoZiwgW2NvbnRleHQsIGFyZ3VtZW50c10pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsb2dNZXRob2RzID0gW1xuICAgICAgICAgICAgXCJ0cmFjZVwiLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiLFxuICAgICAgICAgICAgXCJpbmZvXCIsXG4gICAgICAgICAgICBcIndhcm5cIixcbiAgICAgICAgICAgIFwiZXJyb3JcIlxuICAgICAgICBdO1xuXG4gICAgICAgIGZ1bmN0aW9uIHJlcGxhY2VMb2dnaW5nTWV0aG9kcyhtZXRob2RGYWN0b3J5KSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgbG9nTWV0aG9kcy5sZW5ndGg7IGlpKyspIHtcbiAgICAgICAgICAgICAgICBzZWxmW2xvZ01ldGhvZHNbaWldXSA9IG1ldGhvZEZhY3RvcnkobG9nTWV0aG9kc1tpaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY29va2llc0F2YWlsYWJsZSgpIHtcbiAgICAgICAgICAgIHJldHVybiAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSAmJlxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuZG9jdW1lbnQgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuZG9jdW1lbnQuY29va2llICE9PSB1bmRlZmluZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gbG9jYWxTdG9yYWdlQXZhaWxhYmxlKCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKHR5cGVvZiB3aW5kb3cgIT09IHVuZGVmaW5lZFR5cGUgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UgIT09IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gcGVyc2lzdExldmVsSWZQb3NzaWJsZShsZXZlbE51bSkge1xuICAgICAgICAgICAgdmFyIGxvY2FsU3RvcmFnZUZhaWwgPSBmYWxzZSxcbiAgICAgICAgICAgICAgICBsZXZlbE5hbWU7XG5cbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBzZWxmLmxldmVscykge1xuICAgICAgICAgICAgICAgIGlmIChzZWxmLmxldmVscy5oYXNPd25Qcm9wZXJ0eShrZXkpICYmIHNlbGYubGV2ZWxzW2tleV0gPT09IGxldmVsTnVtKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsTmFtZSA9IGtleTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobG9jYWxTdG9yYWdlQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgICAgICAvKlxuICAgICAgICAgICAgICAgICAqIFNldHRpbmcgbG9jYWxTdG9yYWdlIGNhbiBjcmVhdGUgYSBET00gMjIgRXhjZXB0aW9uIGlmIHJ1bm5pbmcgaW4gUHJpdmF0ZSBtb2RlXG4gICAgICAgICAgICAgICAgICogaW4gU2FmYXJpLCBzbyBldmVuIGlmIGl0IGlzIGF2YWlsYWJsZSB3ZSBuZWVkIHRvIGNhdGNoIGFueSBlcnJvcnMgd2hlbiB0cnlpbmdcbiAgICAgICAgICAgICAgICAgKiB0byB3cml0ZSB0byBpdFxuICAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2VbJ2xvZ2xldmVsJ10gPSBsZXZlbE5hbWU7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2VGYWlsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZUZhaWwgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobG9jYWxTdG9yYWdlRmFpbCAmJiBjb29raWVzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3cuZG9jdW1lbnQuY29va2llID0gXCJsb2dsZXZlbD1cIiArIGxldmVsTmFtZSArIFwiO1wiO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvb2tpZVJlZ2V4ID0gL2xvZ2xldmVsPShbXjtdKykvO1xuXG4gICAgICAgIGZ1bmN0aW9uIGxvYWRQZXJzaXN0ZWRMZXZlbCgpIHtcbiAgICAgICAgICAgIHZhciBzdG9yZWRMZXZlbDtcblxuICAgICAgICAgICAgaWYgKGxvY2FsU3RvcmFnZUF2YWlsYWJsZSgpKSB7XG4gICAgICAgICAgICAgICAgc3RvcmVkTGV2ZWwgPSB3aW5kb3cubG9jYWxTdG9yYWdlWydsb2dsZXZlbCddO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3RvcmVkTGV2ZWwgPT09IHVuZGVmaW5lZCAmJiBjb29raWVzQXZhaWxhYmxlKCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgY29va2llTWF0Y2ggPSBjb29raWVSZWdleC5leGVjKHdpbmRvdy5kb2N1bWVudC5jb29raWUpIHx8IFtdO1xuICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gY29va2llTWF0Y2hbMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChzZWxmLmxldmVsc1tzdG9yZWRMZXZlbF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gXCJXQVJOXCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHNbc3RvcmVkTGV2ZWxdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qXG4gICAgICAgICAqXG4gICAgICAgICAqIFB1YmxpYyBBUElcbiAgICAgICAgICpcbiAgICAgICAgICovXG5cbiAgICAgICAgc2VsZi5sZXZlbHMgPSB7IFwiVFJBQ0VcIjogMCwgXCJERUJVR1wiOiAxLCBcIklORk9cIjogMiwgXCJXQVJOXCI6IDMsXG4gICAgICAgICAgICBcIkVSUk9SXCI6IDQsIFwiU0lMRU5UXCI6IDV9O1xuXG4gICAgICAgIHNlbGYuc2V0TGV2ZWwgPSBmdW5jdGlvbiAobGV2ZWwpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWwgPT09IFwibnVtYmVyXCIgJiYgbGV2ZWwgPj0gMCAmJiBsZXZlbCA8PSBzZWxmLmxldmVscy5TSUxFTlQpIHtcbiAgICAgICAgICAgICAgICBwZXJzaXN0TGV2ZWxJZlBvc3NpYmxlKGxldmVsKTtcblxuICAgICAgICAgICAgICAgIGlmIChsZXZlbCA9PT0gc2VsZi5sZXZlbHMuU0lMRU5UKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VMb2dnaW5nTWV0aG9kcyhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9vcDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zb2xlID09PSB1bmRlZmluZWRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VMb2dnaW5nTWV0aG9kcyhmdW5jdGlvbiAobWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09IHVuZGVmaW5lZFR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChsZXZlbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGZbbWV0aG9kTmFtZV0uYXBwbHkoc2VsZiwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiTm8gY29uc29sZSBhdmFpbGFibGUgZm9yIGxvZ2dpbmdcIjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMoZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZXZlbCA8PSBzZWxmLmxldmVsc1ttZXRob2ROYW1lLnRvVXBwZXJDYXNlKCldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlYWxNZXRob2QobWV0aG9kTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBsZXZlbCA9PT0gXCJzdHJpbmdcIiAmJiBzZWxmLmxldmVsc1tsZXZlbC50b1VwcGVyQ2FzZSgpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChzZWxmLmxldmVsc1tsZXZlbC50b1VwcGVyQ2FzZSgpXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IFwibG9nLnNldExldmVsKCkgY2FsbGVkIHdpdGggaW52YWxpZCBsZXZlbDogXCIgKyBsZXZlbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBzZWxmLmVuYWJsZUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChzZWxmLmxldmVscy5UUkFDRSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5kaXNhYmxlQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLnNldExldmVsKHNlbGYubGV2ZWxzLlNJTEVOVCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgbG9hZFBlcnNpc3RlZExldmVsKCk7XG4gICAgICAgIHJldHVybiBzZWxmO1xuICAgIH0pKTtcbn0pKCk7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG5vcCgpe31cblxubW9kdWxlLmV4cG9ydHMgPSBub3A7XG4iLCJ2YXIgJCA9IHJlcXVpcmUoJ3Vub3BpbmlvbmF0ZScpLnNlbGVjdG9yO1xuXG52YXIgJGRvY3VtZW50ICAgPSAkKGRvY3VtZW50KSxcbiAgICBiaW5kaW5ncyAgICA9IHt9O1xuXG52YXIgY2xpY2sgPSBmdW5jdGlvbihldmVudHMpIHtcbiAgICBjbGljay5iaW5kLmFwcGx5KGNsaWNrLCBhcmd1bWVudHMpO1xuICAgIHJldHVybiBjbGljaztcbn07XG5cbi8qKiogQ29uZmlndXJhdGlvbiBPcHRpb25zICoqKi9cbmNsaWNrLmRpc3RhbmNlTGltaXQgPSAxMDtcbmNsaWNrLnRpbWVMaW1pdCAgICAgPSAxNDA7XG5cbi8qKiogVXNlZnVsIFByb3BlcnRpZXMgKioqL1xuY2xpY2suaXNUb3VjaCA9ICgnb250b3VjaHN0YXJ0JyBpbiB3aW5kb3cpIHx8XG4gICAgICAgICAgICAgICAgd2luZG93LkRvY3VtZW50VG91Y2ggJiZcbiAgICAgICAgICAgICAgICBkb2N1bWVudCBpbnN0YW5jZW9mIERvY3VtZW50VG91Y2g7XG5cbi8qKiogQ2FjaGVkIEZ1bmN0aW9ucyAqKiovXG52YXIgb25Ub3VjaHN0YXJ0ID0gZnVuY3Rpb24oZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7IC8vUHJldmVudHMgbXVsdGlwbGUgY2xpY2sgZXZlbnRzIGZyb20gaGFwcGVuaW5nXG5cbiAgICBjbGljay5fZG9Bbnl3aGVyZXMoZSk7XG5cbiAgICB2YXIgJHRoaXMgICAgICAgPSAkKHRoaXMpLFxuICAgICAgICBzdGFydFRpbWUgICA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICBzdGFydFBvcyAgICA9IGNsaWNrLl9nZXRQb3MoZSk7XG5cbiAgICAkdGhpcy5vbmUoJ3RvdWNoZW5kJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vUHJldmVudHMgY2xpY2sgZXZlbnQgZnJvbSBmaXJpbmdcbiAgICAgICAgXG4gICAgICAgIHZhciB0aW1lICAgICAgICA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lLFxuICAgICAgICAgICAgZW5kUG9zICAgICAgPSBjbGljay5fZ2V0UG9zKGUpLFxuICAgICAgICAgICAgZGlzdGFuY2UgICAgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgICAgICAgTWF0aC5wb3coZW5kUG9zLnggLSBzdGFydFBvcy54LCAyKSArXG4gICAgICAgICAgICAgICAgTWF0aC5wb3coZW5kUG9zLnkgLSBzdGFydFBvcy55LCAyKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBpZih0aW1lIDwgY2xpY2sudGltZUxpbWl0ICYmIGRpc3RhbmNlIDwgY2xpY2suZGlzdGFuY2VMaW1pdCkge1xuICAgICAgICAgICAgLy9GaW5kIHRoZSBjb3JyZWN0IGNhbGxiYWNrXG4gICAgICAgICAgICAkLmVhY2goYmluZGluZ3MsIGZ1bmN0aW9uKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmKCR0aGlzLmlzKHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShlLnRhcmdldCwgW2VdKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKioqIEFQSSAqKiovXG5jbGljay5iaW5kID0gZnVuY3Rpb24oZXZlbnRzKSB7XG5cbiAgICAvL0FyZ3VtZW50IFN1cmdlcnlcbiAgICBpZighJC5pc1BsYWluT2JqZWN0KGV2ZW50cykpIHtcbiAgICAgICAgbmV3RXZlbnRzID0ge307XG4gICAgICAgIG5ld0V2ZW50c1thcmd1bWVudHNbMF1dID0gYXJndW1lbnRzWzFdO1xuICAgICAgICBldmVudHMgPSBuZXdFdmVudHM7XG4gICAgfVxuXG4gICAgJC5lYWNoKGV2ZW50cywgZnVuY3Rpb24oc2VsZWN0b3IsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgLyoqKiBSZWdpc3RlciBCaW5kaW5nICoqKi9cbiAgICAgICAgaWYodHlwZW9mIGJpbmRpbmdzW3NlbGVjdG9yXSAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY2xpY2sudW5iaW5kKHNlbGVjdG9yKTsgLy9FbnN1cmUgbm8gZHVwbGljYXRlc1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBiaW5kaW5nc1tzZWxlY3Rvcl0gPSBjYWxsYmFjaztcblxuICAgICAgICAvKioqIFRvdWNoIFN1cHBvcnQgKioqL1xuICAgICAgICBpZihjbGljay5pc1RvdWNoKSB7XG4gICAgICAgICAgICAkZG9jdW1lbnQuZGVsZWdhdGUoc2VsZWN0b3IsICd0b3VjaHN0YXJ0Jywgb25Ub3VjaHN0YXJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiogTW91c2UgU3VwcG9ydCAqKiovXG4gICAgICAgICRkb2N1bWVudC5kZWxlZ2F0ZShzZWxlY3RvciwgJ2NsaWNrJywgZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTsgLy9QcmV2ZW50cyBtdWx0aXBsZSBjbGljayBldmVudHMgZnJvbSBoYXBwZW5pbmdcbiAgICAgICAgICAgIC8vY2xpY2suX2RvQW55d2hlcmVzKGUpOyAvL0RvIGFueXdoZXJlcyBmaXJzdCB0byBiZSBjb25zaXN0ZW50IHdpdGggdG91Y2ggb3JkZXJcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIFtlXSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5jbGljay51bmJpbmQgPSBmdW5jdGlvbihzZWxlY3Rvcikge1xuICAgICRkb2N1bWVudFxuICAgICAgICAudW5kZWxlZ2F0ZShzZWxlY3RvciwgJ3RvdWNoc3RhcnQnKVxuICAgICAgICAudW5kZWxlZ2F0ZShzZWxlY3RvciwgJ2NsaWNrJyk7XG5cbiAgICBkZWxldGUgYmluZGluZ3Nbc2VsZWN0b3JdO1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5jbGljay51bmJpbmRBbGwgPSBmdW5jdGlvbigpIHtcbiAgICAkLmVhY2goYmluZGluZ3MsIGZ1bmN0aW9uKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgICAgICAkZG9jdW1lbnRcbiAgICAgICAgICAgIC51bmRlbGVnYXRlKHNlbGVjdG9yLCAndG91Y2hzdGFydCcpXG4gICAgICAgICAgICAudW5kZWxlZ2F0ZShzZWxlY3RvciwgJ2NsaWNrJyk7XG4gICAgfSk7XG4gICAgXG4gICAgYmluZGluZ3MgPSB7fTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuY2xpY2sudHJpZ2dlciA9IGZ1bmN0aW9uKHNlbGVjdG9yLCBlKSB7XG4gICAgZSA9IGUgfHwgJC5FdmVudCgnY2xpY2snKTtcblxuICAgIGlmKHR5cGVvZiBiaW5kaW5nc1tzZWxlY3Rvcl0gIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgYmluZGluZ3Nbc2VsZWN0b3JdKGUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk5vIGNsaWNrIGV2ZW50cyBib3VuZCBmb3Igc2VsZWN0b3IgJ1wiK3NlbGVjdG9yK1wiJy5cIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5jbGljay5hbnl3aGVyZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgY2xpY2suX2FueXdoZXJlcy5wdXNoKGNhbGxiYWNrKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKiogSW50ZXJuYWwgKGJ1dCB1c2VmdWwpIE1ldGhvZHMgKioqL1xuY2xpY2suX2dldFBvcyA9IGZ1bmN0aW9uKGUpIHtcbiAgICBlID0gZS5vcmlnaW5hbEV2ZW50O1xuXG4gICAgaWYoZS5wYWdlWCB8fCBlLnBhZ2VZKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBlLnBhZ2VYLFxuICAgICAgICAgICAgeTogZS5wYWdlWVxuICAgICAgICB9O1xuICAgIH1cbiAgICBlbHNlIGlmKGUuY2hhbmdlZFRvdWNoZXMpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WCxcbiAgICAgICAgICAgIHk6IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WVxuICAgICAgICB9O1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IGUuY2xpZW50WCArIGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCArIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0LFxuICAgICAgICAgICAgeTogZS5jbGllbnRZICsgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgICsgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcFxuICAgICAgICB9O1xuICAgIH1cbn07XG5cbmNsaWNrLl9hbnl3aGVyZXMgPSBbXTtcblxuY2xpY2suX2RvQW55d2hlcmVzID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciBpID0gY2xpY2suX2FueXdoZXJlcy5sZW5ndGg7XG4gICAgd2hpbGUoaS0tKSB7XG4gICAgICAgIGNsaWNrLl9hbnl3aGVyZXNbaV0oZSk7XG4gICAgfVxufTtcblxuJChkb2N1bWVudCkuYmluZCgnbW91c2Vkb3duJywgY2xpY2suX2RvQW55d2hlcmVzKTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGljaztcblxuIiwidmFyICQgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcixcbiAgICAkZG9jdW1lbnQgPSAkKGRvY3VtZW50KTtcblxudmFyIERyYWcgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG4gICAgXG59O1xuXG5EcmFnLnByb3RvdHlwZSA9IHtcbiAgICAvKmhvcml6b250YWw6IGZ1bmN0aW9uKCkge1xuXG4gICAgfSxcbiAgICB2ZXJ0aWNhbDogZnVuY3Rpb24oKSB7XG5cbiAgICB9LCAqL1xuICAgIGNvbnN0cmFpbjogZnVuY3Rpb24oLypbZGlyZWN0aW9uLCBlbGVtZW50XSwgYm91bmRzKiovKSB7XG5cbiAgICB9LFxuICAgIHN0YXJ0OiBmdW5jdGlvbigpIHtcblxuICAgIH0sXG4gICAgc3RvcDogZnVuY3Rpb24oKSB7XG5cbiAgICB9LFxuICAgIG1vdmU6IGZ1bmN0aW9uKCkge1xuXG4gICAgfSxcbiAgICByZXZlcnQ6IGZ1bmN0aW9uKCkge1xuXG4gICAgfSxcbiAgICBzY3JvbGw6IGZ1bmN0aW9uKCkge1xuXG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEcmFnO1xuIiwidmFyICQgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcjtcblxudmFyIERyb3AgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG5cbn07XG5cbkRyb3AucHJvdG90eXBlID0ge1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERyb3A7IiwidmFyIERyYWcgPSByZXF1aXJlKFwiLi9EcmFnXCIpLFxuICAgIERyb3AgPSByZXF1aXJlKFwiLi9Ecm9wXCIpO1xuXG52YXIgZHJvcEluZGV4ID0ge307XG5cbnZhciBvbkRyYWcgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG4gICAgcmV0dXJuIG5ldyBEcmFnKHNlbGVjdG9yLCBjb25maWcpO1xufTtcblxub25EcmFnLmRyb3AgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG4gICAgdmFyIGRyb3AgPSBuZXcgRHJvcChzZWxlY3RvciwgY29uZmlnKTtcblxuICAgIC8vZHJvcCBpbmRleGluZ1xuICAgIHZhciBhZGRUb0luZGV4ID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBpZih0eXBlb2YgZHJvcEluZGV4W25hbWVdID09ICd1bmRlZmluZWQnKSBkcm9wSW5kZXhbbmFtZV0gPSBbZHJvcF07XG4gICAgICAgIGVsc2UgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyb3BJbmRleFtuYW1lXS5wdXNoKGRyb3ApO1xuICAgIH07XG5cbiAgICBpZighY29uZmlnLnRhZykge1xuICAgICAgICBhZGRUb0luZGV4KCcnKTtcbiAgICB9XG4gICAgZWxzZSBpZih0eXBlb2YgY29uZmlnLnRhZyA9PSAnU3RyaW5nJykge1xuICAgICAgICBhZGRUb0luZGV4KGNvbmZpZy50YWcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGkgPSBjb25maWcudGFnLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICBhZGRUb0luZGV4KGNvbmZpZy50YWdbaV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRyb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9uRHJhZztcbiIsInZhciAkID0gcmVxdWlyZSgndW5vcGluaW9uYXRlJykuc2VsZWN0b3IsXG4gICAgICAgIHNwZWNpYWxLZXlzID0gcmVxdWlyZSgnLi9zcGVjaWFsS2V5cycpO1xuXG52YXIgJHdpbmRvdyA9ICQod2luZG93KTtcblxudmFyIEV2ZW50ID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICB0aGlzLnNlbGVjdG9yICAgPSBzZWxlY3RvcjtcbiAgICB0aGlzLiRzY29wZSAgICAgPSBzZWxlY3RvciA/ICQoc2VsZWN0b3IpIDogJHdpbmRvdztcbiAgICB0aGlzLmNhbGxiYWNrcyAgPSBbXTtcbiAgICB0aGlzLmFjdGl2ZSAgICAgPSB0cnVlO1xufTtcblxuRXZlbnQucHJvdG90eXBlID0ge1xuICAgIHVwOiBmdW5jdGlvbihldmVudHMpIHtcbiAgICAgICAgdGhpcy5iaW5kKCd1cCcsIGV2ZW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZG93bjogZnVuY3Rpb24oZXZlbnRzKSB7XG4gICAgICAgIHRoaXMuYmluZCgnZG93bicsIGV2ZW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgYmluZDogZnVuY3Rpb24odHlwZSwgZXZlbnRzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBpZigkLmlzUGxhaW5PYmplY3QoZXZlbnRzKSkge1xuICAgICAgICAgICAgJC5lYWNoKGV2ZW50cywgZnVuY3Rpb24oa2V5LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHNlbGYuX2FkZCh0eXBlLCBrZXksIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fYWRkKHR5cGUsIGZhbHNlLCBldmVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBvZmY6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRzY29wZVxuICAgICAgICAgICAgLnVuYmluZCgna2V5ZG93bicpXG4gICAgICAgICAgICAudW5iaW5kKCdrZXl1cCcpO1xuICAgIH0sXG5cbiAgICAvKioqIEludGVybmFsIEZ1bmN0aW9ucyAqKiovXG4gICAgX2FkZDogZnVuY3Rpb24odHlwZSwgY29uZGl0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmKCF0aGlzLmNhbGxiYWNrc1t0eXBlXSkge1xuICAgICAgICAgICAgdGhpcy5jYWxsYmFja3NbdHlwZV0gPSBbXTtcblxuICAgICAgICAgICAgdGhpcy4kc2NvcGUuYmluZCgna2V5JyArIHR5cGUsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZihzZWxmLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2tzID0gc2VsZi5jYWxsYmFja3NbdHlwZV07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8Y2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBjYWxsYmFja3NbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZighY2FsbGJhY2suY29uZGl0aW9ucyB8fCBzZWxmLl92YWxpZGF0ZShjYWxsYmFjay5jb25kaXRpb25zLCBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihjb25kaXRpb25zKSB7XG4gICAgICAgICAgICBjYWxsYmFjay5jb25kaXRpb25zID0gdGhpcy5fcGFyc2VDb25kaXRpb25zKGNvbmRpdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jYWxsYmFja3NbdHlwZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfSxcbiAgICBfcGFyc2VDb25kaXRpb25zOiBmdW5jdGlvbihjKSB7XG4gICAgICAgIHZhciBjb25kaXRpb25zID0ge1xuICAgICAgICAgICAgc2hpZnQ6ICAgL1xcYnNoaWZ0XFxiL2kudGVzdChjKSxcbiAgICAgICAgICAgIGFsdDogICAgIC9cXGIoYWx0fGFsdGVybmF0ZSlcXGIvaS50ZXN0KGMpLFxuICAgICAgICAgICAgY3RybDogICAgL1xcYihjdHJsfGNvbnRyb2x8Y21kfGNvbW1hbmQpXFxiL2kudGVzdChjKVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vS2V5IEJpbmRpbmdcbiAgICAgICAgdmFyIGtleXMgPSBjLm1hdGNoKC9cXGIoPyFzaGlmdHxhbHR8YWx0ZXJuYXRlfGN0cmx8Y29udHJvbHxjbWR8Y29tbWFuZCkoXFx3KylcXGIvZ2kpO1xuXG4gICAgICAgIGlmKCFrZXlzKSB7XG4gICAgICAgICAgICAvL1VzZSBtb2RpZmllciBhcyBrZXkgaWYgdGhlcmUgaXMgbm8gb3RoZXIga2V5XG4gICAgICAgICAgICBrZXlzID0gYy5tYXRjaCgvXFxiKFxcdyspXFxiL2dpKTtcblxuICAgICAgICAgICAgLy9Nb2RpZmllcnMgc2hvdWxkIGFsbCBiZSBmYWxzZVxuICAgICAgICAgICAgY29uZGl0aW9ucy5zaGlmdCA9XG4gICAgICAgICAgICBjb25kaXRpb25zLmFsdCAgID1cbiAgICAgICAgICAgIGNvbmRpdGlvbnMuY3RybCAgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGtleXMpIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbnMua2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoa2V5cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiTW9yZSB0aGFuIG9uZSBrZXkgYm91bmQgaW4gJ1wiK2MrXCInLiBVc2luZyB0aGUgZmlyc3Qgb25lIChcIitrZXlzWzBdK1wiKS5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25kaXRpb25zLmtleSAgICAgID0gbnVsbDtcbiAgICAgICAgICAgIGNvbmRpdGlvbnMua2V5Q29kZSAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbmRpdGlvbnM7XG4gICAgfSxcbiAgICBfa2V5Q29kZVRlc3Q6IGZ1bmN0aW9uKGtleSwga2V5Q29kZSkge1xuICAgICAgICBpZih0eXBlb2Ygc3BlY2lhbEtleXNba2V5Q29kZV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2YXIga2V5RGVmID0gc3BlY2lhbEtleXNba2V5Q29kZV07XG5cbiAgICAgICAgICAgIGlmKGtleURlZiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXlEZWYudGVzdChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleURlZiA9PT0ga2V5LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihrZXkubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5LnRvVXBwZXJDYXNlKCkuY2hhckNvZGVBdCgwKSA9PT0ga2V5Q29kZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgX3ZhbGlkYXRlOiBmdW5jdGlvbihjLCBlKSB7XG4gICAgICAgIHJldHVybiAgKGMua2V5ID8gdGhpcy5fa2V5Q29kZVRlc3QoYy5rZXksIGUud2hpY2gpIDogdHJ1ZSkgJiZcbiAgICAgICAgICAgICAgICBjLnNoaWZ0ID09PSBlLnNoaWZ0S2V5ICYmXG4gICAgICAgICAgICAgICAgYy5hbHQgICA9PT0gZS5hbHRLZXkgJiZcbiAgICAgICAgICAgICAgICAoIWMuY3RybCB8fCAoYy5jdHJsID09PSBlLm1ldGFLZXkpICE9PSAoYy5jdHJsID09PSBlLmN0cmxLZXkpKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50O1xuXG4iLCJ2YXIgRXZlbnQgPSByZXF1aXJlKCcuL0V2ZW50LmpzJyksXG4gICAgZXZlbnRzID0gW107XG5cbnZhciBrZXkgPSBmdW5jdGlvbihzZWxlY3RvcikgeyAvL0ZhY3RvcnkgZm9yIEV2ZW50IG9iamVjdHNcbiAgICByZXR1cm4ga2V5Ll9jcmVhdGVFdmVudChzZWxlY3Rvcik7XG59O1xuXG5rZXkuZG93biA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLl9jcmVhdGVFdmVudCgpLmRvd24oY29uZmlnKTtcbn07XG5cbmtleS51cCA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLl9jcmVhdGVFdmVudCgpLnVwKGNvbmZpZyk7XG59O1xuXG5rZXkudW5iaW5kQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgd2hpbGUoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBldmVudHMucG9wKCkuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLy9DcmVhdGVzIG5ldyBFdmVudCBvYmplY3RzIChjaGVja2luZyBmb3IgZXhpc3RpbmcgZmlyc3QpXG5rZXkuX2NyZWF0ZUV2ZW50ID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICB2YXIgZSA9IG5ldyBFdmVudChzZWxlY3Rvcik7XG4gICAgZXZlbnRzLnB1c2goZSk7XG4gICAgcmV0dXJuIGU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGtleTtcbiIsIi8vQWRvcHRlZCBmcm9tIFtqUXVlcnkgaG90a2V5c10oaHR0cHM6Ly9naXRodWIuY29tL2plcmVzaWcvanF1ZXJ5LmhvdGtleXMvYmxvYi9tYXN0ZXIvanF1ZXJ5LmhvdGtleXMuanMpXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIDg6IFwiYmFja3NwYWNlXCIsXG4gICAgOTogXCJ0YWJcIixcbiAgICAxMDogL14ocmV0dXJufGVudGVyKSQvaSxcbiAgICAxMzogL14ocmV0dXJufGVudGVyKSQvaSxcbiAgICAxNjogXCJzaGlmdFwiLFxuICAgIDE3OiAvXihjdHJsfGNvbnRyb2wpJC9pLFxuICAgIDE4OiAvXihhbHR8YWx0ZXJuYXRlKSQvaSxcbiAgICAxOTogXCJwYXVzZVwiLFxuICAgIDIwOiBcImNhcHNsb2NrXCIsXG4gICAgMjc6IC9eKGVzY3xlc2NhcGUpJC9pLFxuICAgIDMyOiBcInNwYWNlXCIsXG4gICAgMzM6IFwicGFnZXVwXCIsXG4gICAgMzQ6IFwicGFnZWRvd25cIixcbiAgICAzNTogXCJlbmRcIixcbiAgICAzNjogXCJob21lXCIsXG4gICAgMzc6IFwibGVmdFwiLFxuICAgIDM4OiBcInVwXCIsXG4gICAgMzk6IFwicmlnaHRcIixcbiAgICA0MDogXCJkb3duXCIsXG4gICAgNDU6IFwiaW5zZXJ0XCIsXG4gICAgNDY6IC9eKGRlbHxkZWxldGUpJC9pLFxuICAgIDkxOiAvXihjbWR8Y29tbWFuZCkkL2ksXG4gICAgOTY6IFwiMFwiLFxuICAgIDk3OiBcIjFcIixcbiAgICA5ODogXCIyXCIsXG4gICAgOTk6IFwiM1wiLFxuICAgIDEwMDogXCI0XCIsXG4gICAgMTAxOiBcIjVcIixcbiAgICAxMDI6IFwiNlwiLFxuICAgIDEwMzogXCI3XCIsXG4gICAgMTA0OiBcIjhcIixcbiAgICAxMDU6IFwiOVwiLFxuICAgIDEwNjogXCIqXCIsXG4gICAgMTA3OiBcIitcIixcbiAgICAxMDk6IFwiLVwiLFxuICAgIDExMDogXCIuXCIsXG4gICAgMTExIDogXCIvXCIsXG4gICAgMTEyOiBcImYxXCIsXG4gICAgMTEzOiBcImYyXCIsXG4gICAgMTE0OiBcImYzXCIsXG4gICAgMTE1OiBcImY0XCIsXG4gICAgMTE2OiBcImY1XCIsXG4gICAgMTE3OiBcImY2XCIsXG4gICAgMTE4OiBcImY3XCIsXG4gICAgMTE5OiBcImY4XCIsXG4gICAgMTIwOiBcImY5XCIsXG4gICAgMTIxOiBcImYxMFwiLFxuICAgIDEyMjogXCJmMTFcIixcbiAgICAxMjM6IFwiZjEyXCIsXG4gICAgMTQ0OiBcIm51bWxvY2tcIixcbiAgICAxNDU6IFwic2Nyb2xsXCIsXG4gICAgMTg2OiBcIjtcIixcbiAgICAxODc6IFwiPVwiLFxuICAgIDE4OTogXCItXCIsXG4gICAgMTkwOiBcIi5cIixcbiAgICAxOTE6IFwiL1wiLFxuICAgIDE5MjogXCJgXCIsXG4gICAgMjE5OiBcIltcIixcbiAgICAyMjA6IFwiXFxcXFwiLFxuICAgIDIyMTogXCJdXCIsXG4gICAgMjIyOiBcIidcIixcbiAgICAyMjQ6IFwibWV0YVwiXG59O1xuIiwiXG52YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJykuc3R5bGVcbnZhciBwcmVmaXhlcyA9ICdPIG1zIE1veiB3ZWJraXQnLnNwbGl0KCcgJylcbnZhciB1cHBlciA9IC8oW0EtWl0pL2dcblxudmFyIG1lbW8gPSB7fVxuXG4vKipcbiAqIG1lbW9pemVkIGBwcmVmaXhgXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBmdW5jdGlvbihrZXkpe1xuICByZXR1cm4ga2V5IGluIG1lbW9cbiAgICA/IG1lbW9ba2V5XVxuICAgIDogbWVtb1trZXldID0gcHJlZml4KGtleSlcbn1cblxuZXhwb3J0cy5wcmVmaXggPSBwcmVmaXhcbmV4cG9ydHMuZGFzaCA9IGRhc2hlZFByZWZpeFxuXG4vKipcbiAqIHByZWZpeCBga2V5YFxuICpcbiAqICAgcHJlZml4KCd0cmFuc2Zvcm0nKSAvLyA9PiB3ZWJraXRUcmFuc2Zvcm1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIHByZWZpeChrZXkpe1xuICAvLyBjYW1lbCBjYXNlXG4gIGtleSA9IGtleS5yZXBsYWNlKC8tKFthLXpdKS9nLCBmdW5jdGlvbihfLCBjaGFyKXtcbiAgICByZXR1cm4gY2hhci50b1VwcGVyQ2FzZSgpXG4gIH0pXG5cbiAgLy8gd2l0aG91dCBwcmVmaXhcbiAgaWYgKHN0eWxlW2tleV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIGtleVxuXG4gIC8vIHdpdGggcHJlZml4XG4gIHZhciBLZXkgPSBjYXBpdGFsaXplKGtleSlcbiAgdmFyIGkgPSBwcmVmaXhlcy5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIHZhciBuYW1lID0gcHJlZml4ZXNbaV0gKyBLZXlcbiAgICBpZiAoc3R5bGVbbmFtZV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIG5hbWVcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcigndW5hYmxlIHRvIHByZWZpeCAnICsga2V5KVxufVxuXG5mdW5jdGlvbiBjYXBpdGFsaXplKHN0cil7XG4gIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSlcbn1cblxuLyoqXG4gKiBjcmVhdGUgYSBkYXNoZXJpemVkIHByZWZpeFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGFzaGVkUHJlZml4KGtleSl7XG4gIGtleSA9IHByZWZpeChrZXkpXG4gIGlmICh1cHBlci50ZXN0KGtleSkpIGtleSA9ICctJyArIGtleS5yZXBsYWNlKHVwcGVyLCAnLSQxJylcbiAgcmV0dXJuIGtleS50b0xvd2VyQ2FzZSgpXG59XG4iLCIvKlxyXG4gKiBsb2dsZXZlbCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9waW10ZXJyeS9sb2dsZXZlbFxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgVGltIFBlcnJ5XHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cclxuICovXHJcblxyXG47KGZ1bmN0aW9uICh1bmRlZmluZWQpIHtcclxuICAgIHZhciB1bmRlZmluZWRUeXBlID0gXCJ1bmRlZmluZWRcIjtcclxuXHJcbiAgICAoZnVuY3Rpb24gKG5hbWUsIGRlZmluaXRpb24pIHtcclxuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBkZWZpbmUoZGVmaW5pdGlvbik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IGRlZmluaXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICB9KCdsb2cnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB7fTtcclxuICAgICAgICB2YXIgbm9vcCA9IGZ1bmN0aW9uKCkge307XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlYWxNZXRob2QobWV0aG9kTmFtZSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgPT09IHVuZGVmaW5lZFR5cGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnNvbGVbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbnNvbGUubG9nICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYm91bmRUb0NvbnNvbGUoY29uc29sZSwgJ2xvZycpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9vcDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBib3VuZFRvQ29uc29sZShjb25zb2xlLCBtZXRob2ROYW1lKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gYm91bmRUb0NvbnNvbGUoY29uc29sZSwgbWV0aG9kTmFtZSkge1xyXG4gICAgICAgICAgICB2YXIgbWV0aG9kID0gY29uc29sZVttZXRob2ROYW1lXTtcclxuICAgICAgICAgICAgaWYgKG1ldGhvZC5iaW5kID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uQmluZGluZ1dyYXBwZXIobWV0aG9kLCBjb25zb2xlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kLmNhbGwoY29uc29sZVttZXRob2ROYW1lXSwgY29uc29sZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJbiBJRTggKyBNb2Rlcm5penIsIHRoZSBiaW5kIHNoaW0gd2lsbCByZWplY3QgdGhlIGFib3ZlLCBzbyB3ZSBmYWxsIGJhY2sgdG8gd3JhcHBpbmdcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uQmluZGluZ1dyYXBwZXIobWV0aG9kLCBjb25zb2xlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZVttZXRob2ROYW1lXS5iaW5kKGNvbnNvbGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBmdW5jdGlvbkJpbmRpbmdXcmFwcGVyKGYsIGNvbnRleHQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmFwcGx5KGYsIFtjb250ZXh0LCBhcmd1bWVudHNdKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBsb2dNZXRob2RzID0gW1xyXG4gICAgICAgICAgICBcInRyYWNlXCIsXHJcbiAgICAgICAgICAgIFwiZGVidWdcIixcclxuICAgICAgICAgICAgXCJpbmZvXCIsXHJcbiAgICAgICAgICAgIFwid2FyblwiLFxyXG4gICAgICAgICAgICBcImVycm9yXCJcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiByZXBsYWNlTG9nZ2luZ01ldGhvZHMobWV0aG9kRmFjdG9yeSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgbG9nTWV0aG9kcy5sZW5ndGg7IGlpKyspIHtcclxuICAgICAgICAgICAgICAgIHNlbGZbbG9nTWV0aG9kc1tpaV1dID0gbWV0aG9kRmFjdG9yeShsb2dNZXRob2RzW2lpXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGNvb2tpZXNBdmFpbGFibGUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5kb2N1bWVudCAhPT0gdW5kZWZpbmVkICYmXHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LmRvY3VtZW50LmNvb2tpZSAhPT0gdW5kZWZpbmVkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGxvY2FsU3RvcmFnZUF2YWlsYWJsZSgpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlICE9PSB1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHBlcnNpc3RMZXZlbElmUG9zc2libGUobGV2ZWxOdW0pIHtcclxuICAgICAgICAgICAgdmFyIGxldmVsTmFtZTtcclxuXHJcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBzZWxmLmxldmVscykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHNlbGYubGV2ZWxzLmhhc093blByb3BlcnR5KGtleSkgJiYgc2VsZi5sZXZlbHNba2V5XSA9PT0gbGV2ZWxOdW0pIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXZlbE5hbWUgPSBrZXk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChsb2NhbFN0b3JhZ2VBdmFpbGFibGUoKSkge1xyXG4gICAgICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZVsnbG9nbGV2ZWwnXSA9IGxldmVsTmFtZTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChjb29raWVzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5kb2N1bWVudC5jb29raWUgPSBcImxvZ2xldmVsPVwiICsgbGV2ZWxOYW1lICsgXCI7XCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjb29raWVSZWdleCA9IC9sb2dsZXZlbD0oW147XSspLztcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gbG9hZFBlcnNpc3RlZExldmVsKCkge1xyXG4gICAgICAgICAgICB2YXIgc3RvcmVkTGV2ZWw7XHJcblxyXG4gICAgICAgICAgICBpZiAobG9jYWxTdG9yYWdlQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gd2luZG93LmxvY2FsU3RvcmFnZVsnbG9nbGV2ZWwnXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFzdG9yZWRMZXZlbCAmJiBjb29raWVzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjb29raWVNYXRjaCA9IGNvb2tpZVJlZ2V4LmV4ZWMod2luZG93LmRvY3VtZW50LmNvb2tpZSkgfHwgW107XHJcbiAgICAgICAgICAgICAgICBzdG9yZWRMZXZlbCA9IGNvb2tpZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnNldExldmVsKHNlbGYubGV2ZWxzW3N0b3JlZExldmVsXSB8fCBzZWxmLmxldmVscy5XQVJOKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBQdWJsaWMgQVBJXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKi9cclxuXHJcbiAgICAgICAgc2VsZi5sZXZlbHMgPSB7IFwiVFJBQ0VcIjogMCwgXCJERUJVR1wiOiAxLCBcIklORk9cIjogMiwgXCJXQVJOXCI6IDMsXHJcbiAgICAgICAgICAgIFwiRVJST1JcIjogNCwgXCJTSUxFTlRcIjogNX07XHJcblxyXG4gICAgICAgIHNlbGYuc2V0TGV2ZWwgPSBmdW5jdGlvbiAobGV2ZWwpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBsZXZlbCA9PT0gXCJudW1iZXJcIiAmJiBsZXZlbCA+PSAwICYmIGxldmVsIDw9IHNlbGYubGV2ZWxzLlNJTEVOVCkge1xyXG4gICAgICAgICAgICAgICAgcGVyc2lzdExldmVsSWZQb3NzaWJsZShsZXZlbCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGxldmVsID09PSBzZWxmLmxldmVscy5TSUxFTlQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9vcDtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zb2xlID09PSB1bmRlZmluZWRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVwbGFjZUxvZ2dpbmdNZXRob2RzKGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09IHVuZGVmaW5lZFR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNldExldmVsKGxldmVsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmW21ldGhvZE5hbWVdLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiTm8gY29uc29sZSBhdmFpbGFibGUgZm9yIGxvZ2dpbmdcIjtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVwbGFjZUxvZ2dpbmdNZXRob2RzKGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZXZlbCA8PSBzZWxmLmxldmVsc1ttZXRob2ROYW1lLnRvVXBwZXJDYXNlKCldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVhbE1ldGhvZChtZXRob2ROYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGxldmVsID09PSBcInN0cmluZ1wiICYmIHNlbGYubGV2ZWxzW2xldmVsLnRvVXBwZXJDYXNlKCldICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHNbbGV2ZWwudG9VcHBlckNhc2UoKV0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgXCJsb2cuc2V0TGV2ZWwoKSBjYWxsZWQgd2l0aCBpbnZhbGlkIGxldmVsOiBcIiArIGxldmVsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgc2VsZi5lbmFibGVBbGwgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChzZWxmLmxldmVscy5UUkFDRSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgc2VsZi5kaXNhYmxlQWxsID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHMuU0lMRU5UKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBsb2FkUGVyc2lzdGVkTGV2ZWwoKTtcclxuICAgICAgICByZXR1cm4gc2VsZjtcclxuICAgIH0pKTtcclxufSkoKTtcclxuIiwidmFyIGxvZyA9IHJlcXVpcmUoJ2xvZ2xldmVsJyksXG4gICAgbm9vcCA9IGZ1bmN0aW9uKCkge307XG5cbnZhciBTdWJ2aWV3ID0gZnVuY3Rpb24oKSB7fTtcblxuU3Vidmlldy5wcm90b3R5cGUgPSB7XG4gICAgaXNTdWJ2aWV3OiB0cnVlLFxuXG4gICAgLyoqKiBMaWZlLUN5Y2xlICoqKi9cblxuICAgIC8vVGhlc2Ugc2hvdWxkIGJlIGNvbmZpZ3VyZWQgYnV0IHdpbGwgYmUgcHVzaGVkIHRvIHRoZWlyIHJlc3BlY3RpdmUgZnVuY3Rpb24gc3RhY2tzIHJhdGhlciB0aGFuIG92ZXJ3cml0aW5nXG4gICAgb25jZTogZnVuY3Rpb24oY29uZmlnKSB7IC8vUnVucyBhZnRlciByZW5kZXJcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5fb25jZUZ1bmN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fb25jZUZ1bmN0aW9uc1tpXS5hcHBseSh0aGlzLCBbY29uZmlnXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSwgXG4gICAgX29uY2VGdW5jdGlvbnM6IFtdLFxuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbmZpZykgeyAvL1J1bnMgYWZ0ZXIgcmVuZGVyXG4gICAgICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuX2luaXRGdW5jdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2luaXRGdW5jdGlvbnNbaV0uYXBwbHkodGhpcywgW2NvbmZpZ10pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgX2luaXRGdW5jdGlvbnM6IFtdLFxuICAgIGNsZWFuOiBmdW5jdGlvbigpIHsgLy9SdW5zIG9uIHJlbW92ZVxuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLl9jbGVhbkZ1bmN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2xlYW5GdW5jdGlvbnNbaV0uYXBwbHkodGhpcywgW10pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sIFxuICAgIF9jbGVhbkZ1bmN0aW9uczogW10sXG5cbiAgICAvL1N0YXRpYyBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzXG4gICAgYWN0aXZlOiBmYWxzZSxcblxuICAgIHJlbW92ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKHRoaXMuYWN0aXZlKSB7XG4gICAgICAgICAgICAvL0RldGFjaFxuICAgICAgICAgICAgdmFyIHBhcmVudCA9IHRoaXMud3JhcHBlci5wYXJlbnROb2RlO1xuICAgICAgICAgICAgaWYocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMud3JhcHBlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vQ2xlYW5cbiAgICAgICAgICAgIHRoaXMuY2xlYW4oKTtcblxuICAgICAgICAgICAgdGhpcy5wb29sLl9yZWxlYXNlKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuXG4gICAgLyoqKiBUZW1wbGF0aW5nICoqKi9cblxuICAgIHRlbXBsYXRlOiAgIFwiXCIsXG5cbiAgICAvL0RhdGEgZ29lcyBpbnRvIHRoZSB0ZW1wbGF0ZXMgYW5kIG1heSBhbHNvIGJlIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIG9iamVjdFxuICAgIGRhdGE6ICAgICAgIHt9LFxuXG4gICAgLy9TdWJ2aWV3cyBhcmUgYSBzZXQgb2Ygc3Vidmlld3MgdGhhdCB3aWxsIGJlIGZlZCBpbnRvIHRoZSB0ZW1wbGF0aW5nIGVuZ2luZVxuICAgIHN1YnZpZXdzOiAgIHt9LFxuXG4gICAgLy9TZXR0aW5nc1xuICAgIHJlUmVuZGVyOiAgIGZhbHNlLCAvL0RldGVybWluZXMgaWYgc3VidmlldyBpcyByZS1yZW5kZXJlZCBldmVyeSB0aW1lIGl0IGlzIHNwYXduZWRcbiAgICB0YWdOYW1lOiAgICBcImRpdlwiLFxuICAgIGNsYXNzTmFtZTogIFwiXCIsXG5cbiAgICAvL0V2ZW50c1xuICAgIHByZVJlbmRlcjogIG5vb3AsXG4gICAgcG9zdFJlbmRlcjogbm9vcCxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIGh0bWwgPSAnJztcbiAgICAgICAgICAgIHBvc3RMb2FkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5wcmVSZW5kZXIoKTtcblxuICAgICAgICAvL05vIFRlbXBsYXRpbmcgRW5naW5lXG4gICAgICAgIGlmKHR5cGVvZiB0aGlzLnRlbXBsYXRlID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBodG1sID0gdGhpcy50ZW1wbGF0ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gdHlwZW9mIHRoaXMuZGF0YSA9PSAnZnVuY3Rpb24nID8gdGhpcy5kYXRhKCkgOiB0aGlzLmRhdGE7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vRGVmaW5lIHRoZSBzdWJ2aWV3IHZhcmlhYmxlXG4gICAgICAgICAgICBkYXRhLnN1YnZpZXcgPSB7fTtcbiAgICAgICAgICAgICQuZWFjaCh0aGlzLnN1YnZpZXdzLCBmdW5jdGlvbihuYW1lLCBzdWJ2aWV3KSB7XG4gICAgICAgICAgICAgICAgcG9zdExvYWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGRhdGEuc3Vidmlld1tuYW1lXSA9IFwiPHNjcmlwdCBjbGFzcz0ncG9zdC1sb2FkLXZpZXcnIHR5cGU9J3RleHQvaHRtbCcgZGF0YS1uYW1lPSdcIituYW1lK1wiJz48L3NjcmlwdD5cIjtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvL1J1biB0aGUgdGVtcGxhdGluZyBlbmdpbmVcbiAgICAgICAgICAgIGlmKCQuaXNGdW5jdGlvbih0aGlzLnRlbXBsYXRlKSkge1xuICAgICAgICAgICAgICAgIC8vRUpTXG4gICAgICAgICAgICAgICAgaWYodHlwZW9mIHRoaXMudGVtcGxhdGUucmVuZGVyID09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgaHRtbCA9IHRoaXMudGVtcGxhdGUucmVuZGVyKGRhdGEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvL0hhbmRsZWJhcnMgJiBVbmRlcnNjb3JlICYgSmFkZVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBodG1sID0gdGhpcy50ZW1wbGF0ZShkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2cuZXJyb3IoXCJUZW1wbGF0aW5nIGVuZ2luZSBub3QgcmVjb2duaXplZC5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmh0bWwoaHRtbCk7XG5cbiAgICAgICAgLy9Qb3N0IExvYWQgVmlld3NcbiAgICAgICAgaWYocG9zdExvYWQpIHtcbiAgICAgICAgICAgIHZhciAkcG9zdExvYWRzID0gdGhpcy4kd3JhcHBlci5maW5kKCcucG9zdC1sb2FkLXZpZXcnKSxcbiAgICAgICAgICAgICAgICBpID0gJHBvc3RMb2Fkcy5sZW5ndGg7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHdoaWxlKGktLSkge1xuICAgICAgICAgICAgICAgIHZhciAkcG9zdExvYWQgPSAkKCRwb3N0TG9hZHNbaV0pLFxuICAgICAgICAgICAgICAgICAgICB2aWV3ICA9IHNlbGYuc3Vidmlld3NbJHBvc3RMb2FkLmF0dHIoJ2RhdGEtbmFtZScpXTtcblxuICAgICAgICAgICAgICAgIGlmKHZpZXcuaXNTdWJ2aWV3UG9vbCkge1xuICAgICAgICAgICAgICAgICAgICB2aWV3ID0gdmlldy5zcGF3bigpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICRwb3N0TG9hZFxuICAgICAgICAgICAgICAgICAgICAuYWZ0ZXIodmlldy4kd3JhcHBlcilcbiAgICAgICAgICAgICAgICAgICAgLnJlbW92ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wb3N0UmVuZGVyKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBodG1sOiBmdW5jdGlvbihodG1sKSB7XG4gICAgICAgIC8vUmVtb3ZlICYgY2xlYW4gc3Vidmlld3MgaW4gdGhlIHdyYXBwZXIgXG4gICAgICAgIHZhciAkc3Vidmlld3MgPSB0aGlzLiQoJy4nK3RoaXMuX3N1YnZpZXdDc3NDbGFzcyksXG4gICAgICAgICAgICBpID0gJHN1YnZpZXdzLmxlbmd0aDtcblxuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIHN1YnZpZXcoJHN1YnZpZXdzW2ldKS5yZW1vdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9FbXB0eSB0aGUgd3JhcHBlclxuICAgICAgICB0aGlzLndyYXBwZXIuaW5uZXJIVE1MID0gaHRtbDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgXG4gICAgLyoqKiBFdmVudHMgKioqL1xuXG4gICAgLy9saXN0ZW5lcnNcbiAgICBsaXN0ZW5lcnM6IHtcbiAgICAgICAgLy8nW2RpcmVjdGlvbl06W2V2ZW50IG5hbWVdOltmcm9tIHR5cGVdLCAuLi4nOiBmdW5jdGlvbihldmVudEFyZ3VtZW50cyopIHt9XG4gICAgfSxcblxuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBhcmdzID0gYXJncyB8fCBbXTtcblxuICAgICAgICAvL0Jyb2FkY2FzdCBpbiBhbGwgZGlyZWN0aW9uc1xuICAgICAgICB2YXIgZGlyZWN0aW9ucyA9IHtcbiAgICAgICAgICAgIHVwOiAgICAgJ2ZpbmQnLFxuICAgICAgICAgICAgZG93bjogICAncGFyZW50cycsXG4gICAgICAgICAgICBhY3Jvc3M6ICdzaWJsaW5ncycsXG4gICAgICAgICAgICBhbGw6ICAgIG51bGwsXG4gICAgICAgICAgICBzZWxmOiAgIHRoaXMuJHdyYXBwZXJcbiAgICAgICAgfTtcblxuICAgICAgICAkLmVhY2goZGlyZWN0aW9ucywgZnVuY3Rpb24oZGlyZWN0aW9uLCBqcUZ1bmMpIHtcbiAgICAgICAgICAgIHZhciBzZWxlY3RvciA9ICcubGlzdGVuZXItJytkaXJlY3Rpb24rJy0nK25hbWU7XG4gICAgICAgICAgICBzZWxlY3RvciA9IHNlbGVjdG9yICsgJywgJyArIHNlbGVjdG9yKyctJytzZWxmLnR5cGU7XG5cbiAgICAgICAgICAgIC8vU2VsZWN0ICR3cmFwcGVycyB3aXRoIHRoZSByaWdodCBsaXN0ZW5lciBjbGFzcyBpbiB0aGUgcmlnaHQgZGlyZWN0aW9uXG4gICAgICAgICAgICB2YXIgJGVscyA9IGpxRnVuYyA/IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpxRnVuYy5qcXVlcnkgPyBqcUZ1bmMgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLiR3cmFwcGVyW2pxRnVuY10oc2VsZWN0b3IpIDogJChzZWxlY3Rvcik7XG5cbiAgICAgICAgICAgIGZvcih2YXIgaT0wOyBpPCRlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvL0dldCB0aGUgYWN0dWFsIHN1YnZpZXdcbiAgICAgICAgICAgICAgICB2YXIgcmVjaXBpZW50ID0gc3VidmlldygkZWxzW2ldKTtcblxuICAgICAgICAgICAgICAgIC8vQ2hlY2sgZm9yIGEgc3VidmlldyB0eXBlIHNwZWNpZmljIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgdmFyIHR5cGVkQ2FsbGJhY2sgPSByZWNpcGllbnQubGlzdGVuZXJzW2RpcmVjdGlvbiArIFwiOlwiICsgbmFtZSArIFwiOlwiICsgc2VsZi50eXBlXTtcbiAgICAgICAgICAgICAgICBpZih0eXBlZENhbGxiYWNrICYmIHR5cGVkQ2FsbGJhY2suYXBwbHkocmVjaXBpZW50LCBhcmdzKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlOyAvL0JyZWFrcyBpZiBjYWxsYmFjayByZXR1cm5zIGZhbHNlXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy9DaGVjayBmb3IgYSBnZW5lcmFsIGV2ZW50IGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgdmFyIHVudHlwZWRDYWxsYmFjayA9IHJlY2lwaWVudC5saXN0ZW5lcnNbZGlyZWN0aW9uICsgXCI6XCIgKyBuYW1lXTtcbiAgICAgICAgICAgICAgICBpZih1bnR5cGVkQ2FsbGJhY2sgJiYgdW50eXBlZENhbGxiYWNrLmFwcGx5KHJlY2lwaWVudCwgYXJncykgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy9CcmVha3MgaWYgY2FsbGJhY2sgcmV0dXJucyBmYWxzZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLy9HZXRzIGNhbGxlZCB3aGVuIGEgbmV3IFN1YnZpZXcgaW5zdGFuY2UgaXMgY3JlYXRlZCBieSB0aGUgU3Vidmlld1Bvb2xcbiAgICBfYmluZExpc3RlbmVyczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkLmVhY2godGhpcy5saXN0ZW5lcnMsIGZ1bmN0aW9uKGV2ZW50cywgY2FsbGJhY2spIHtcblxuICAgICAgICAgICAgLy9QYXJzZSB0aGUgZXZlbnQgZm9ybWF0IFwiW3ZpZXcgdHlwZV06W2V2ZW50IG5hbWVdLCBbdmlldyB0eXBlXTpbZXZlbnQgbmFtZV1cIlxuXG4gICAgICAgICAgICBldmVudHMgPSBldmVudHMuc3BsaXQoJywnKTtcbiAgICAgICAgICAgIHZhciBpID0gZXZlbnRzLmxlbmd0aDtcblxuICAgICAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50ICAgICAgID0gZXZlbnRzW2ldLnJlcGxhY2UoLyAvZywgJycpLFxuICAgICAgICAgICAgICAgICAgICBldmVudFBhcnRzICA9IGV2ZW50LnNwbGl0KCc6Jyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGRpcmVjdGlvbiA9IGV2ZW50UGFydHNbMF0sXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgICAgICA9IGV2ZW50UGFydHNbMV0sXG4gICAgICAgICAgICAgICAgICAgIHZpZXdUeXBlICA9IGV2ZW50UGFydHNbMl0gfHwgbnVsbDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvL0FkZCB0aGUgbGlzdGVuZXIgY2xhc3NcbiAgICAgICAgICAgICAgICBpZihkaXJlY3Rpb24gIT0gJ3NlbGYnKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuJHdyYXBwZXIuYWRkQ2xhc3MoJ2xpc3RlbmVyLScgKyBkaXJlY3Rpb24gKyAnLScgKyBuYW1lICsgKHZpZXdUeXBlID8gJy0nICsgdmlld1R5cGUgOiAnJykpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vRml4IHRoZSBsaXN0ZW5lcnMgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICBzZWxmLmxpc3RlbmVyc1tldmVudF0gPSBjYWxsYmFjaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIFxuICAgIC8qKiogVHJhdmVyc2luZyAqKiovXG5cbiAgICAkOiBmdW5jdGlvbihzZWxlY3Rvcikge1xuICAgICAgICByZXR1cm4gdGhpcy4kd3JhcHBlci5maW5kKHNlbGVjdG9yKTtcbiAgICB9LFxuICAgIF90cmF2ZXJzZTogZnVuY3Rpb24oanFGdW5jLCB0eXBlKSB7XG4gICAgICAgIHZhciAkZWwgPSB0aGlzLiR3cmFwcGVyW2pxRnVuY10oJy4nICsgKHR5cGUgPyB0aGlzLl9zdWJ2aWV3Q3NzQ2xhc3MgKyAnLScgKyB0eXBlIDogJ3N1YnZpZXcnKSk7XG4gICAgICAgIFxuICAgICAgICBpZigkZWwpIHtcbiAgICAgICAgICAgIGlmKCRlbC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGVsWzBdW3N1YnZpZXcuX2RvbVByb3BlcnR5TmFtZV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmKCRlbC5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgdmFyIGkgPSAkZWwubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBzdWJ2aWV3cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIHN1YnZpZXdzLnB1c2goJGVsW2ldW3N1YnZpZXcuX2RvbVByb3BlcnR5TmFtZV0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiBzdWJ2aWV3cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHBhcmVudDogZnVuY3Rpb24odHlwZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHJhdmVyc2UoJ2Nsb3Nlc3QnLCB0eXBlKTtcbiAgICB9LFxuICAgIG5leHQ6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RyYXZlcnNlKCduZXh0JywgdHlwZSk7XG4gICAgfSxcbiAgICBwcmV2OiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90cmF2ZXJzZSgncHJldicsIHR5cGUpO1xuICAgIH0sXG4gICAgY2hpbGRyZW46IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RyYXZlcnNlKCdmaW5kJywgdHlwZSk7XG4gICAgfSxcblxuXG4gICAgLyoqKiBDbGFzc2VzICoqKi9cblxuICAgIF9zdWJ2aWV3Q3NzQ2xhc3M6ICdzdWJ2aWV3JyxcbiAgICBfYWRkRGVmYXVsdENsYXNzZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY2xhc3NlcyA9IHRoaXMuY2xhc3NOYW1lLnNwbGl0KCcgJyk7XG5cbiAgICAgICAgY2xhc3Nlcy5wdXNoKHRoaXMuX3N1YnZpZXdDc3NDbGFzcyArICctJyArIHRoaXMudHlwZSk7XG5cbiAgICAgICAgdmFyIHN1cGVyQ2xhc3MgPSB0aGlzLnN1cGVyO1xuICAgICAgICB3aGlsZSh0cnVlKSB7XG4gICAgICAgICAgICBpZihzdXBlckNsYXNzLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjbGFzc2VzLnB1c2godGhpcy5fc3Vidmlld0Nzc0NsYXNzICsgJy0nICsgc3VwZXJDbGFzcy50eXBlKTtcbiAgICAgICAgICAgICAgICBzdXBlckNsYXNzID0gc3VwZXJDbGFzcy5zdXBlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9BZGQgRGVmYXVsdCBWaWV3IENsYXNzXG4gICAgICAgIGNsYXNzZXMucHVzaCh0aGlzLl9zdWJ2aWV3Q3NzQ2xhc3MpO1xuXG4gICAgICAgIC8vQWRkIGNsYXNzZXMgdG8gdGhlIERPTVxuICAgICAgICB0aGlzLiR3cmFwcGVyLmFkZENsYXNzKGNsYXNzZXMuam9pbignICcpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG5cbiAgICAvKioqIEV4dGVuc2lvbnMgKioqL1xuXG4gICAgX2xvYWRFeHRlbnNpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAkLmVhY2godGhpcywgZnVuY3Rpb24obmFtZSwgcHJvcCkge1xuICAgICAgICAgICAgaWYocHJvcC5faXNTdWJ2aWV3RXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgc2VsZltuYW1lXSA9IHByb3Aoc2VsZik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN1YnZpZXc7XG5cbiIsInZhciAkID0gcmVxdWlyZShcInVub3BpbmlvbmF0ZVwiKS5zZWxlY3RvcjtcblxudmFyIFN1YnZpZXdQb29sID0gZnVuY3Rpb24oU3Vidmlldykge1xuICAgIC8vQ29uZmlndXJhdGlvblxuICAgIHRoaXMuU3VidmlldyAgICA9IFN1YnZpZXc7XG4gICAgdGhpcy50eXBlICAgICAgID0gU3Vidmlldy5wcm90b3R5cGUudHlwZTtcbiAgICB0aGlzLnN1cGVyICAgICAgPSBTdWJ2aWV3LnByb3RvdHlwZS5zdXBlcjtcbiAgICBcbiAgICAvL1ZpZXcgQ29uZmlndXJhdGlvblxuICAgIHRoaXMuU3Vidmlldy5wcm90b3R5cGUucG9vbCA9IHRoaXM7XG5cbiAgICAvL1Bvb2xcbiAgICB0aGlzLnBvb2wgPSBbXTtcbn07XG5cblN1YnZpZXdQb29sLnByb3RvdHlwZSA9IHtcbiAgICBpc1N1YnZpZXdQb29sOiB0cnVlLFxuICAgIHNwYXduOiBmdW5jdGlvbihlbCwgY29uZmlnKSB7XG4gICAgICAgIC8valF1ZXJ5IG5vcm1hbGl6YXRpb25cbiAgICAgICAgdmFyICRlbCA9IGVsID8gKGVsLmpxdWVyeSA/IGVsIDogJChlbCkpOiBudWxsO1xuICAgICAgICBlbCA9IGVsICYmIGVsLmpxdWVyeSA/IGVsWzBdIDogZWw7XG5cbiAgICAgICAgLy9Bcmd1bWVudCBzdXJnZXJ5XG4gICAgICAgIGlmKGVsICYmIGVsLnZpZXcpIHtcbiAgICAgICAgICAgIHJldHVybiBlbC52aWV3O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdmFyIHZpZXc7XG4gICAgICAgICAgICBjb25maWcgPSBjb25maWcgfHwgKCQuaXNQbGFpbk9iamVjdChlbCkgPyBlbCA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vR2V0IHRoZSBET00gbm9kZVxuICAgICAgICAgICAgaWYoIWVsIHx8ICFlbC5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgIGlmKHRoaXMucG9vbC5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmlldyA9IHRoaXMucG9vbC5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLlN1YnZpZXcucHJvdG90eXBlLnRhZ05hbWUpO1xuICAgICAgICAgICAgICAgICAgICAkZWwgPSAkKGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpc05ld1ZpZXc7XG4gICAgICAgICAgICBpZighdmlldykge1xuICAgICAgICAgICAgICAgIGlzTmV3VmlldyAgID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB2aWV3ICAgICAgICA9IG5ldyB0aGlzLlN1YnZpZXcoKTtcblxuICAgICAgICAgICAgICAgIC8vQmluZCB0by9mcm9tIHRoZSBlbGVtZW50XG4gICAgICAgICAgICAgICAgZWxbc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lXSA9IHZpZXc7XG4gICAgICAgICAgICAgICAgdmlldy53cmFwcGVyICA9IGVsO1xuICAgICAgICAgICAgICAgIHZpZXcuJHdyYXBwZXIgPSAkZWw7XG5cbiAgICAgICAgICAgICAgICB2aWV3Ll9hZGREZWZhdWx0Q2xhc3NlcygpO1xuICAgICAgICAgICAgICAgIHZpZXcuX2JpbmRMaXN0ZW5lcnMoKTtcbiAgICAgICAgICAgICAgICB2aWV3Ll9sb2FkRXh0ZW5zaW9ucygpO1xuXG4gICAgICAgICAgICAgICAgdmlldy5vbmNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vTWFrZSB0aGUgdmlldyBhY3RpdmVcbiAgICAgICAgICAgIHZpZXcuYWN0aXZlID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy9SZW5kZXJcbiAgICAgICAgICAgIGlmKGlzTmV3VmlldyB8fCB2aWV3LnJlUmVuZGVyKSB7XG4gICAgICAgICAgICAgICAgdmlldy5yZW5kZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9Jbml0aWFsaXplXG4gICAgICAgICAgICB2aWV3LmluaXQoY29uZmlnKTtcblxuICAgICAgICAgICAgcmV0dXJuIHZpZXc7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGV4dGVuZDogZnVuY3Rpb24obmFtZSwgY29uZmlnKSB7XG4gICAgICAgIHJldHVybiBzdWJ2aWV3KG5hbWUsIHRoaXMsIGNvbmZpZyk7XG4gICAgfSxcbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5wb29sID0gbnVsbDtcbiAgICAgICAgZGVsZXRlIHN1YnZpZXcuU3Vidmlld3NbdGhpcy50eXBlXTtcbiAgICB9LFxuXG4gICAgX3JlbGVhc2U6IGZ1bmN0aW9uKHZpZXcpIHtcbiAgICAgICAgdmlldy5hY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5wb29sLnB1c2godmlldyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3Vidmlld1Bvb2w7XG4iLCJ2YXIgbG9nICAgICAgICAgICAgID0gcmVxdWlyZShcImxvZ2xldmVsXCIpLFxuICAgICQgICAgICAgICAgICAgICA9IHJlcXVpcmUoXCJ1bm9waW5pb25hdGVcIikuc2VsZWN0b3IsXG4gICAgVmlld1Bvb2wgICAgICAgID0gcmVxdWlyZShcIi4vU3Vidmlld1Bvb2xcIiksXG4gICAgVmlld1RlbXBsYXRlICAgID0gcmVxdWlyZShcIi4vU3Vidmlld1wiKSxcbiAgICBub29wICAgICAgICAgICAgPSBmdW5jdGlvbigpIHt9LFxuICAgIHZpZXdUeXBlUmVnZXggICA9IG5ldyBSZWdFeHAoJ14nICsgVmlld1RlbXBsYXRlLnByb3RvdHlwZS5fc3Vidmlld0Nzc0NsYXNzICsgJy0nKTtcblxudmFyIHN1YnZpZXcgPSBmdW5jdGlvbihuYW1lLCBwcm90b1ZpZXdQb29sLCBjb25maWcpIHtcbiAgICB2YXIgVmlld1Byb3RvdHlwZTtcblxuICAgIGlmKCFuYW1lKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICAvL1JldHVybiBWaWV3IG9iamVjdCBmcm9tIERPTSBlbGVtZW50XG4gICAgZWxzZSBpZihuYW1lLm5vZGVUeXBlIHx8IG5hbWUuanF1ZXJ5KSB7XG4gICAgICAgIHJldHVybiAobmFtZS5qcXVlcnkgPyBuYW1lWzBdIDogbmFtZSlbc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lXSB8fCBudWxsO1xuICAgIH1cbiAgICAvL0RlZmluZSBhIHN1YnZpZXdcbiAgICBlbHNlIHtcbiAgICAgICAgLy9Bcmd1bWVudCBzdXJnZXJ5XG4gICAgICAgIGlmKHByb3RvVmlld1Bvb2wgJiYgcHJvdG9WaWV3UG9vbC5pc1N1YnZpZXdQb29sKSB7XG4gICAgICAgICAgICBWaWV3UHJvdG90eXBlID0gcHJvdG9WaWV3UG9vbC5TdWJ2aWV3O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uZmlnICAgICAgICAgID0gcHJvdG9WaWV3UG9vbDtcbiAgICAgICAgICAgIFZpZXdQcm90b3R5cGUgICA9IFZpZXdUZW1wbGF0ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbmZpZyA9IGNvbmZpZyB8fCB7fTtcblxuICAgICAgICAvL1ZhbGlkYXRlIE5hbWUgJiYgQ29uZmlndXJhdGlvblxuICAgICAgICBpZihzdWJ2aWV3Ll92YWxpZGF0ZU5hbWUobmFtZSkgJiYgc3Vidmlldy5fdmFsaWRhdGVDb25maWcoY29uZmlnKSkge1xuICAgICAgICAgICAgLy9DcmVhdGUgdGhlIG5ldyBWaWV3XG4gICAgICAgICAgICB2YXIgVmlldyAgICAgICAgPSBmdW5jdGlvbigpIHt9LFxuICAgICAgICAgICAgICAgIHN1cGVyQ2xhc3MgID0gbmV3IFZpZXdQcm90b3R5cGUoKTtcblxuICAgICAgICAgICAgLy9FeHRlbmQgdGhlIGV4aXN0aW5nIGluaXQsIGNvbmZpZyAmIGNsZWFuIGZ1bmN0aW9ucyByYXRoZXIgdGhhbiBvdmVyd3JpdGluZyB0aGVtXG4gICAgICAgICAgICB2YXIgZXh0ZW5kRnVuY3Rpb25zID0gWydvbmNlJywgJ2luaXQnLCAnY2xlYW4nXTtcblxuICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8ZXh0ZW5kRnVuY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIGZ1bmNOYW1lID0gZXh0ZW5kRnVuY3Rpb25zW2ldLFxuICAgICAgICAgICAgICAgICAgICBmdW5jU3RhY2tOYW1lID0gJ18nICsgZnVuY05hbWUgKyAnRnVuY3Rpb25zJztcblxuICAgICAgICAgICAgICAgIGNvbmZpZ1tmdW5jU3RhY2tOYW1lXSA9IHN1cGVyQ2xhc3NbZnVuY1N0YWNrTmFtZV0uc2xpY2UoMCk7IC8vQ2xvbmUgc3VwZXJDbGFzcyBpbml0XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYoY29uZmlnW2Z1bmNOYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25maWdbZnVuY1N0YWNrTmFtZV0ucHVzaChjb25maWdbZnVuY05hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGNvbmZpZ1tmdW5jTmFtZV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL0V4dGVuZCB0aGUgbGlzdGVuZXJzIG9iamVjdFxuICAgICAgICAgICAgaWYoY29uZmlnLmxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgICQuZWFjaChzdXBlckNsYXNzLmxpc3RlbmVycywgZnVuY3Rpb24oZXZlbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGNvbmZpZy5saXN0ZW5lcnNbZXZlbnRdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvL0V4dGVuZCB0aGUgZnVuY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5saXN0ZW5lcnNbZXZlbnRdID0gKGZ1bmN0aW9uKG9sZENhbGxiYWNrLCBuZXdDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYob2xkQ2FsbGJhY2suYXBwbHkodGhpcywgYXJndW1lbnRzKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ld0NhbGxiYWNrLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKGNvbmZpZy5saXN0ZW5lcnNbZXZlbnRdLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25maWcubGlzdGVuZXJzW2V2ZW50XSA9IGNhbGxiYWNrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vRXh0ZW5kIHRoZSBWaWV3XG4gICAgICAgICAgICBmb3IodmFyIHByb3AgaW4gY29uZmlnKSB7XG4gICAgICAgICAgICAgICAgc3VwZXJDbGFzc1twcm9wXSA9IGNvbmZpZ1twcm9wXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUgPSBzdXBlckNsYXNzO1xuXG4gICAgICAgICAgICAvL0J1aWxkIFRoZSBuZXcgdmlld1xuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUudHlwZSAgPSBuYW1lO1xuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUuc3VwZXIgPSBWaWV3UHJvdG90eXBlLnByb3RvdHlwZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy9TYXZlIHRoZSBOZXcgVmlld1xuICAgICAgICAgICAgdmFyIHZpZXdQb29sICAgICAgICA9IG5ldyBWaWV3UG9vbChWaWV3KTtcbiAgICAgICAgICAgIHN1YnZpZXcuU3Vidmlld3NbbmFtZV0gPSB2aWV3UG9vbDtcblxuICAgICAgICAgICAgcmV0dXJuIHZpZXdQb29sO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zdWJ2aWV3LlN1YnZpZXdzID0ge307XG5cbi8vT2JzY3VyZSBET00gcHJvcGVydHkgbmFtZSBmb3Igc3VidmlldyB3cmFwcGVyc1xuc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lID0gXCJzdWJ2aWV3MTIzNDVcIjtcblxuLyoqKiBBUEkgKioqL1xuc3Vidmlldy5sb29rdXAgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYodHlwZW9mIG5hbWUgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuU3Vidmlld3NbbmFtZV07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZihuYW1lLmlzU3Vidmlld1Bvb2wpIHtcbiAgICAgICAgICAgIHJldHVybiBuYW1lO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYobmFtZS5pc1N1YnZpZXcpIHtcbiAgICAgICAgICAgIHJldHVybiBuYW1lLnBvb2w7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuc3Vidmlldy5fdmFsaWRhdGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGlmKCFuYW1lLm1hdGNoKC9eW2EtekEtWjAtOVxcLV9dKyQvKSkge1xuICAgICAgICBsb2cuZXJyb3IoXCJzdWJ2aWV3IG5hbWUgJ1wiICsgbmFtZSArIFwiJyBpcyBub3QgYWxwaGFudW1lcmljLlwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmKHN1YnZpZXcuU3Vidmlld3NbbmFtZV0pIHtcbiAgICAgICAgbG9nLmVycm9yKFwic3VidmlldyAnXCIgKyBuYW1lICsgXCInIGlzIGFscmVhZHkgZGVmaW5lZC5cIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbnN1YnZpZXcuX3Jlc2VydmVkTWV0aG9kcyA9IFtcbiAgICAnaHRtbCcsXG4gICAgJ3JlbW92ZScsXG4gICAgJ3BhcmVudCcsXG4gICAgJ2NoaWxkcmVuJyxcbiAgICAnbmV4dCcsXG4gICAgJ3ByZXYnLFxuICAgICd0cmlnZ2VyJyxcbiAgICAndHJhdmVyc2UnLFxuICAgICckJyxcbiAgICAnX2JpbmRMaXN0ZW5lcnMnLFxuICAgICdhY3RpdmUnLFxuICAgICdfc3Vidmlld0Nzc0NsYXNzJyxcbiAgICAnX2FkZERlZmF1bHRDbGFzc2VzJyxcbiAgICAnJHdyYXBwZXInLFxuICAgICd3cmFwcGVyJ1xuXTtcblxuc3Vidmlldy5fdmFsaWRhdGVDb25maWcgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICB2YXIgc3VjY2VzcyA9IHRydWU7XG5cbiAgICAkLmVhY2goY29uZmlnLCBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICBpZihzdWJ2aWV3Ll9yZXNlcnZlZE1ldGhvZHMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxvZy5lcnJvcihcIk1ldGhvZCAnXCIrbmFtZStcIicgaXMgcmVzZXJ2ZWQgYXMgcGFydCBvZiB0aGUgc3VidmlldyBBUEkuXCIpO1xuICAgICAgICAgICAgc3VjY2VzcyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3VjY2Vzcztcbn07XG5cbnN1YnZpZXcuaW5pdCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBNYWluID0gc3Vidmlldy5sb29rdXAoJ21haW4nKTtcblxuICAgIGlmKE1haW4pIHtcbiAgICAgICAgc3Vidmlldy5tYWluID0gTWFpbi5zcGF3bigpO1xuICAgICAgICBzdWJ2aWV3Lm1haW4uJHdyYXBwZXIuYXBwZW5kVG8oJ2JvZHknKTtcbiAgICB9XG59O1xuXG4vKioqIEV4dGVuc2lvbnMgKioqL1xuc3Vidmlldy5leHRlbnNpb24gPSBmdW5jdGlvbihleHRlbnNpb25Db25maWcpIHtcblxuICAgIC8vVGhlIEFjdHVhbCBFeHRlbnNpb24gRGVmaW5pdGlvblxuICAgIHZhciBFeHRlbnNpb24gPSBmdW5jdGlvbih1c2VyQ29uZmlnLCB2aWV3KSB7XG4gICAgICAgIHRoaXMudmlldyAgID0gdmlldztcbiAgICAgICAgdGhpcy5jb25maWcgPSB1c2VyQ29uZmlnO1xuICAgIH07XG5cbiAgICBFeHRlbnNpb24ucHJvdG90eXBlID0gZXh0ZW5zaW9uQ29uZmlnO1xuXG4gICAgaWYoIUV4dGVuc2lvbi5wcm90b3R5cGUuaW5pdCkgRXh0ZW5zaW9uLnByb3RvdHlwZS5pbml0ID0gbm9vcDtcblxuICAgIC8vIFRoaXMgZnVuY3Rpb24gZ2V0cyBjYWxsZWQgYnkgdGhlIHVzZXIgdG8gcGFzcyBpbiB0aGVpciBjb25maWd1cmF0aW9uXG4gICAgcmV0dXJuIGZ1bmN0aW9uKHVzZXJDb25maWcpIHtcblxuICAgICAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbiB2aWV3Ll9sb2FkRXh0ZW5zaW9uc1xuICAgICAgICB2YXIgRXh0ZW5zaW9uRmFjdG9yeSA9IGZ1bmN0aW9uKHZpZXcpIHtcbiAgICAgICAgICAgIHZhciBleHRlbnNpb24gPSBuZXcgRXh0ZW5zaW9uKHVzZXJDb25maWcsIHZpZXcpO1xuXG4gICAgICAgICAgICAvL0luaXRpYWxpemUgdGhlIGV4dGVuc2lvblxuICAgICAgICAgICAgZXh0ZW5zaW9uLmluaXQuYXBwbHkoZXh0ZW5zaW9uLCBbdXNlckNvbmZpZywgdmlld10pO1xuXG4gICAgICAgICAgICByZXR1cm4gZXh0ZW5zaW9uO1xuICAgICAgICB9O1xuXG4gICAgICAgIEV4dGVuc2lvbkZhY3RvcnkuX2lzU3Vidmlld0V4dGVuc2lvbiA9IHRydWU7XG5cbiAgICAgICAgcmV0dXJuIEV4dGVuc2lvbkZhY3Rvcnk7XG4gICAgfTtcbn07XG5cbi8qKiogRXhwb3J0ICoqKi9cbndpbmRvdy5zdWJ2aWV3ID0gbW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3O1xuXG4kKGZ1bmN0aW9uKCkge1xuICAgIGlmKCFzdWJ2aWV3Lm5vSW5pdCkge1xuICAgICAgICBzdWJ2aWV3LmluaXQoKTtcbiAgICB9XG59KTtcbiIsInZhciBjYWxsYmFja3MgPSBbXTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIGlmKGNhbGxiYWNrcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgc2V0RXZlbnQoKTtcbiAgICB9XG5cbiAgICBjYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG59O1xuXG5mdW5jdGlvbiBzZXRFdmVudCgpIHtcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSgpLCBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGkgPSBjYWxsYmFja3MubGVuZ3RoO1xuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIGNhbGxiYWNrc1tpXSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FsbGJhY2tzID0gW107XG4gICAgfSk7XG59XG5cbnZhciBfZXZlbnROYW1lO1xuXG5mdW5jdGlvbiBldmVudE5hbWUoKSB7XG4gICAgaWYoIV9ldmVudE5hbWUpIHtcbiAgICAgICAgLy8gU291cmNlZCBmcm9tOiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzUwMjM1MTQvaG93LWRvLWktbm9ybWFsaXplLWNzczMtdHJhbnNpdGlvbi1mdW5jdGlvbnMtYWNyb3NzLWJyb3dzZXJzXG4gICAgICAgIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2Zha2VlbGVtZW50Jyk7XG4gICAgICAgICAgICB0cmFuc2l0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAgICAgICAndHJhbnNpdGlvbmVuZCcsXG4gICAgICAgICAgICAgICAgT1RyYW5zaXRpb246ICAgICAgJ29UcmFuc2l0aW9uRW5kJyxcbiAgICAgICAgICAgICAgICBNb3pUcmFuc2l0aW9uOiAgICAndHJhbnNpdGlvbmVuZCcsXG4gICAgICAgICAgICAgICAgV2Via2l0VHJhbnNpdGlvbjogJ3dlYmtpdFRyYW5zaXRpb25FbmQnXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgIGZvcih2YXIgdCBpbiB0cmFuc2l0aW9ucykge1xuICAgICAgICAgICAgaWYoZWwuc3R5bGVbdF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIF9ldmVudE5hbWUgPSB0cmFuc2l0aW9uc1t0XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBfZXZlbnROYW1lO1xufVxuIiwiLy8gICAgIFVuZGVyc2NvcmUuanMgMS42LjBcbi8vICAgICBodHRwOi8vdW5kZXJzY29yZWpzLm9yZ1xuLy8gICAgIChjKSAyMDA5LTIwMTQgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbi8vICAgICBVbmRlcnNjb3JlIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG4oZnVuY3Rpb24oKSB7XG5cbiAgLy8gQmFzZWxpbmUgc2V0dXBcbiAgLy8gLS0tLS0tLS0tLS0tLS1cblxuICAvLyBFc3RhYmxpc2ggdGhlIHJvb3Qgb2JqZWN0LCBgd2luZG93YCBpbiB0aGUgYnJvd3Nlciwgb3IgYGV4cG9ydHNgIG9uIHRoZSBzZXJ2ZXIuXG4gIHZhciByb290ID0gdGhpcztcblxuICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgYF9gIHZhcmlhYmxlLlxuICB2YXIgcHJldmlvdXNVbmRlcnNjb3JlID0gcm9vdC5fO1xuXG4gIC8vIEVzdGFibGlzaCB0aGUgb2JqZWN0IHRoYXQgZ2V0cyByZXR1cm5lZCB0byBicmVhayBvdXQgb2YgYSBsb29wIGl0ZXJhdGlvbi5cbiAgdmFyIGJyZWFrZXIgPSB7fTtcblxuICAvLyBTYXZlIGJ5dGVzIGluIHRoZSBtaW5pZmllZCAoYnV0IG5vdCBnemlwcGVkKSB2ZXJzaW9uOlxuICB2YXIgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSwgT2JqUHJvdG8gPSBPYmplY3QucHJvdG90eXBlLCBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbiAgLy8gQ3JlYXRlIHF1aWNrIHJlZmVyZW5jZSB2YXJpYWJsZXMgZm9yIHNwZWVkIGFjY2VzcyB0byBjb3JlIHByb3RvdHlwZXMuXG4gIHZhclxuICAgIHB1c2ggICAgICAgICAgICAgPSBBcnJheVByb3RvLnB1c2gsXG4gICAgc2xpY2UgICAgICAgICAgICA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgY29uY2F0ICAgICAgICAgICA9IEFycmF5UHJvdG8uY29uY2F0LFxuICAgIHRvU3RyaW5nICAgICAgICAgPSBPYmpQcm90by50b1N0cmluZyxcbiAgICBoYXNPd25Qcm9wZXJ0eSAgID0gT2JqUHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbiAgLy8gQWxsICoqRUNNQVNjcmlwdCA1KiogbmF0aXZlIGZ1bmN0aW9uIGltcGxlbWVudGF0aW9ucyB0aGF0IHdlIGhvcGUgdG8gdXNlXG4gIC8vIGFyZSBkZWNsYXJlZCBoZXJlLlxuICB2YXJcbiAgICBuYXRpdmVGb3JFYWNoICAgICAgPSBBcnJheVByb3RvLmZvckVhY2gsXG4gICAgbmF0aXZlTWFwICAgICAgICAgID0gQXJyYXlQcm90by5tYXAsXG4gICAgbmF0aXZlUmVkdWNlICAgICAgID0gQXJyYXlQcm90by5yZWR1Y2UsXG4gICAgbmF0aXZlUmVkdWNlUmlnaHQgID0gQXJyYXlQcm90by5yZWR1Y2VSaWdodCxcbiAgICBuYXRpdmVGaWx0ZXIgICAgICAgPSBBcnJheVByb3RvLmZpbHRlcixcbiAgICBuYXRpdmVFdmVyeSAgICAgICAgPSBBcnJheVByb3RvLmV2ZXJ5LFxuICAgIG5hdGl2ZVNvbWUgICAgICAgICA9IEFycmF5UHJvdG8uc29tZSxcbiAgICBuYXRpdmVJbmRleE9mICAgICAgPSBBcnJheVByb3RvLmluZGV4T2YsXG4gICAgbmF0aXZlTGFzdEluZGV4T2YgID0gQXJyYXlQcm90by5sYXN0SW5kZXhPZixcbiAgICBuYXRpdmVJc0FycmF5ICAgICAgPSBBcnJheS5pc0FycmF5LFxuICAgIG5hdGl2ZUtleXMgICAgICAgICA9IE9iamVjdC5rZXlzLFxuICAgIG5hdGl2ZUJpbmQgICAgICAgICA9IEZ1bmNQcm90by5iaW5kO1xuXG4gIC8vIENyZWF0ZSBhIHNhZmUgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgdXNlIGJlbG93LlxuICB2YXIgXyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBfKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfKSkgcmV0dXJuIG5ldyBfKG9iaik7XG4gICAgdGhpcy5fd3JhcHBlZCA9IG9iajtcbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuICAvLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4gIC8vIHRoZSBicm93c2VyLCBhZGQgYF9gIGFzIGEgZ2xvYmFsIG9iamVjdCB2aWEgYSBzdHJpbmcgaWRlbnRpZmllcixcbiAgLy8gZm9yIENsb3N1cmUgQ29tcGlsZXIgXCJhZHZhbmNlZFwiIG1vZGUuXG4gIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IF87XG4gICAgfVxuICAgIGV4cG9ydHMuXyA9IF87XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5fID0gXztcbiAgfVxuXG4gIC8vIEN1cnJlbnQgdmVyc2lvbi5cbiAgXy5WRVJTSU9OID0gJzEuNi4wJztcblxuICAvLyBDb2xsZWN0aW9uIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFRoZSBjb3JuZXJzdG9uZSwgYW4gYGVhY2hgIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIG9iamVjdHMgd2l0aCB0aGUgYnVpbHQtaW4gYGZvckVhY2hgLCBhcnJheXMsIGFuZCByYXcgb2JqZWN0cy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGZvckVhY2hgIGlmIGF2YWlsYWJsZS5cbiAgdmFyIGVhY2ggPSBfLmVhY2ggPSBfLmZvckVhY2ggPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gb2JqO1xuICAgIGlmIChuYXRpdmVGb3JFYWNoICYmIG9iai5mb3JFYWNoID09PSBuYXRpdmVGb3JFYWNoKSB7XG4gICAgICBvYmouZm9yRWFjaChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IG9iai5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtrZXlzW2ldXSwga2V5c1tpXSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0b3IgdG8gZWFjaCBlbGVtZW50LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbWFwYCBpZiBhdmFpbGFibGUuXG4gIF8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBpZiAobmF0aXZlTWFwICYmIG9iai5tYXAgPT09IG5hdGl2ZU1hcCkgcmV0dXJuIG9iai5tYXAoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIHZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gIC8vIG9yIGBmb2xkbGAuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGByZWR1Y2VgIGlmIGF2YWlsYWJsZS5cbiAgXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGlmIChuYXRpdmVSZWR1Y2UgJiYgb2JqLnJlZHVjZSA9PT0gbmF0aXZlUmVkdWNlKSB7XG4gICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgcmV0dXJuIGluaXRpYWwgPyBvYmoucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKSA6IG9iai5yZWR1Y2UoaXRlcmF0b3IpO1xuICAgIH1cbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgbWVtbyA9IHZhbHVlO1xuICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICByZXR1cm4gbWVtbztcbiAgfTtcblxuICAvLyBUaGUgcmlnaHQtYXNzb2NpYXRpdmUgdmVyc2lvbiBvZiByZWR1Y2UsIGFsc28ga25vd24gYXMgYGZvbGRyYC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZVJpZ2h0YCBpZiBhdmFpbGFibGUuXG4gIF8ucmVkdWNlUmlnaHQgPSBfLmZvbGRyID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlUmlnaHQgJiYgb2JqLnJlZHVjZVJpZ2h0ID09PSBuYXRpdmVSZWR1Y2VSaWdodCkge1xuICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZVJpZ2h0KGl0ZXJhdG9yLCBtZW1vKSA6IG9iai5yZWR1Y2VSaWdodChpdGVyYXRvcik7XG4gICAgfVxuICAgIHZhciBsZW5ndGggPSBvYmoubGVuZ3RoO1xuICAgIGlmIChsZW5ndGggIT09ICtsZW5ndGgpIHtcbiAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB9XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaW5kZXggPSBrZXlzID8ga2V5c1stLWxlbmd0aF0gOiAtLWxlbmd0aDtcbiAgICAgIGlmICghaW5pdGlhbCkge1xuICAgICAgICBtZW1vID0gb2JqW2luZGV4XTtcbiAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCBvYmpbaW5kZXhdLCBpbmRleCwgbGlzdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICByZXR1cm4gbWVtbztcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IHZhbHVlIHdoaWNoIHBhc3NlcyBhIHRydXRoIHRlc3QuIEFsaWFzZWQgYXMgYGRldGVjdGAuXG4gIF8uZmluZCA9IF8uZGV0ZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIGFueShvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGZpbHRlcmAgaWYgYXZhaWxhYmxlLlxuICAvLyBBbGlhc2VkIGFzIGBzZWxlY3RgLlxuICBfLmZpbHRlciA9IF8uc2VsZWN0ID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZUZpbHRlciAmJiBvYmouZmlsdGVyID09PSBuYXRpdmVGaWx0ZXIpIHJldHVybiBvYmouZmlsdGVyKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHByZWRpY2F0ZS5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpIHJlc3VsdHMucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgZm9yIHdoaWNoIGEgdHJ1dGggdGVzdCBmYWlscy5cbiAgXy5yZWplY3QgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuICFwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpO1xuICAgIH0sIGNvbnRleHQpO1xuICB9O1xuXG4gIC8vIERldGVybWluZSB3aGV0aGVyIGFsbCBvZiB0aGUgZWxlbWVudHMgbWF0Y2ggYSB0cnV0aCB0ZXN0LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgZXZlcnlgIGlmIGF2YWlsYWJsZS5cbiAgLy8gQWxpYXNlZCBhcyBgYWxsYC5cbiAgXy5ldmVyeSA9IF8uYWxsID0gZnVuY3Rpb24ob2JqLCBwcmVkaWNhdGUsIGNvbnRleHQpIHtcbiAgICBwcmVkaWNhdGUgfHwgKHByZWRpY2F0ZSA9IF8uaWRlbnRpdHkpO1xuICAgIHZhciByZXN1bHQgPSB0cnVlO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAobmF0aXZlRXZlcnkgJiYgb2JqLmV2ZXJ5ID09PSBuYXRpdmVFdmVyeSkgcmV0dXJuIG9iai5ldmVyeShwcmVkaWNhdGUsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmICghKHJlc3VsdCA9IHJlc3VsdCAmJiBwcmVkaWNhdGUuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSkgcmV0dXJuIGJyZWFrZXI7XG4gICAgfSk7XG4gICAgcmV0dXJuICEhcmVzdWx0O1xuICB9O1xuXG4gIC8vIERldGVybWluZSBpZiBhdCBsZWFzdCBvbmUgZWxlbWVudCBpbiB0aGUgb2JqZWN0IG1hdGNoZXMgYSB0cnV0aCB0ZXN0LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgc29tZWAgaWYgYXZhaWxhYmxlLlxuICAvLyBBbGlhc2VkIGFzIGBhbnlgLlxuICB2YXIgYW55ID0gXy5zb21lID0gXy5hbnkgPSBmdW5jdGlvbihvYmosIHByZWRpY2F0ZSwgY29udGV4dCkge1xuICAgIHByZWRpY2F0ZSB8fCAocHJlZGljYXRlID0gXy5pZGVudGl0eSk7XG4gICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAobmF0aXZlU29tZSAmJiBvYmouc29tZSA9PT0gbmF0aXZlU29tZSkgcmV0dXJuIG9iai5zb21lKHByZWRpY2F0ZSwgY29udGV4dCk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaWYgKHJlc3VsdCB8fCAocmVzdWx0ID0gcHJlZGljYXRlLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSkpIHJldHVybiBicmVha2VyO1xuICAgIH0pO1xuICAgIHJldHVybiAhIXJlc3VsdDtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgdGhlIGFycmF5IG9yIG9iamVjdCBjb250YWlucyBhIGdpdmVuIHZhbHVlICh1c2luZyBgPT09YCkuXG4gIC8vIEFsaWFzZWQgYXMgYGluY2x1ZGVgLlxuICBfLmNvbnRhaW5zID0gXy5pbmNsdWRlID0gZnVuY3Rpb24ob2JqLCB0YXJnZXQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBpZiAobmF0aXZlSW5kZXhPZiAmJiBvYmouaW5kZXhPZiA9PT0gbmF0aXZlSW5kZXhPZikgcmV0dXJuIG9iai5pbmRleE9mKHRhcmdldCkgIT0gLTE7XG4gICAgcmV0dXJuIGFueShvYmosIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWUgPT09IHRhcmdldDtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgXy5pbnZva2UgPSBmdW5jdGlvbihvYmosIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHZhciBpc0Z1bmMgPSBfLmlzRnVuY3Rpb24obWV0aG9kKTtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIChpc0Z1bmMgPyBtZXRob2QgOiB2YWx1ZVttZXRob2RdKS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbiAgXy5wbHVjayA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgXy5wcm9wZXJ0eShrZXkpKTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBmaWx0ZXJgOiBzZWxlY3Rpbmcgb25seSBvYmplY3RzXG4gIC8vIGNvbnRhaW5pbmcgc3BlY2lmaWMgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8ud2hlcmUgPSBmdW5jdGlvbihvYmosIGF0dHJzKSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKG9iaiwgXy5tYXRjaGVzKGF0dHJzKSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmluZGA6IGdldHRpbmcgdGhlIGZpcnN0IG9iamVjdFxuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLmZpbmRXaGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMpIHtcbiAgICByZXR1cm4gXy5maW5kKG9iaiwgXy5tYXRjaGVzKGF0dHJzKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBtYXhpbXVtIGVsZW1lbnQgb3IgKGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuICAvLyBDYW4ndCBvcHRpbWl6ZSBhcnJheXMgb2YgaW50ZWdlcnMgbG9uZ2VyIHRoYW4gNjUsNTM1IGVsZW1lbnRzLlxuICAvLyBTZWUgW1dlYktpdCBCdWcgODA3OTddKGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD04MDc5NylcbiAgXy5tYXggPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpdGVyYXRvciAmJiBfLmlzQXJyYXkob2JqKSAmJiBvYmpbMF0gPT09ICtvYmpbMF0gJiYgb2JqLmxlbmd0aCA8IDY1NTM1KSB7XG4gICAgICByZXR1cm4gTWF0aC5tYXguYXBwbHkoTWF0aCwgb2JqKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IC1JbmZpbml0eSwgbGFzdENvbXB1dGVkID0gLUluZmluaXR5O1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHZhciBjb21wdXRlZCA9IGl0ZXJhdG9yID8gaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpIDogdmFsdWU7XG4gICAgICBpZiAoY29tcHV0ZWQgPiBsYXN0Q29tcHV0ZWQpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBtaW5pbXVtIGVsZW1lbnQgKG9yIGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuICBfLm1pbiA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoIWl0ZXJhdG9yICYmIF8uaXNBcnJheShvYmopICYmIG9ialswXSA9PT0gK29ialswXSAmJiBvYmoubGVuZ3RoIDwgNjU1MzUpIHtcbiAgICAgIHJldHVybiBNYXRoLm1pbi5hcHBseShNYXRoLCBvYmopO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gSW5maW5pdHksIGxhc3RDb21wdXRlZCA9IEluZmluaXR5O1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHZhciBjb21wdXRlZCA9IGl0ZXJhdG9yID8gaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpIDogdmFsdWU7XG4gICAgICBpZiAoY29tcHV0ZWQgPCBsYXN0Q29tcHV0ZWQpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIGxhc3RDb21wdXRlZCA9IGNvbXB1dGVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gU2h1ZmZsZSBhbiBhcnJheSwgdXNpbmcgdGhlIG1vZGVybiB2ZXJzaW9uIG9mIHRoZVxuICAvLyBbRmlzaGVyLVlhdGVzIHNodWZmbGVdKGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmlzaGVy4oCTWWF0ZXNfc2h1ZmZsZSkuXG4gIF8uc2h1ZmZsZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciByYW5kO1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNodWZmbGVkID0gW107XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByYW5kID0gXy5yYW5kb20oaW5kZXgrKyk7XG4gICAgICBzaHVmZmxlZFtpbmRleCAtIDFdID0gc2h1ZmZsZWRbcmFuZF07XG4gICAgICBzaHVmZmxlZFtyYW5kXSA9IHZhbHVlO1xuICAgIH0pO1xuICAgIHJldHVybiBzaHVmZmxlZDtcbiAgfTtcblxuICAvLyBTYW1wbGUgKipuKiogcmFuZG9tIHZhbHVlcyBmcm9tIGEgY29sbGVjdGlvbi5cbiAgLy8gSWYgKipuKiogaXMgbm90IHNwZWNpZmllZCwgcmV0dXJucyBhIHNpbmdsZSByYW5kb20gZWxlbWVudC5cbiAgLy8gVGhlIGludGVybmFsIGBndWFyZGAgYXJndW1lbnQgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgbWFwYC5cbiAgXy5zYW1wbGUgPSBmdW5jdGlvbihvYmosIG4sIGd1YXJkKSB7XG4gICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkge1xuICAgICAgaWYgKG9iai5sZW5ndGggIT09ICtvYmoubGVuZ3RoKSBvYmogPSBfLnZhbHVlcyhvYmopO1xuICAgICAgcmV0dXJuIG9ialtfLnJhbmRvbShvYmoubGVuZ3RoIC0gMSldO1xuICAgIH1cbiAgICByZXR1cm4gXy5zaHVmZmxlKG9iaikuc2xpY2UoMCwgTWF0aC5tYXgoMCwgbikpO1xuICB9O1xuXG4gIC8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGxvb2t1cCBpdGVyYXRvcnMuXG4gIHZhciBsb29rdXBJdGVyYXRvciA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlID09IG51bGwpIHJldHVybiBfLmlkZW50aXR5O1xuICAgIGlmIChfLmlzRnVuY3Rpb24odmFsdWUpKSByZXR1cm4gdmFsdWU7XG4gICAgcmV0dXJuIF8ucHJvcGVydHkodmFsdWUpO1xuICB9O1xuXG4gIC8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRvci5cbiAgXy5zb3J0QnkgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgcmV0dXJuIF8ucGx1Y2soXy5tYXAob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICBjcml0ZXJpYTogaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpXG4gICAgICB9O1xuICAgIH0pLnNvcnQoZnVuY3Rpb24obGVmdCwgcmlnaHQpIHtcbiAgICAgIHZhciBhID0gbGVmdC5jcml0ZXJpYTtcbiAgICAgIHZhciBiID0gcmlnaHQuY3JpdGVyaWE7XG4gICAgICBpZiAoYSAhPT0gYikge1xuICAgICAgICBpZiAoYSA+IGIgfHwgYSA9PT0gdm9pZCAwKSByZXR1cm4gMTtcbiAgICAgICAgaWYgKGEgPCBiIHx8IGIgPT09IHZvaWQgMCkgcmV0dXJuIC0xO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGxlZnQuaW5kZXggLSByaWdodC5pbmRleDtcbiAgICB9KSwgJ3ZhbHVlJyk7XG4gIH07XG5cbiAgLy8gQW4gaW50ZXJuYWwgZnVuY3Rpb24gdXNlZCBmb3IgYWdncmVnYXRlIFwiZ3JvdXAgYnlcIiBvcGVyYXRpb25zLlxuICB2YXIgZ3JvdXAgPSBmdW5jdGlvbihiZWhhdmlvcikge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICBpdGVyYXRvciA9IGxvb2t1cEl0ZXJhdG9yKGl0ZXJhdG9yKTtcbiAgICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgICAgdmFyIGtleSA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBvYmopO1xuICAgICAgICBiZWhhdmlvcihyZXN1bHQsIGtleSwgdmFsdWUpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gR3JvdXBzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24uIFBhc3MgZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZVxuICAvLyB0byBncm91cCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlIGNyaXRlcmlvbi5cbiAgXy5ncm91cEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCBrZXksIHZhbHVlKSB7XG4gICAgXy5oYXMocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0ucHVzaCh2YWx1ZSkgOiByZXN1bHRba2V5XSA9IFt2YWx1ZV07XG4gIH0pO1xuXG4gIC8vIEluZGV4ZXMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiwgc2ltaWxhciB0byBgZ3JvdXBCeWAsIGJ1dCBmb3JcbiAgLy8gd2hlbiB5b3Uga25vdyB0aGF0IHlvdXIgaW5kZXggdmFsdWVzIHdpbGwgYmUgdW5pcXVlLlxuICBfLmluZGV4QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIGtleSwgdmFsdWUpIHtcbiAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICB9KTtcblxuICAvLyBDb3VudHMgaW5zdGFuY2VzIG9mIGFuIG9iamVjdCB0aGF0IGdyb3VwIGJ5IGEgY2VydGFpbiBjcml0ZXJpb24uIFBhc3NcbiAgLy8gZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZSB0byBjb3VudCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlXG4gIC8vIGNyaXRlcmlvbi5cbiAgXy5jb3VudEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCBrZXkpIHtcbiAgICBfLmhhcyhyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSsrIDogcmVzdWx0W2tleV0gPSAxO1xuICB9KTtcblxuICAvLyBVc2UgYSBjb21wYXJhdG9yIGZ1bmN0aW9uIHRvIGZpZ3VyZSBvdXQgdGhlIHNtYWxsZXN0IGluZGV4IGF0IHdoaWNoXG4gIC8vIGFuIG9iamVjdCBzaG91bGQgYmUgaW5zZXJ0ZWQgc28gYXMgdG8gbWFpbnRhaW4gb3JkZXIuIFVzZXMgYmluYXJ5IHNlYXJjaC5cbiAgXy5zb3J0ZWRJbmRleCA9IGZ1bmN0aW9uKGFycmF5LCBvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgPSBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgdmFyIHZhbHVlID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmopO1xuICAgIHZhciBsb3cgPSAwLCBoaWdoID0gYXJyYXkubGVuZ3RoO1xuICAgIHdoaWxlIChsb3cgPCBoaWdoKSB7XG4gICAgICB2YXIgbWlkID0gKGxvdyArIGhpZ2gpID4+PiAxO1xuICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBhcnJheVttaWRdKSA8IHZhbHVlID8gbG93ID0gbWlkICsgMSA6IGhpZ2ggPSBtaWQ7XG4gICAgfVxuICAgIHJldHVybiBsb3c7XG4gIH07XG5cbiAgLy8gU2FmZWx5IGNyZWF0ZSBhIHJlYWwsIGxpdmUgYXJyYXkgZnJvbSBhbnl0aGluZyBpdGVyYWJsZS5cbiAgXy50b0FycmF5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFvYmopIHJldHVybiBbXTtcbiAgICBpZiAoXy5pc0FycmF5KG9iaikpIHJldHVybiBzbGljZS5jYWxsKG9iaik7XG4gICAgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSByZXR1cm4gXy5tYXAob2JqLCBfLmlkZW50aXR5KTtcbiAgICByZXR1cm4gXy52YWx1ZXMob2JqKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG51bWJlciBvZiBlbGVtZW50cyBpbiBhbiBvYmplY3QuXG4gIF8uc2l6ZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIDA7XG4gICAgcmV0dXJuIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkgPyBvYmoubGVuZ3RoIDogXy5rZXlzKG9iaikubGVuZ3RoO1xuICB9O1xuXG4gIC8vIEFycmF5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS1cblxuICAvLyBHZXQgdGhlIGZpcnN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGZpcnN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgaGVhZGAgYW5kIGB0YWtlYC4gVGhlICoqZ3VhcmQqKiBjaGVja1xuICAvLyBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8uZmlyc3QgPSBfLmhlYWQgPSBfLnRha2UgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAoKG4gPT0gbnVsbCkgfHwgZ3VhcmQpIHJldHVybiBhcnJheVswXTtcbiAgICBpZiAobiA8IDApIHJldHVybiBbXTtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgbik7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgbGFzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEVzcGVjaWFsbHkgdXNlZnVsIG9uXG4gIC8vIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIGFsbCB0aGUgdmFsdWVzIGluXG4gIC8vIHRoZSBhcnJheSwgZXhjbHVkaW5nIHRoZSBsYXN0IE4uIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aFxuICAvLyBgXy5tYXBgLlxuICBfLmluaXRpYWwgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgYXJyYXkubGVuZ3RoIC0gKChuID09IG51bGwpIHx8IGd1YXJkID8gMSA6IG4pKTtcbiAgfTtcblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLmxhc3QgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAoKG4gPT0gbnVsbCkgfHwgZ3VhcmQpIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgTWF0aC5tYXgoYXJyYXkubGVuZ3RoIC0gbiwgMCkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGZpcnN0IGVudHJ5IG9mIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgdGFpbGAgYW5kIGBkcm9wYC5cbiAgLy8gRXNwZWNpYWxseSB1c2VmdWwgb24gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgYW4gKipuKiogd2lsbCByZXR1cm5cbiAgLy8gdGhlIHJlc3QgTiB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqXG4gIC8vIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5yZXN0ID0gXy50YWlsID0gXy5kcm9wID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIChuID09IG51bGwpIHx8IGd1YXJkID8gMSA6IG4pO1xuICB9O1xuXG4gIC8vIFRyaW0gb3V0IGFsbCBmYWxzeSB2YWx1ZXMgZnJvbSBhbiBhcnJheS5cbiAgXy5jb21wYWN0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIoYXJyYXksIF8uaWRlbnRpdHkpO1xuICB9O1xuXG4gIC8vIEludGVybmFsIGltcGxlbWVudGF0aW9uIG9mIGEgcmVjdXJzaXZlIGBmbGF0dGVuYCBmdW5jdGlvbi5cbiAgdmFyIGZsYXR0ZW4gPSBmdW5jdGlvbihpbnB1dCwgc2hhbGxvdywgb3V0cHV0KSB7XG4gICAgaWYgKHNoYWxsb3cgJiYgXy5ldmVyeShpbnB1dCwgXy5pc0FycmF5KSkge1xuICAgICAgcmV0dXJuIGNvbmNhdC5hcHBseShvdXRwdXQsIGlucHV0KTtcbiAgICB9XG4gICAgZWFjaChpbnB1dCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmIChfLmlzQXJyYXkodmFsdWUpIHx8IF8uaXNBcmd1bWVudHModmFsdWUpKSB7XG4gICAgICAgIHNoYWxsb3cgPyBwdXNoLmFwcGx5KG91dHB1dCwgdmFsdWUpIDogZmxhdHRlbih2YWx1ZSwgc2hhbGxvdywgb3V0cHV0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9O1xuXG4gIC8vIEZsYXR0ZW4gb3V0IGFuIGFycmF5LCBlaXRoZXIgcmVjdXJzaXZlbHkgKGJ5IGRlZmF1bHQpLCBvciBqdXN0IG9uZSBsZXZlbC5cbiAgXy5mbGF0dGVuID0gZnVuY3Rpb24oYXJyYXksIHNoYWxsb3cpIHtcbiAgICByZXR1cm4gZmxhdHRlbihhcnJheSwgc2hhbGxvdywgW10pO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHZlcnNpb24gb2YgdGhlIGFycmF5IHRoYXQgZG9lcyBub3QgY29udGFpbiB0aGUgc3BlY2lmaWVkIHZhbHVlKHMpLlxuICBfLndpdGhvdXQgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmRpZmZlcmVuY2UoYXJyYXksIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gIH07XG5cbiAgLy8gU3BsaXQgYW4gYXJyYXkgaW50byB0d28gYXJyYXlzOiBvbmUgd2hvc2UgZWxlbWVudHMgYWxsIHNhdGlzZnkgdGhlIGdpdmVuXG4gIC8vIHByZWRpY2F0ZSwgYW5kIG9uZSB3aG9zZSBlbGVtZW50cyBhbGwgZG8gbm90IHNhdGlzZnkgdGhlIHByZWRpY2F0ZS5cbiAgXy5wYXJ0aXRpb24gPSBmdW5jdGlvbihhcnJheSwgcHJlZGljYXRlKSB7XG4gICAgdmFyIHBhc3MgPSBbXSwgZmFpbCA9IFtdO1xuICAgIGVhY2goYXJyYXksIGZ1bmN0aW9uKGVsZW0pIHtcbiAgICAgIChwcmVkaWNhdGUoZWxlbSkgPyBwYXNzIDogZmFpbCkucHVzaChlbGVtKTtcbiAgICB9KTtcbiAgICByZXR1cm4gW3Bhc3MsIGZhaWxdO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYSBkdXBsaWNhdGUtZnJlZSB2ZXJzaW9uIG9mIHRoZSBhcnJheS4gSWYgdGhlIGFycmF5IGhhcyBhbHJlYWR5XG4gIC8vIGJlZW4gc29ydGVkLCB5b3UgaGF2ZSB0aGUgb3B0aW9uIG9mIHVzaW5nIGEgZmFzdGVyIGFsZ29yaXRobS5cbiAgLy8gQWxpYXNlZCBhcyBgdW5pcXVlYC5cbiAgXy51bmlxID0gXy51bmlxdWUgPSBmdW5jdGlvbihhcnJheSwgaXNTb3J0ZWQsIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKF8uaXNGdW5jdGlvbihpc1NvcnRlZCkpIHtcbiAgICAgIGNvbnRleHQgPSBpdGVyYXRvcjtcbiAgICAgIGl0ZXJhdG9yID0gaXNTb3J0ZWQ7XG4gICAgICBpc1NvcnRlZCA9IGZhbHNlO1xuICAgIH1cbiAgICB2YXIgaW5pdGlhbCA9IGl0ZXJhdG9yID8gXy5tYXAoYXJyYXksIGl0ZXJhdG9yLCBjb250ZXh0KSA6IGFycmF5O1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgdmFyIHNlZW4gPSBbXTtcbiAgICBlYWNoKGluaXRpYWwsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgaWYgKGlzU29ydGVkID8gKCFpbmRleCB8fCBzZWVuW3NlZW4ubGVuZ3RoIC0gMV0gIT09IHZhbHVlKSA6ICFfLmNvbnRhaW5zKHNlZW4sIHZhbHVlKSkge1xuICAgICAgICBzZWVuLnB1c2godmFsdWUpO1xuICAgICAgICByZXN1bHRzLnB1c2goYXJyYXlbaW5kZXhdKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICAvLyBQcm9kdWNlIGFuIGFycmF5IHRoYXQgY29udGFpbnMgdGhlIHVuaW9uOiBlYWNoIGRpc3RpbmN0IGVsZW1lbnQgZnJvbSBhbGwgb2ZcbiAgLy8gdGhlIHBhc3NlZC1pbiBhcnJheXMuXG4gIF8udW5pb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXy51bmlxKF8uZmxhdHRlbihhcmd1bWVudHMsIHRydWUpKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGFuIGFycmF5IHRoYXQgY29udGFpbnMgZXZlcnkgaXRlbSBzaGFyZWQgYmV0d2VlbiBhbGwgdGhlXG4gIC8vIHBhc3NlZC1pbiBhcnJheXMuXG4gIF8uaW50ZXJzZWN0aW9uID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICB2YXIgcmVzdCA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gXy5maWx0ZXIoXy51bmlxKGFycmF5KSwgZnVuY3Rpb24oaXRlbSkge1xuICAgICAgcmV0dXJuIF8uZXZlcnkocmVzdCwgZnVuY3Rpb24ob3RoZXIpIHtcbiAgICAgICAgcmV0dXJuIF8uY29udGFpbnMob3RoZXIsIGl0ZW0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gVGFrZSB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIG9uZSBhcnJheSBhbmQgYSBudW1iZXIgb2Ygb3RoZXIgYXJyYXlzLlxuICAvLyBPbmx5IHRoZSBlbGVtZW50cyBwcmVzZW50IGluIGp1c3QgdGhlIGZpcnN0IGFycmF5IHdpbGwgcmVtYWluLlxuICBfLmRpZmZlcmVuY2UgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHZhciByZXN0ID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7IHJldHVybiAhXy5jb250YWlucyhyZXN0LCB2YWx1ZSk7IH0pO1xuICB9O1xuXG4gIC8vIFppcCB0b2dldGhlciBtdWx0aXBsZSBsaXN0cyBpbnRvIGEgc2luZ2xlIGFycmF5IC0tIGVsZW1lbnRzIHRoYXQgc2hhcmVcbiAgLy8gYW4gaW5kZXggZ28gdG9nZXRoZXIuXG4gIF8uemlwID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxlbmd0aCA9IF8ubWF4KF8ucGx1Y2soYXJndW1lbnRzLCAnbGVuZ3RoJykuY29uY2F0KDApKTtcbiAgICB2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdHNbaV0gPSBfLnBsdWNrKGFyZ3VtZW50cywgJycgKyBpKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gQ29udmVydHMgbGlzdHMgaW50byBvYmplY3RzLiBQYXNzIGVpdGhlciBhIHNpbmdsZSBhcnJheSBvZiBgW2tleSwgdmFsdWVdYFxuICAvLyBwYWlycywgb3IgdHdvIHBhcmFsbGVsIGFycmF5cyBvZiB0aGUgc2FtZSBsZW5ndGggLS0gb25lIG9mIGtleXMsIGFuZCBvbmUgb2ZcbiAgLy8gdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVzLlxuICBfLm9iamVjdCA9IGZ1bmN0aW9uKGxpc3QsIHZhbHVlcykge1xuICAgIGlmIChsaXN0ID09IG51bGwpIHJldHVybiB7fTtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGxpc3QubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh2YWx1ZXMpIHtcbiAgICAgICAgcmVzdWx0W2xpc3RbaV1dID0gdmFsdWVzW2ldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0W2xpc3RbaV1bMF1dID0gbGlzdFtpXVsxXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBJZiB0aGUgYnJvd3NlciBkb2Vzbid0IHN1cHBseSB1cyB3aXRoIGluZGV4T2YgKEknbSBsb29raW5nIGF0IHlvdSwgKipNU0lFKiopLFxuICAvLyB3ZSBuZWVkIHRoaXMgZnVuY3Rpb24uIFJldHVybiB0aGUgcG9zaXRpb24gb2YgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYW5cbiAgLy8gaXRlbSBpbiBhbiBhcnJheSwgb3IgLTEgaWYgdGhlIGl0ZW0gaXMgbm90IGluY2x1ZGVkIGluIHRoZSBhcnJheS5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGluZGV4T2ZgIGlmIGF2YWlsYWJsZS5cbiAgLy8gSWYgdGhlIGFycmF5IGlzIGxhcmdlIGFuZCBhbHJlYWR5IGluIHNvcnQgb3JkZXIsIHBhc3MgYHRydWVgXG4gIC8vIGZvciAqKmlzU29ydGVkKiogdG8gdXNlIGJpbmFyeSBzZWFyY2guXG4gIF8uaW5kZXhPZiA9IGZ1bmN0aW9uKGFycmF5LCBpdGVtLCBpc1NvcnRlZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gLTE7XG4gICAgdmFyIGkgPSAwLCBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG4gICAgaWYgKGlzU29ydGVkKSB7XG4gICAgICBpZiAodHlwZW9mIGlzU29ydGVkID09ICdudW1iZXInKSB7XG4gICAgICAgIGkgPSAoaXNTb3J0ZWQgPCAwID8gTWF0aC5tYXgoMCwgbGVuZ3RoICsgaXNTb3J0ZWQpIDogaXNTb3J0ZWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaSA9IF8uc29ydGVkSW5kZXgoYXJyYXksIGl0ZW0pO1xuICAgICAgICByZXR1cm4gYXJyYXlbaV0gPT09IGl0ZW0gPyBpIDogLTE7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChuYXRpdmVJbmRleE9mICYmIGFycmF5LmluZGV4T2YgPT09IG5hdGl2ZUluZGV4T2YpIHJldHVybiBhcnJheS5pbmRleE9mKGl0ZW0sIGlzU29ydGVkKTtcbiAgICBmb3IgKDsgaSA8IGxlbmd0aDsgaSsrKSBpZiAoYXJyYXlbaV0gPT09IGl0ZW0pIHJldHVybiBpO1xuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbGFzdEluZGV4T2ZgIGlmIGF2YWlsYWJsZS5cbiAgXy5sYXN0SW5kZXhPZiA9IGZ1bmN0aW9uKGFycmF5LCBpdGVtLCBmcm9tKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaGFzSW5kZXggPSBmcm9tICE9IG51bGw7XG4gICAgaWYgKG5hdGl2ZUxhc3RJbmRleE9mICYmIGFycmF5Lmxhc3RJbmRleE9mID09PSBuYXRpdmVMYXN0SW5kZXhPZikge1xuICAgICAgcmV0dXJuIGhhc0luZGV4ID8gYXJyYXkubGFzdEluZGV4T2YoaXRlbSwgZnJvbSkgOiBhcnJheS5sYXN0SW5kZXhPZihpdGVtKTtcbiAgICB9XG4gICAgdmFyIGkgPSAoaGFzSW5kZXggPyBmcm9tIDogYXJyYXkubGVuZ3RoKTtcbiAgICB3aGlsZSAoaS0tKSBpZiAoYXJyYXlbaV0gPT09IGl0ZW0pIHJldHVybiBpO1xuICAgIHJldHVybiAtMTtcbiAgfTtcblxuICAvLyBHZW5lcmF0ZSBhbiBpbnRlZ2VyIEFycmF5IGNvbnRhaW5pbmcgYW4gYXJpdGhtZXRpYyBwcm9ncmVzc2lvbi4gQSBwb3J0IG9mXG4gIC8vIHRoZSBuYXRpdmUgUHl0aG9uIGByYW5nZSgpYCBmdW5jdGlvbi4gU2VlXG4gIC8vIFt0aGUgUHl0aG9uIGRvY3VtZW50YXRpb25dKGh0dHA6Ly9kb2NzLnB5dGhvbi5vcmcvbGlicmFyeS9mdW5jdGlvbnMuaHRtbCNyYW5nZSkuXG4gIF8ucmFuZ2UgPSBmdW5jdGlvbihzdGFydCwgc3RvcCwgc3RlcCkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDw9IDEpIHtcbiAgICAgIHN0b3AgPSBzdGFydCB8fCAwO1xuICAgICAgc3RhcnQgPSAwO1xuICAgIH1cbiAgICBzdGVwID0gYXJndW1lbnRzWzJdIHx8IDE7XG5cbiAgICB2YXIgbGVuZ3RoID0gTWF0aC5tYXgoTWF0aC5jZWlsKChzdG9wIC0gc3RhcnQpIC8gc3RlcCksIDApO1xuICAgIHZhciBpZHggPSAwO1xuICAgIHZhciByYW5nZSA9IG5ldyBBcnJheShsZW5ndGgpO1xuXG4gICAgd2hpbGUoaWR4IDwgbGVuZ3RoKSB7XG4gICAgICByYW5nZVtpZHgrK10gPSBzdGFydDtcbiAgICAgIHN0YXJ0ICs9IHN0ZXA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJhbmdlO1xuICB9O1xuXG4gIC8vIEZ1bmN0aW9uIChhaGVtKSBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUmV1c2FibGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHByb3RvdHlwZSBzZXR0aW5nLlxuICB2YXIgY3RvciA9IGZ1bmN0aW9uKCl7fTtcblxuICAvLyBDcmVhdGUgYSBmdW5jdGlvbiBib3VuZCB0byBhIGdpdmVuIG9iamVjdCAoYXNzaWduaW5nIGB0aGlzYCwgYW5kIGFyZ3VtZW50cyxcbiAgLy8gb3B0aW9uYWxseSkuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBGdW5jdGlvbi5iaW5kYCBpZlxuICAvLyBhdmFpbGFibGUuXG4gIF8uYmluZCA9IGZ1bmN0aW9uKGZ1bmMsIGNvbnRleHQpIHtcbiAgICB2YXIgYXJncywgYm91bmQ7XG4gICAgaWYgKG5hdGl2ZUJpbmQgJiYgZnVuYy5iaW5kID09PSBuYXRpdmVCaW5kKSByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGlmICghXy5pc0Z1bmN0aW9uKGZ1bmMpKSB0aHJvdyBuZXcgVHlwZUVycm9yO1xuICAgIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIGJvdW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgYm91bmQpKSByZXR1cm4gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgIGN0b3IucHJvdG90eXBlID0gZnVuYy5wcm90b3R5cGU7XG4gICAgICB2YXIgc2VsZiA9IG5ldyBjdG9yO1xuICAgICAgY3Rvci5wcm90b3R5cGUgPSBudWxsO1xuICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkoc2VsZiwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBpZiAoT2JqZWN0KHJlc3VsdCkgPT09IHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgIHJldHVybiBzZWxmO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUGFydGlhbGx5IGFwcGx5IGEgZnVuY3Rpb24gYnkgY3JlYXRpbmcgYSB2ZXJzaW9uIHRoYXQgaGFzIGhhZCBzb21lIG9mIGl0c1xuICAvLyBhcmd1bWVudHMgcHJlLWZpbGxlZCwgd2l0aG91dCBjaGFuZ2luZyBpdHMgZHluYW1pYyBgdGhpc2AgY29udGV4dC4gXyBhY3RzXG4gIC8vIGFzIGEgcGxhY2Vob2xkZXIsIGFsbG93aW5nIGFueSBjb21iaW5hdGlvbiBvZiBhcmd1bWVudHMgdG8gYmUgcHJlLWZpbGxlZC5cbiAgXy5wYXJ0aWFsID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHZhciBib3VuZEFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIHBvc2l0aW9uID0gMDtcbiAgICAgIHZhciBhcmdzID0gYm91bmRBcmdzLnNsaWNlKCk7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYXJncy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYXJnc1tpXSA9PT0gXykgYXJnc1tpXSA9IGFyZ3VtZW50c1twb3NpdGlvbisrXTtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChwb3NpdGlvbiA8IGFyZ3VtZW50cy5sZW5ndGgpIGFyZ3MucHVzaChhcmd1bWVudHNbcG9zaXRpb24rK10pO1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBCaW5kIGEgbnVtYmVyIG9mIGFuIG9iamVjdCdzIG1ldGhvZHMgdG8gdGhhdCBvYmplY3QuIFJlbWFpbmluZyBhcmd1bWVudHNcbiAgLy8gYXJlIHRoZSBtZXRob2QgbmFtZXMgdG8gYmUgYm91bmQuIFVzZWZ1bCBmb3IgZW5zdXJpbmcgdGhhdCBhbGwgY2FsbGJhY2tzXG4gIC8vIGRlZmluZWQgb24gYW4gb2JqZWN0IGJlbG9uZyB0byBpdC5cbiAgXy5iaW5kQWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGZ1bmNzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChmdW5jcy5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcignYmluZEFsbCBtdXN0IGJlIHBhc3NlZCBmdW5jdGlvbiBuYW1lcycpO1xuICAgIGVhY2goZnVuY3MsIGZ1bmN0aW9uKGYpIHsgb2JqW2ZdID0gXy5iaW5kKG9ialtmXSwgb2JqKTsgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBNZW1vaXplIGFuIGV4cGVuc2l2ZSBmdW5jdGlvbiBieSBzdG9yaW5nIGl0cyByZXN1bHRzLlxuICBfLm1lbW9pemUgPSBmdW5jdGlvbihmdW5jLCBoYXNoZXIpIHtcbiAgICB2YXIgbWVtbyA9IHt9O1xuICAgIGhhc2hlciB8fCAoaGFzaGVyID0gXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGtleSA9IGhhc2hlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIF8uaGFzKG1lbW8sIGtleSkgPyBtZW1vW2tleV0gOiAobWVtb1trZXldID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICBfLmRlbGF5ID0gZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IHJldHVybiBmdW5jLmFwcGx5KG51bGwsIGFyZ3MpOyB9LCB3YWl0KTtcbiAgfTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgXy5kZWZlciA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICByZXR1cm4gXy5kZWxheS5hcHBseShfLCBbZnVuYywgMV0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgd2hlbiBpbnZva2VkLCB3aWxsIG9ubHkgYmUgdHJpZ2dlcmVkIGF0IG1vc3Qgb25jZVxuICAvLyBkdXJpbmcgYSBnaXZlbiB3aW5kb3cgb2YgdGltZS4gTm9ybWFsbHksIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbCBydW5cbiAgLy8gYXMgbXVjaCBhcyBpdCBjYW4sIHdpdGhvdXQgZXZlciBnb2luZyBtb3JlIHRoYW4gb25jZSBwZXIgYHdhaXRgIGR1cmF0aW9uO1xuICAvLyBidXQgaWYgeW91J2QgbGlrZSB0byBkaXNhYmxlIHRoZSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSwgcGFzc1xuICAvLyBge2xlYWRpbmc6IGZhbHNlfWAuIFRvIGRpc2FibGUgZXhlY3V0aW9uIG9uIHRoZSB0cmFpbGluZyBlZGdlLCBkaXR0by5cbiAgXy50aHJvdHRsZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcbiAgICB2YXIgcHJldmlvdXMgPSAwO1xuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICBwcmV2aW91cyA9IG9wdGlvbnMubGVhZGluZyA9PT0gZmFsc2UgPyAwIDogXy5ub3coKTtcbiAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICB9O1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub3cgPSBfLm5vdygpO1xuICAgICAgaWYgKCFwcmV2aW91cyAmJiBvcHRpb25zLmxlYWRpbmcgPT09IGZhbHNlKSBwcmV2aW91cyA9IG5vdztcbiAgICAgIHZhciByZW1haW5pbmcgPSB3YWl0IC0gKG5vdyAtIHByZXZpb3VzKTtcbiAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGlmIChyZW1haW5pbmcgPD0gMCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICBwcmV2aW91cyA9IG5vdztcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgfSBlbHNlIGlmICghdGltZW91dCAmJiBvcHRpb25zLnRyYWlsaW5nICE9PSBmYWxzZSkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgcmVtYWluaW5nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIGFzIGxvbmcgYXMgaXQgY29udGludWVzIHRvIGJlIGludm9rZWQsIHdpbGwgbm90XG4gIC8vIGJlIHRyaWdnZXJlZC4gVGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIGFmdGVyIGl0IHN0b3BzIGJlaW5nIGNhbGxlZCBmb3JcbiAgLy8gTiBtaWxsaXNlY29uZHMuIElmIGBpbW1lZGlhdGVgIGlzIHBhc3NlZCwgdHJpZ2dlciB0aGUgZnVuY3Rpb24gb24gdGhlXG4gIC8vIGxlYWRpbmcgZWRnZSwgaW5zdGVhZCBvZiB0aGUgdHJhaWxpbmcuXG4gIF8uZGVib3VuY2UgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBpbW1lZGlhdGUpIHtcbiAgICB2YXIgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wLCByZXN1bHQ7XG5cbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBsYXN0ID0gXy5ub3coKSAtIHRpbWVzdGFtcDtcbiAgICAgIGlmIChsYXN0IDwgd2FpdCkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIGlmICghaW1tZWRpYXRlKSB7XG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGltZXN0YW1wID0gXy5ub3coKTtcbiAgICAgIHZhciBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgIH1cbiAgICAgIGlmIChjYWxsTm93KSB7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgIGNvbnRleHQgPSBhcmdzID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgYXQgbW9zdCBvbmUgdGltZSwgbm8gbWF0dGVyIGhvd1xuICAvLyBvZnRlbiB5b3UgY2FsbCBpdC4gVXNlZnVsIGZvciBsYXp5IGluaXRpYWxpemF0aW9uLlxuICBfLm9uY2UgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgdmFyIHJhbiA9IGZhbHNlLCBtZW1vO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyYW4pIHJldHVybiBtZW1vO1xuICAgICAgcmFuID0gdHJ1ZTtcbiAgICAgIG1lbW8gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICBmdW5jID0gbnVsbDtcbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3QgZnVuY3Rpb24gcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBzZWNvbmQsXG4gIC8vIGFsbG93aW5nIHlvdSB0byBhZGp1c3QgYXJndW1lbnRzLCBydW4gY29kZSBiZWZvcmUgYW5kIGFmdGVyLCBhbmRcbiAgLy8gY29uZGl0aW9uYWxseSBleGVjdXRlIHRoZSBvcmlnaW5hbCBmdW5jdGlvbi5cbiAgXy53cmFwID0gZnVuY3Rpb24oZnVuYywgd3JhcHBlcikge1xuICAgIHJldHVybiBfLnBhcnRpYWwod3JhcHBlciwgZnVuYyk7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIGEgbGlzdCBvZiBmdW5jdGlvbnMsIGVhY2hcbiAgLy8gY29uc3VtaW5nIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cbiAgXy5jb21wb3NlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGZ1bmNzID0gYXJndW1lbnRzO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgZm9yICh2YXIgaSA9IGZ1bmNzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGFyZ3MgPSBbZnVuY3NbaV0uYXBwbHkodGhpcywgYXJncyldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFyZ3NbMF07XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgYWZ0ZXIgYmVpbmcgY2FsbGVkIE4gdGltZXMuXG4gIF8uYWZ0ZXIgPSBmdW5jdGlvbih0aW1lcywgZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLXRpbWVzIDwgMSkge1xuICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH07XG4gIH07XG5cbiAgLy8gT2JqZWN0IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUmV0cmlldmUgdGhlIG5hbWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBPYmplY3Qua2V5c2BcbiAgXy5rZXlzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBbXTtcbiAgICBpZiAobmF0aXZlS2V5cykgcmV0dXJuIG5hdGl2ZUtleXMob2JqKTtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChfLmhhcyhvYmosIGtleSkpIGtleXMucHVzaChrZXkpO1xuICAgIHJldHVybiBrZXlzO1xuICB9O1xuXG4gIC8vIFJldHJpZXZlIHRoZSB2YWx1ZXMgb2YgYW4gb2JqZWN0J3MgcHJvcGVydGllcy5cbiAgXy52YWx1ZXMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB2YXIgdmFsdWVzID0gbmV3IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdmFsdWVzW2ldID0gb2JqW2tleXNbaV1dO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWVzO1xuICB9O1xuXG4gIC8vIENvbnZlcnQgYW4gb2JqZWN0IGludG8gYSBsaXN0IG9mIGBba2V5LCB2YWx1ZV1gIHBhaXJzLlxuICBfLnBhaXJzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHBhaXJzID0gbmV3IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcGFpcnNbaV0gPSBba2V5c1tpXSwgb2JqW2tleXNbaV1dXTtcbiAgICB9XG4gICAgcmV0dXJuIHBhaXJzO1xuICB9O1xuXG4gIC8vIEludmVydCB0aGUga2V5cyBhbmQgdmFsdWVzIG9mIGFuIG9iamVjdC4gVGhlIHZhbHVlcyBtdXN0IGJlIHNlcmlhbGl6YWJsZS5cbiAgXy5pbnZlcnQgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0W29ialtrZXlzW2ldXV0gPSBrZXlzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHNvcnRlZCBsaXN0IG9mIHRoZSBmdW5jdGlvbiBuYW1lcyBhdmFpbGFibGUgb24gdGhlIG9iamVjdC5cbiAgLy8gQWxpYXNlZCBhcyBgbWV0aG9kc2BcbiAgXy5mdW5jdGlvbnMgPSBfLm1ldGhvZHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgbmFtZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoXy5pc0Z1bmN0aW9uKG9ialtrZXldKSkgbmFtZXMucHVzaChrZXkpO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZXMuc29ydCgpO1xuICB9O1xuXG4gIC8vIEV4dGVuZCBhIGdpdmVuIG9iamVjdCB3aXRoIGFsbCB0aGUgcHJvcGVydGllcyBpbiBwYXNzZWQtaW4gb2JqZWN0KHMpLlxuICBfLmV4dGVuZCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGVhY2goc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLCBmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgIGlmIChzb3VyY2UpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCBvbmx5IGNvbnRhaW5pbmcgdGhlIHdoaXRlbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ucGljayA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBjb3B5ID0ge307XG4gICAgdmFyIGtleXMgPSBjb25jYXQuYXBwbHkoQXJyYXlQcm90bywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBlYWNoKGtleXMsIGZ1bmN0aW9uKGtleSkge1xuICAgICAgaWYgKGtleSBpbiBvYmopIGNvcHlba2V5XSA9IG9ialtrZXldO1xuICAgIH0pO1xuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgd2l0aG91dCB0aGUgYmxhY2tsaXN0ZWQgcHJvcGVydGllcy5cbiAgXy5vbWl0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGNvcHkgPSB7fTtcbiAgICB2YXIga2V5cyA9IGNvbmNhdC5hcHBseShBcnJheVByb3RvLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmICghXy5jb250YWlucyhrZXlzLCBrZXkpKSBjb3B5W2tleV0gPSBvYmpba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIGNvcHk7XG4gIH07XG5cbiAgLy8gRmlsbCBpbiBhIGdpdmVuIG9iamVjdCB3aXRoIGRlZmF1bHQgcHJvcGVydGllcy5cbiAgXy5kZWZhdWx0cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGVhY2goc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLCBmdW5jdGlvbihzb3VyY2UpIHtcbiAgICAgIGlmIChzb3VyY2UpIHtcbiAgICAgICAgZm9yICh2YXIgcHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgICAgICBpZiAob2JqW3Byb3BdID09PSB2b2lkIDApIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gQ3JlYXRlIGEgKHNoYWxsb3ctY2xvbmVkKSBkdXBsaWNhdGUgb2YgYW4gb2JqZWN0LlxuICBfLmNsb25lID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFfLmlzT2JqZWN0KG9iaikpIHJldHVybiBvYmo7XG4gICAgcmV0dXJuIF8uaXNBcnJheShvYmopID8gb2JqLnNsaWNlKCkgOiBfLmV4dGVuZCh7fSwgb2JqKTtcbiAgfTtcblxuICAvLyBJbnZva2VzIGludGVyY2VwdG9yIHdpdGggdGhlIG9iaiwgYW5kIHRoZW4gcmV0dXJucyBvYmouXG4gIC8vIFRoZSBwcmltYXJ5IHB1cnBvc2Ugb2YgdGhpcyBtZXRob2QgaXMgdG8gXCJ0YXAgaW50b1wiIGEgbWV0aG9kIGNoYWluLCBpblxuICAvLyBvcmRlciB0byBwZXJmb3JtIG9wZXJhdGlvbnMgb24gaW50ZXJtZWRpYXRlIHJlc3VsdHMgd2l0aGluIHRoZSBjaGFpbi5cbiAgXy50YXAgPSBmdW5jdGlvbihvYmosIGludGVyY2VwdG9yKSB7XG4gICAgaW50ZXJjZXB0b3Iob2JqKTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIEludGVybmFsIHJlY3Vyc2l2ZSBjb21wYXJpc29uIGZ1bmN0aW9uIGZvciBgaXNFcXVhbGAuXG4gIHZhciBlcSA9IGZ1bmN0aW9uKGEsIGIsIGFTdGFjaywgYlN0YWNrKSB7XG4gICAgLy8gSWRlbnRpY2FsIG9iamVjdHMgYXJlIGVxdWFsLiBgMCA9PT0gLTBgLCBidXQgdGhleSBhcmVuJ3QgaWRlbnRpY2FsLlxuICAgIC8vIFNlZSB0aGUgW0hhcm1vbnkgYGVnYWxgIHByb3Bvc2FsXShodHRwOi8vd2lraS5lY21hc2NyaXB0Lm9yZy9kb2t1LnBocD9pZD1oYXJtb255OmVnYWwpLlxuICAgIGlmIChhID09PSBiKSByZXR1cm4gYSAhPT0gMCB8fCAxIC8gYSA9PSAxIC8gYjtcbiAgICAvLyBBIHN0cmljdCBjb21wYXJpc29uIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIGBudWxsID09IHVuZGVmaW5lZGAuXG4gICAgaWYgKGEgPT0gbnVsbCB8fCBiID09IG51bGwpIHJldHVybiBhID09PSBiO1xuICAgIC8vIFVud3JhcCBhbnkgd3JhcHBlZCBvYmplY3RzLlxuICAgIGlmIChhIGluc3RhbmNlb2YgXykgYSA9IGEuX3dyYXBwZWQ7XG4gICAgaWYgKGIgaW5zdGFuY2VvZiBfKSBiID0gYi5fd3JhcHBlZDtcbiAgICAvLyBDb21wYXJlIGBbW0NsYXNzXV1gIG5hbWVzLlxuICAgIHZhciBjbGFzc05hbWUgPSB0b1N0cmluZy5jYWxsKGEpO1xuICAgIGlmIChjbGFzc05hbWUgIT0gdG9TdHJpbmcuY2FsbChiKSkgcmV0dXJuIGZhbHNlO1xuICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XG4gICAgICAvLyBTdHJpbmdzLCBudW1iZXJzLCBkYXRlcywgYW5kIGJvb2xlYW5zIGFyZSBjb21wYXJlZCBieSB2YWx1ZS5cbiAgICAgIGNhc2UgJ1tvYmplY3QgU3RyaW5nXSc6XG4gICAgICAgIC8vIFByaW1pdGl2ZXMgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgb2JqZWN0IHdyYXBwZXJzIGFyZSBlcXVpdmFsZW50OyB0aHVzLCBgXCI1XCJgIGlzXG4gICAgICAgIC8vIGVxdWl2YWxlbnQgdG8gYG5ldyBTdHJpbmcoXCI1XCIpYC5cbiAgICAgICAgcmV0dXJuIGEgPT0gU3RyaW5nKGIpO1xuICAgICAgY2FzZSAnW29iamVjdCBOdW1iZXJdJzpcbiAgICAgICAgLy8gYE5hTmBzIGFyZSBlcXVpdmFsZW50LCBidXQgbm9uLXJlZmxleGl2ZS4gQW4gYGVnYWxgIGNvbXBhcmlzb24gaXMgcGVyZm9ybWVkIGZvclxuICAgICAgICAvLyBvdGhlciBudW1lcmljIHZhbHVlcy5cbiAgICAgICAgcmV0dXJuIGEgIT0gK2EgPyBiICE9ICtiIDogKGEgPT0gMCA/IDEgLyBhID09IDEgLyBiIDogYSA9PSArYik7XG4gICAgICBjYXNlICdbb2JqZWN0IERhdGVdJzpcbiAgICAgIGNhc2UgJ1tvYmplY3QgQm9vbGVhbl0nOlxuICAgICAgICAvLyBDb2VyY2UgZGF0ZXMgYW5kIGJvb2xlYW5zIHRvIG51bWVyaWMgcHJpbWl0aXZlIHZhbHVlcy4gRGF0ZXMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyXG4gICAgICAgIC8vIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9ucy4gTm90ZSB0aGF0IGludmFsaWQgZGF0ZXMgd2l0aCBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnNcbiAgICAgICAgLy8gb2YgYE5hTmAgYXJlIG5vdCBlcXVpdmFsZW50LlxuICAgICAgICByZXR1cm4gK2EgPT0gK2I7XG4gICAgICAvLyBSZWdFeHBzIGFyZSBjb21wYXJlZCBieSB0aGVpciBzb3VyY2UgcGF0dGVybnMgYW5kIGZsYWdzLlxuICAgICAgY2FzZSAnW29iamVjdCBSZWdFeHBdJzpcbiAgICAgICAgcmV0dXJuIGEuc291cmNlID09IGIuc291cmNlICYmXG4gICAgICAgICAgICAgICBhLmdsb2JhbCA9PSBiLmdsb2JhbCAmJlxuICAgICAgICAgICAgICAgYS5tdWx0aWxpbmUgPT0gYi5tdWx0aWxpbmUgJiZcbiAgICAgICAgICAgICAgIGEuaWdub3JlQ2FzZSA9PSBiLmlnbm9yZUNhc2U7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYSAhPSAnb2JqZWN0JyB8fCB0eXBlb2YgYiAhPSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgIC8vIEFzc3VtZSBlcXVhbGl0eSBmb3IgY3ljbGljIHN0cnVjdHVyZXMuIFRoZSBhbGdvcml0aG0gZm9yIGRldGVjdGluZyBjeWNsaWNcbiAgICAvLyBzdHJ1Y3R1cmVzIGlzIGFkYXB0ZWQgZnJvbSBFUyA1LjEgc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYC5cbiAgICB2YXIgbGVuZ3RoID0gYVN0YWNrLmxlbmd0aDtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIC8vIExpbmVhciBzZWFyY2guIFBlcmZvcm1hbmNlIGlzIGludmVyc2VseSBwcm9wb3J0aW9uYWwgdG8gdGhlIG51bWJlciBvZlxuICAgICAgLy8gdW5pcXVlIG5lc3RlZCBzdHJ1Y3R1cmVzLlxuICAgICAgaWYgKGFTdGFja1tsZW5ndGhdID09IGEpIHJldHVybiBiU3RhY2tbbGVuZ3RoXSA9PSBiO1xuICAgIH1cbiAgICAvLyBPYmplY3RzIHdpdGggZGlmZmVyZW50IGNvbnN0cnVjdG9ycyBhcmUgbm90IGVxdWl2YWxlbnQsIGJ1dCBgT2JqZWN0YHNcbiAgICAvLyBmcm9tIGRpZmZlcmVudCBmcmFtZXMgYXJlLlxuICAgIHZhciBhQ3RvciA9IGEuY29uc3RydWN0b3IsIGJDdG9yID0gYi5jb25zdHJ1Y3RvcjtcbiAgICBpZiAoYUN0b3IgIT09IGJDdG9yICYmICEoXy5pc0Z1bmN0aW9uKGFDdG9yKSAmJiAoYUN0b3IgaW5zdGFuY2VvZiBhQ3RvcikgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5pc0Z1bmN0aW9uKGJDdG9yKSAmJiAoYkN0b3IgaW5zdGFuY2VvZiBiQ3RvcikpXG4gICAgICAgICAgICAgICAgICAgICAgICAmJiAoJ2NvbnN0cnVjdG9yJyBpbiBhICYmICdjb25zdHJ1Y3RvcicgaW4gYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gQWRkIHRoZSBmaXJzdCBvYmplY3QgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wdXNoKGEpO1xuICAgIGJTdGFjay5wdXNoKGIpO1xuICAgIHZhciBzaXplID0gMCwgcmVzdWx0ID0gdHJ1ZTtcbiAgICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICBpZiAoY2xhc3NOYW1lID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIC8vIENvbXBhcmUgYXJyYXkgbGVuZ3RocyB0byBkZXRlcm1pbmUgaWYgYSBkZWVwIGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5LlxuICAgICAgc2l6ZSA9IGEubGVuZ3RoO1xuICAgICAgcmVzdWx0ID0gc2l6ZSA9PSBiLmxlbmd0aDtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgLy8gRGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllcy5cbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGVxKGFbc2l6ZV0sIGJbc2l6ZV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSBvYmplY3RzLlxuICAgICAgZm9yICh2YXIga2V5IGluIGEpIHtcbiAgICAgICAgaWYgKF8uaGFzKGEsIGtleSkpIHtcbiAgICAgICAgICAvLyBDb3VudCB0aGUgZXhwZWN0ZWQgbnVtYmVyIG9mIHByb3BlcnRpZXMuXG4gICAgICAgICAgc2l6ZSsrO1xuICAgICAgICAgIC8vIERlZXAgY29tcGFyZSBlYWNoIG1lbWJlci5cbiAgICAgICAgICBpZiAoIShyZXN1bHQgPSBfLmhhcyhiLCBrZXkpICYmIGVxKGFba2V5XSwgYltrZXldLCBhU3RhY2ssIGJTdGFjaykpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gRW5zdXJlIHRoYXQgYm90aCBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXMuXG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIGZvciAoa2V5IGluIGIpIHtcbiAgICAgICAgICBpZiAoXy5oYXMoYiwga2V5KSAmJiAhKHNpemUtLSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9ICFzaXplO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZW1vdmUgdGhlIGZpcnN0IG9iamVjdCBmcm9tIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucG9wKCk7XG4gICAgYlN0YWNrLnBvcCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUGVyZm9ybSBhIGRlZXAgY29tcGFyaXNvbiB0byBjaGVjayBpZiB0d28gb2JqZWN0cyBhcmUgZXF1YWwuXG4gIF8uaXNFcXVhbCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gZXEoYSwgYiwgW10sIFtdKTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIGFycmF5LCBzdHJpbmcsIG9yIG9iamVjdCBlbXB0eT9cbiAgLy8gQW4gXCJlbXB0eVwiIG9iamVjdCBoYXMgbm8gZW51bWVyYWJsZSBvd24tcHJvcGVydGllcy5cbiAgXy5pc0VtcHR5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoXy5pc0FycmF5KG9iaikgfHwgXy5pc1N0cmluZyhvYmopKSByZXR1cm4gb2JqLmxlbmd0aCA9PT0gMDtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIERPTSBlbGVtZW50P1xuICBfLmlzRWxlbWVudCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiAhIShvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxKTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGFuIGFycmF5P1xuICAvLyBEZWxlZ2F0ZXMgdG8gRUNNQTUncyBuYXRpdmUgQXJyYXkuaXNBcnJheVxuICBfLmlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIGFuIG9iamVjdD9cbiAgXy5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xuICB9O1xuXG4gIC8vIEFkZCBzb21lIGlzVHlwZSBtZXRob2RzOiBpc0FyZ3VtZW50cywgaXNGdW5jdGlvbiwgaXNTdHJpbmcsIGlzTnVtYmVyLCBpc0RhdGUsIGlzUmVnRXhwLlxuICBlYWNoKFsnQXJndW1lbnRzJywgJ0Z1bmN0aW9uJywgJ1N0cmluZycsICdOdW1iZXInLCAnRGF0ZScsICdSZWdFeHAnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIF9bJ2lzJyArIG5hbWVdID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0ICcgKyBuYW1lICsgJ10nO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIERlZmluZSBhIGZhbGxiYWNrIHZlcnNpb24gb2YgdGhlIG1ldGhvZCBpbiBicm93c2VycyAoYWhlbSwgSUUpLCB3aGVyZVxuICAvLyB0aGVyZSBpc24ndCBhbnkgaW5zcGVjdGFibGUgXCJBcmd1bWVudHNcIiB0eXBlLlxuICBpZiAoIV8uaXNBcmd1bWVudHMoYXJndW1lbnRzKSkge1xuICAgIF8uaXNBcmd1bWVudHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiAhIShvYmogJiYgXy5oYXMob2JqLCAnY2FsbGVlJykpO1xuICAgIH07XG4gIH1cblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuXG4gIGlmICh0eXBlb2YgKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG4gIH1cblxuICAvLyBJcyBhIGdpdmVuIG9iamVjdCBhIGZpbml0ZSBudW1iZXI/XG4gIF8uaXNGaW5pdGUgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gaXNGaW5pdGUob2JqKSAmJiAhaXNOYU4ocGFyc2VGbG9hdChvYmopKTtcbiAgfTtcblxuICAvLyBJcyB0aGUgZ2l2ZW4gdmFsdWUgYE5hTmA/IChOYU4gaXMgdGhlIG9ubHkgbnVtYmVyIHdoaWNoIGRvZXMgbm90IGVxdWFsIGl0c2VsZikuXG4gIF8uaXNOYU4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gXy5pc051bWJlcihvYmopICYmIG9iaiAhPSArb2JqO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBib29sZWFuP1xuICBfLmlzQm9vbGVhbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHRydWUgfHwgb2JqID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQm9vbGVhbl0nO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgZXF1YWwgdG8gbnVsbD9cbiAgXy5pc051bGwgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgdW5kZWZpbmVkP1xuICBfLmlzVW5kZWZpbmVkID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdm9pZCAwO1xuICB9O1xuXG4gIC8vIFNob3J0Y3V0IGZ1bmN0aW9uIGZvciBjaGVja2luZyBpZiBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gcHJvcGVydHkgZGlyZWN0bHlcbiAgLy8gb24gaXRzZWxmIChpbiBvdGhlciB3b3Jkcywgbm90IG9uIGEgcHJvdG90eXBlKS5cbiAgXy5oYXMgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbiAgfTtcblxuICAvLyBVdGlsaXR5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJ1biBVbmRlcnNjb3JlLmpzIGluICpub0NvbmZsaWN0KiBtb2RlLCByZXR1cm5pbmcgdGhlIGBfYCB2YXJpYWJsZSB0byBpdHNcbiAgLy8gcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICByb290Ll8gPSBwcmV2aW91c1VuZGVyc2NvcmU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLy8gS2VlcCB0aGUgaWRlbnRpdHkgZnVuY3Rpb24gYXJvdW5kIGZvciBkZWZhdWx0IGl0ZXJhdG9ycy5cbiAgXy5pZGVudGl0eSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIF8uY29uc3RhbnQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfTtcbiAgfTtcblxuICBfLnByb3BlcnR5ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIG9ialtrZXldO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIHByZWRpY2F0ZSBmb3IgY2hlY2tpbmcgd2hldGhlciBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gc2V0IG9mIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLm1hdGNoZXMgPSBmdW5jdGlvbihhdHRycykge1xuICAgIHJldHVybiBmdW5jdGlvbihvYmopIHtcbiAgICAgIGlmIChvYmogPT09IGF0dHJzKSByZXR1cm4gdHJ1ZTsgLy9hdm9pZCBjb21wYXJpbmcgYW4gb2JqZWN0IHRvIGl0c2VsZi5cbiAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xuICAgICAgICBpZiAoYXR0cnNba2V5XSAhPT0gb2JqW2tleV0pXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJ1biBhIGZ1bmN0aW9uICoqbioqIHRpbWVzLlxuICBfLnRpbWVzID0gZnVuY3Rpb24obiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgYWNjdW0gPSBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBpKTtcbiAgICByZXR1cm4gYWNjdW07XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgcmFuZG9tIGludGVnZXIgYmV0d2VlbiBtaW4gYW5kIG1heCAoaW5jbHVzaXZlKS5cbiAgXy5yYW5kb20gPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgIGlmIChtYXggPT0gbnVsbCkge1xuICAgICAgbWF4ID0gbWluO1xuICAgICAgbWluID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIG1pbiArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSk7XG4gIH07XG5cbiAgLy8gQSAocG9zc2libHkgZmFzdGVyKSB3YXkgdG8gZ2V0IHRoZSBjdXJyZW50IHRpbWVzdGFtcCBhcyBhbiBpbnRlZ2VyLlxuICBfLm5vdyA9IERhdGUubm93IHx8IGZ1bmN0aW9uKCkgeyByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCk7IH07XG5cbiAgLy8gTGlzdCBvZiBIVE1MIGVudGl0aWVzIGZvciBlc2NhcGluZy5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICBlc2NhcGU6IHtcbiAgICAgICcmJzogJyZhbXA7JyxcbiAgICAgICc8JzogJyZsdDsnLFxuICAgICAgJz4nOiAnJmd0OycsXG4gICAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICAgIFwiJ1wiOiAnJiN4Mjc7J1xuICAgIH1cbiAgfTtcbiAgZW50aXR5TWFwLnVuZXNjYXBlID0gXy5pbnZlcnQoZW50aXR5TWFwLmVzY2FwZSk7XG5cbiAgLy8gUmVnZXhlcyBjb250YWluaW5nIHRoZSBrZXlzIGFuZCB2YWx1ZXMgbGlzdGVkIGltbWVkaWF0ZWx5IGFib3ZlLlxuICB2YXIgZW50aXR5UmVnZXhlcyA9IHtcbiAgICBlc2NhcGU6ICAgbmV3IFJlZ0V4cCgnWycgKyBfLmtleXMoZW50aXR5TWFwLmVzY2FwZSkuam9pbignJykgKyAnXScsICdnJyksXG4gICAgdW5lc2NhcGU6IG5ldyBSZWdFeHAoJygnICsgXy5rZXlzKGVudGl0eU1hcC51bmVzY2FwZSkuam9pbignfCcpICsgJyknLCAnZycpXG4gIH07XG5cbiAgLy8gRnVuY3Rpb25zIGZvciBlc2NhcGluZyBhbmQgdW5lc2NhcGluZyBzdHJpbmdzIHRvL2Zyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICBfLmVhY2goWydlc2NhcGUnLCAndW5lc2NhcGUnXSwgZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgX1ttZXRob2RdID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICBpZiAoc3RyaW5nID09IG51bGwpIHJldHVybiAnJztcbiAgICAgIHJldHVybiAoJycgKyBzdHJpbmcpLnJlcGxhY2UoZW50aXR5UmVnZXhlc1ttZXRob2RdLCBmdW5jdGlvbihtYXRjaCkge1xuICAgICAgICByZXR1cm4gZW50aXR5TWFwW21ldGhvZF1bbWF0Y2hdO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gSWYgdGhlIHZhbHVlIG9mIHRoZSBuYW1lZCBgcHJvcGVydHlgIGlzIGEgZnVuY3Rpb24gdGhlbiBpbnZva2UgaXQgd2l0aCB0aGVcbiAgLy8gYG9iamVjdGAgYXMgY29udGV4dDsgb3RoZXJ3aXNlLCByZXR1cm4gaXQuXG4gIF8ucmVzdWx0ID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgIGlmIChvYmplY3QgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICB2YXIgdmFsdWUgPSBvYmplY3RbcHJvcGVydHldO1xuICAgIHJldHVybiBfLmlzRnVuY3Rpb24odmFsdWUpID8gdmFsdWUuY2FsbChvYmplY3QpIDogdmFsdWU7XG4gIH07XG5cbiAgLy8gQWRkIHlvdXIgb3duIGN1c3RvbSBmdW5jdGlvbnMgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm1peGluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgZWFjaChfLmZ1bmN0aW9ucyhvYmopLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgZnVuYyA9IF9bbmFtZV0gPSBvYmpbbmFtZV07XG4gICAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncyA9IFt0aGlzLl93cmFwcGVkXTtcbiAgICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gcmVzdWx0LmNhbGwodGhpcywgZnVuYy5hcHBseShfLCBhcmdzKSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEdlbmVyYXRlIGEgdW5pcXVlIGludGVnZXIgaWQgKHVuaXF1ZSB3aXRoaW4gdGhlIGVudGlyZSBjbGllbnQgc2Vzc2lvbikuXG4gIC8vIFVzZWZ1bCBmb3IgdGVtcG9yYXJ5IERPTSBpZHMuXG4gIHZhciBpZENvdW50ZXIgPSAwO1xuICBfLnVuaXF1ZUlkID0gZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgdmFyIGlkID0gKytpZENvdW50ZXIgKyAnJztcbiAgICByZXR1cm4gcHJlZml4ID8gcHJlZml4ICsgaWQgOiBpZDtcbiAgfTtcblxuICAvLyBCeSBkZWZhdWx0LCBVbmRlcnNjb3JlIHVzZXMgRVJCLXN0eWxlIHRlbXBsYXRlIGRlbGltaXRlcnMsIGNoYW5nZSB0aGVcbiAgLy8gZm9sbG93aW5nIHRlbXBsYXRlIHNldHRpbmdzIHRvIHVzZSBhbHRlcm5hdGl2ZSBkZWxpbWl0ZXJzLlxuICBfLnRlbXBsYXRlU2V0dGluZ3MgPSB7XG4gICAgZXZhbHVhdGUgICAgOiAvPCUoW1xcc1xcU10rPyklPi9nLFxuICAgIGludGVycG9sYXRlIDogLzwlPShbXFxzXFxTXSs/KSU+L2csXG4gICAgZXNjYXBlICAgICAgOiAvPCUtKFtcXHNcXFNdKz8pJT4vZ1xuICB9O1xuXG4gIC8vIFdoZW4gY3VzdG9taXppbmcgYHRlbXBsYXRlU2V0dGluZ3NgLCBpZiB5b3UgZG9uJ3Qgd2FudCB0byBkZWZpbmUgYW5cbiAgLy8gaW50ZXJwb2xhdGlvbiwgZXZhbHVhdGlvbiBvciBlc2NhcGluZyByZWdleCwgd2UgbmVlZCBvbmUgdGhhdCBpc1xuICAvLyBndWFyYW50ZWVkIG5vdCB0byBtYXRjaC5cbiAgdmFyIG5vTWF0Y2ggPSAvKC4pXi87XG5cbiAgLy8gQ2VydGFpbiBjaGFyYWN0ZXJzIG5lZWQgdG8gYmUgZXNjYXBlZCBzbyB0aGF0IHRoZXkgY2FuIGJlIHB1dCBpbnRvIGFcbiAgLy8gc3RyaW5nIGxpdGVyYWwuXG4gIHZhciBlc2NhcGVzID0ge1xuICAgIFwiJ1wiOiAgICAgIFwiJ1wiLFxuICAgICdcXFxcJzogICAgICdcXFxcJyxcbiAgICAnXFxyJzogICAgICdyJyxcbiAgICAnXFxuJzogICAgICduJyxcbiAgICAnXFx0JzogICAgICd0JyxcbiAgICAnXFx1MjAyOCc6ICd1MjAyOCcsXG4gICAgJ1xcdTIwMjknOiAndTIwMjknXG4gIH07XG5cbiAgdmFyIGVzY2FwZXIgPSAvXFxcXHwnfFxccnxcXG58XFx0fFxcdTIwMjh8XFx1MjAyOS9nO1xuXG4gIC8vIEphdmFTY3JpcHQgbWljcm8tdGVtcGxhdGluZywgc2ltaWxhciB0byBKb2huIFJlc2lnJ3MgaW1wbGVtZW50YXRpb24uXG4gIC8vIFVuZGVyc2NvcmUgdGVtcGxhdGluZyBoYW5kbGVzIGFyYml0cmFyeSBkZWxpbWl0ZXJzLCBwcmVzZXJ2ZXMgd2hpdGVzcGFjZSxcbiAgLy8gYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXG4gIF8udGVtcGxhdGUgPSBmdW5jdGlvbih0ZXh0LCBkYXRhLCBzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXI7XG4gICAgc2V0dGluZ3MgPSBfLmRlZmF1bHRzKHt9LCBzZXR0aW5ncywgXy50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gbmV3IFJlZ0V4cChbXG4gICAgICAoc2V0dGluZ3MuZXNjYXBlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5pbnRlcnBvbGF0ZSB8fCBub01hdGNoKS5zb3VyY2UsXG4gICAgICAoc2V0dGluZ3MuZXZhbHVhdGUgfHwgbm9NYXRjaCkuc291cmNlXG4gICAgXS5qb2luKCd8JykgKyAnfCQnLCAnZycpO1xuXG4gICAgLy8gQ29tcGlsZSB0aGUgdGVtcGxhdGUgc291cmNlLCBlc2NhcGluZyBzdHJpbmcgbGl0ZXJhbHMgYXBwcm9wcmlhdGVseS5cbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHZhciBzb3VyY2UgPSBcIl9fcCs9J1wiO1xuICAgIHRleHQucmVwbGFjZShtYXRjaGVyLCBmdW5jdGlvbihtYXRjaCwgZXNjYXBlLCBpbnRlcnBvbGF0ZSwgZXZhbHVhdGUsIG9mZnNldCkge1xuICAgICAgc291cmNlICs9IHRleHQuc2xpY2UoaW5kZXgsIG9mZnNldClcbiAgICAgICAgLnJlcGxhY2UoZXNjYXBlciwgZnVuY3Rpb24obWF0Y2gpIHsgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdOyB9KTtcblxuICAgICAgaWYgKGVzY2FwZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGVzY2FwZSArIFwiKSk9PW51bGw/Jyc6Xy5lc2NhcGUoX190KSkrXFxuJ1wiO1xuICAgICAgfVxuICAgICAgaWYgKGludGVycG9sYXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIicrXFxuKChfX3Q9KFwiICsgaW50ZXJwb2xhdGUgKyBcIikpPT1udWxsPycnOl9fdCkrXFxuJ1wiO1xuICAgICAgfVxuICAgICAgaWYgKGV2YWx1YXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIic7XFxuXCIgKyBldmFsdWF0ZSArIFwiXFxuX19wKz0nXCI7XG4gICAgICB9XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcbiAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xuXG4gICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICBpZiAoIXNldHRpbmdzLnZhcmlhYmxlKSBzb3VyY2UgPSAnd2l0aChvYmp8fHt9KXtcXG4nICsgc291cmNlICsgJ31cXG4nO1xuXG4gICAgc291cmNlID0gXCJ2YXIgX190LF9fcD0nJyxfX2o9QXJyYXkucHJvdG90eXBlLmpvaW4sXCIgK1xuICAgICAgXCJwcmludD1mdW5jdGlvbigpe19fcCs9X19qLmNhbGwoYXJndW1lbnRzLCcnKTt9O1xcblwiICtcbiAgICAgIHNvdXJjZSArIFwicmV0dXJuIF9fcDtcXG5cIjtcblxuICAgIHRyeSB7XG4gICAgICByZW5kZXIgPSBuZXcgRnVuY3Rpb24oc2V0dGluZ3MudmFyaWFibGUgfHwgJ29iaicsICdfJywgc291cmNlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlLnNvdXJjZSA9IHNvdXJjZTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEpIHJldHVybiByZW5kZXIoZGF0YSwgXyk7XG4gICAgdmFyIHRlbXBsYXRlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIHJlbmRlci5jYWxsKHRoaXMsIGRhdGEsIF8pO1xuICAgIH07XG5cbiAgICAvLyBQcm92aWRlIHRoZSBjb21waWxlZCBmdW5jdGlvbiBzb3VyY2UgYXMgYSBjb252ZW5pZW5jZSBmb3IgcHJlY29tcGlsYXRpb24uXG4gICAgdGVtcGxhdGUuc291cmNlID0gJ2Z1bmN0aW9uKCcgKyAoc2V0dGluZ3MudmFyaWFibGUgfHwgJ29iaicpICsgJyl7XFxuJyArIHNvdXJjZSArICd9JztcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfTtcblxuICAvLyBBZGQgYSBcImNoYWluXCIgZnVuY3Rpb24sIHdoaWNoIHdpbGwgZGVsZWdhdGUgdG8gdGhlIHdyYXBwZXIuXG4gIF8uY2hhaW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gXyhvYmopLmNoYWluKCk7XG4gIH07XG5cbiAgLy8gT09QXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuICAvLyBJZiBVbmRlcnNjb3JlIGlzIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLCBpdCByZXR1cm5zIGEgd3JhcHBlZCBvYmplY3QgdGhhdFxuICAvLyBjYW4gYmUgdXNlZCBPTy1zdHlsZS4gVGhpcyB3cmFwcGVyIGhvbGRzIGFsdGVyZWQgdmVyc2lvbnMgb2YgYWxsIHRoZVxuICAvLyB1bmRlcnNjb3JlIGZ1bmN0aW9ucy4gV3JhcHBlZCBvYmplY3RzIG1heSBiZSBjaGFpbmVkLlxuXG4gIC8vIEhlbHBlciBmdW5jdGlvbiB0byBjb250aW51ZSBjaGFpbmluZyBpbnRlcm1lZGlhdGUgcmVzdWx0cy5cbiAgdmFyIHJlc3VsdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0aGlzLl9jaGFpbiA/IF8ob2JqKS5jaGFpbigpIDogb2JqO1xuICB9O1xuXG4gIC8vIEFkZCBhbGwgb2YgdGhlIFVuZGVyc2NvcmUgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyIG9iamVjdC5cbiAgXy5taXhpbihfKTtcblxuICAvLyBBZGQgYWxsIG11dGF0b3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9iaiA9IHRoaXMuX3dyYXBwZWQ7XG4gICAgICBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKChuYW1lID09ICdzaGlmdCcgfHwgbmFtZSA9PSAnc3BsaWNlJykgJiYgb2JqLmxlbmd0aCA9PT0gMCkgZGVsZXRlIG9ialswXTtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBvYmopO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFkZCBhbGwgYWNjZXNzb3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsnY29uY2F0JywgJ2pvaW4nLCAnc2xpY2UnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcmVzdWx0LmNhbGwodGhpcywgbWV0aG9kLmFwcGx5KHRoaXMuX3dyYXBwZWQsIGFyZ3VtZW50cykpO1xuICAgIH07XG4gIH0pO1xuXG4gIF8uZXh0ZW5kKF8ucHJvdG90eXBlLCB7XG5cbiAgICAvLyBTdGFydCBjaGFpbmluZyBhIHdyYXBwZWQgVW5kZXJzY29yZSBvYmplY3QuXG4gICAgY2hhaW46IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fY2hhaW4gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8vIEV4dHJhY3RzIHRoZSByZXN1bHQgZnJvbSBhIHdyYXBwZWQgYW5kIGNoYWluZWQgb2JqZWN0LlxuICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLl93cmFwcGVkO1xuICAgIH1cblxuICB9KTtcblxuICAvLyBBTUQgcmVnaXN0cmF0aW9uIGhhcHBlbnMgYXQgdGhlIGVuZCBmb3IgY29tcGF0aWJpbGl0eSB3aXRoIEFNRCBsb2FkZXJzXG4gIC8vIHRoYXQgbWF5IG5vdCBlbmZvcmNlIG5leHQtdHVybiBzZW1hbnRpY3Mgb24gbW9kdWxlcy4gRXZlbiB0aG91Z2ggZ2VuZXJhbFxuICAvLyBwcmFjdGljZSBmb3IgQU1EIHJlZ2lzdHJhdGlvbiBpcyB0byBiZSBhbm9ueW1vdXMsIHVuZGVyc2NvcmUgcmVnaXN0ZXJzXG4gIC8vIGFzIGEgbmFtZWQgbW9kdWxlIGJlY2F1c2UsIGxpa2UgalF1ZXJ5LCBpdCBpcyBhIGJhc2UgbGlicmFyeSB0aGF0IGlzXG4gIC8vIHBvcHVsYXIgZW5vdWdoIHRvIGJlIGJ1bmRsZWQgaW4gYSB0aGlyZCBwYXJ0eSBsaWIsIGJ1dCBub3QgYmUgcGFydCBvZlxuICAvLyBhbiBBTUQgbG9hZCByZXF1ZXN0LiBUaG9zZSBjYXNlcyBjb3VsZCBnZW5lcmF0ZSBhbiBlcnJvciB3aGVuIGFuXG4gIC8vIGFub255bW91cyBkZWZpbmUoKSBpcyBjYWxsZWQgb3V0c2lkZSBvZiBhIGxvYWRlciByZXF1ZXN0LlxuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKCd1bmRlcnNjb3JlJywgW10sIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIF87XG4gICAgfSk7XG4gIH1cbn0pLmNhbGwodGhpcyk7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4oZnVuY3Rpb24ocm9vdCkge1xuICAgIHZhciB1bm9waW5pb25hdGUgPSB7XG4gICAgICAgIHNlbGVjdG9yOiByb290LmpRdWVyeSB8fCByb290LlplcHRvIHx8IHJvb3QuZW5kZXIgfHwgcm9vdC4kLFxuICAgICAgICB0ZW1wbGF0ZTogcm9vdC5IYW5kbGViYXJzIHx8IHJvb3QuTXVzdGFjaGVcbiAgICB9O1xuXG4gICAgLyoqKiBFeHBvcnQgKioqL1xuXG4gICAgLy9BTURcbiAgICBpZih0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKFtdLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiB1bm9waW5pb25hdGU7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICAvL0NvbW1vbkpTXG4gICAgZWxzZSBpZih0eXBlb2YgbW9kdWxlLmV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gdW5vcGluaW9uYXRlO1xuICAgIH1cbiAgICAvL0dsb2JhbFxuICAgIGVsc2Uge1xuICAgICAgICByb290LnVub3BpbmlvbmF0ZSA9IHVub3BpbmlvbmF0ZTtcbiAgICB9XG59KSh0eXBlb2Ygd2luZG93ICE9ICd1bmRlZmluZWQnID8gd2luZG93IDogZ2xvYmFsKTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJ2YXIgdGVtcGxhdGVyID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKS5kZWZhdWx0LnRlbXBsYXRlO21vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVyKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiO1xuXG5cbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLlRvb2xiYXIpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCJcXG5cIjtcbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmNvZGUpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCJcXG5cIjtcbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLlRyYXkpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICByZXR1cm4gYnVmZmVyO1xuICB9KTsiLCJ2YXIgc3VidmlldyAgICAgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgY29kZSAgICAgICAgPSByZXF1aXJlKCcuL2NvZGUnKSxcbiAgICB0b29sYmFyICAgICA9IHJlcXVpcmUoJy4vdG9vbGJhcicpLFxuICAgIHByb2dyYW1zICAgID0gcmVxdWlyZSgnLi4vLi4vbW9kZWxzL3Byb2dyYW1zJyksXG4gICAgdHJhbnNpdGlvbkNvbXBsZXRlID0gcmVxdWlyZSgndHJhbnNpdGlvbi1jb21wbGV0ZScpO1xuXG5yZXF1aXJlKCcuL0VkaXRvci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnRWRpdG9yJywge1xuICAgIGxpc3RlbmVyczoge1xuICAgICAgICAnYWxsOm9wZW4sIGFsbDpzYXZlJzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uQ29tcGxldGUoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgcHJvZ3JhbXMuc2V0KHRvb2xiYXIuZ2V0TmFtZSgpLCBjb2RlLmR1bXAoKSk7XG5cbiAgICAgICAgICAgICAgICB0b29sYmFyLnNldE5hbWUoJycpO1xuICAgICAgICAgICAgICAgIGNvZGUuZW1wdHkoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAnYWxsOm9wZW5GaWxlJzogZnVuY3Rpb24oZmlsZU5hbWUpIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25Db21wbGV0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB0b29sYmFyLnNldE5hbWUoZmlsZU5hbWUpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHByb2dyYW1zLmdldChmaWxlTmFtZSwgZnVuY3Rpb24oZmlsZSkge1xuICAgICAgICAgICAgICAgICAgICBjb2RlLmxvYWQoZmlsZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgJ2FsbDpuZXcnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGNvZGUuZW1wdHkoKTtcblxuICAgICAgICAgICAgdHJhbnNpdGlvbkNvbXBsZXRlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRvb2xiYXIuZm9jdXNOYW1lKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoJy4vRWRpdG9yLmhhbmRsZWJhcnMnKSxcbiAgICBzdWJ2aWV3czoge1xuICAgICAgICBUb29sYmFyOiAgICB0b29sYmFyLFxuICAgICAgICBjb2RlOiAgICAgICBjb2RlLFxuICAgICAgICBUcmF5OiAgICAgICByZXF1aXJlKCcuL1RyYXkvVHJheScpXG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuc3Vidmlldy1Ub29sYmFye3Bvc2l0aW9uOmFic29sdXRlO2hlaWdodDo1MHB4O3dpZHRoOjEwMCV9LnN1YnZpZXctQ29kZXtwb3NpdGlvbjphYnNvbHV0ZTtib3R0b206MTUwcHg7dG9wOjUwcHg7d2lkdGg6MTAwJX0uc3Vidmlldy1UcmF5e3Bvc2l0aW9uOmFic29sdXRlO2hlaWdodDoxNTBweDtib3R0b206MDt3aWR0aDoxMDAlfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgXG5cblxuICByZXR1cm4gXCI8YnV0dG9uIGNsYXNzPSdFZGl0b3ItVG9vbGJhci1vcGVuJz5PcGVuPC9idXR0b24+XFxuXFxuPGlucHV0IHR5cGU9J3RleHQnIGNsYXNzPSdFZGl0b3ItVG9vbGJhci1uYW1lJyBwbGFjZWhvbGRlcj0nVW50aXRsZWQnIC8+XFxuXFxuPGJ1dHRvbiBjbGFzcz0nRWRpdG9yLVRvb2xiYXItcnVuJz5SdW48L2J1dHRvbj5cIjtcbiAgfSk7IiwidmFyIFRvb2xiYXIgID0gcmVxdWlyZSgnLi4vLi4vVUkvVG9vbGJhci9Ub29sYmFyJyksXG4gICAgY2xpY2sgICAgPSByZXF1aXJlKCdvbmNsaWNrJyksXG4gICAgY29kZSAgICAgPSByZXF1aXJlKCcuLi9jb2RlJyksXG4gICAgdGVybWluYWwgPSByZXF1aXJlKCcuLi8uLi9SdW4vdGVybWluYWwnKTtcblxucmVxdWlyZSgnLi9Ub29sYmFyLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBUb29sYmFyLmV4dGVuZCgnRWRpdG9yLVRvb2xiYXInLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBjbGljayh7XG4gICAgICAgICAgICAnLkVkaXRvci1Ub29sYmFyLXJ1bic6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRlcm1pbmFsLmNsZWFyKCk7XG5cbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLnRyaWdnZXIoJ3J1bicsIFtmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZGUucnVuKCk7XG4gICAgICAgICAgICAgICAgICAgIH1dKTtcbiAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnLkVkaXRvci1Ub29sYmFyLW9wZW4nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnRyaWdnZXIoJ29wZW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICB0aGlzLiRuYW1lID0gdGhpcy4kd3JhcHBlci5maW5kKCcuRWRpdG9yLVRvb2xiYXItbmFtZScpO1xuICAgIH0sXG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoJy4vVG9vbGJhci5oYW5kbGViYXJzJyksXG4gICAgZ2V0TmFtZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRuYW1lLnZhbCgpO1xuICAgIH0sXG4gICAgc2V0TmFtZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB0aGlzLiRuYW1lLnZhbChuYW1lIHx8ICcnKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBmb2N1c05hbWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRuYW1lXG4gICAgICAgICAgICAudmFsKCcnKVxuICAgICAgICAgICAgLmZvY3VzKCk7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuRWRpdG9yLVRvb2xiYXItcnVue2Zsb2F0OnJpZ2h0fS5FZGl0b3ItVG9vbGJhci1vcGVue2Zsb2F0OmxlZnR9LkVkaXRvci1Ub29sYmFyLW5hbWV7cG9zaXRpb246YWJzb2x1dGU7bGVmdDo1MCU7Ym90dG9tOjA7bWFyZ2luLWxlZnQ6LTEwMHB4O3dpZHRoOjIwMHB4Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveDtiYWNrZ3JvdW5kOjAgMDtib3JkZXI6MDt0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6aW5oZXJpdDtmb250LWZhbWlseTppbmhlcml0O2NvbG9yOmluaGVyaXR9LkVkaXRvci1Ub29sYmFyLW5hbWU6Zm9jdXN7b3V0bGluZTowfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIHN0YWNrMSwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIiwgZXNjYXBlRXhwcmVzc2lvbj10aGlzLmVzY2FwZUV4cHJlc3Npb24sIHNlbGY9dGhpcztcblxuZnVuY3Rpb24gcHJvZ3JhbTEoZGVwdGgwLGRhdGEpIHtcbiAgXG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGhlbHBlcjtcbiAgYnVmZmVyICs9IFwiXFxuICAgIDxkaXYgY2xhc3M9J1RyYXktQnV0dG9uJyBkYXRhLXR5cGU9J1wiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy50eXBlKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLnR5cGUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiJz5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMubmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5uYW1lKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBpZihzdGFjazEgfHwgc3RhY2sxID09PSAwKSB7IGJ1ZmZlciArPSBzdGFjazE7IH1cbiAgYnVmZmVyICs9IFwiPC9kaXY+XFxuXCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH1cblxuICBzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsIChkZXB0aDAgJiYgZGVwdGgwLmJ1dHRvbnMpLCB7aGFzaDp7fSxpbnZlcnNlOnNlbGYubm9vcCxmbjpzZWxmLnByb2dyYW0oMSwgcHJvZ3JhbTEsIGRhdGEpLGRhdGE6ZGF0YX0pO1xuICBpZihzdGFjazEgfHwgc3RhY2sxID09PSAwKSB7IHJldHVybiBzdGFjazE7IH1cbiAgZWxzZSB7IHJldHVybiAnJzsgfVxuICB9KTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBidXR0b25zID0gcmVxdWlyZSgnLi4vLi4vVUkvQ29kZS9Ub2tlbnMvaW5kZXgnKSxcbiAgICBkcmFnICAgID0gcmVxdWlyZSgnb25kcmFnJyksXG4gICAgY2xpY2sgICA9IHJlcXVpcmUoJ29uY2xpY2snKSxcbiAgICBjdXJzb3IgID0gcmVxdWlyZSgnLi4vLi4vVUkvQ29kZS9jdXJzb3InKTtcblxucmVxdWlyZSgnLi9UcmF5Lmxlc3MnKTtcblxuLyoqKiBTZXR1cCBEcmFnZ2luZyAqKiovXG5cbmRyYWcoJy5UcmF5LUJ1dHRvbicsIHtcbiAgICBoZWxwZXI6IFwiY2xvbmVcIixcbiAgICBzdGFydDogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgbW92ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgc3RvcDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB0eXBlID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScpO1xuICAgIH1cbn0pO1xuXG5jbGljaygnLlRyYXktQnV0dG9uJywgZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICB2YXIgdHlwZSA9IHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXR5cGUnKTtcbiAgICBjdXJzb3IucGFzdGUodHlwZSk7XG59KTtcblxuLyoqKiBEZWZpbmUgdGhlIFN1YnZpZXcgKioqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ1RyYXknLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoXCIuL1RyYXkuaGFuZGxlYmFyc1wiKSxcbiAgICBkYXRhOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBbXTtcblxuICAgICAgICB2YXIgaSA9IGJ1dHRvbnMubGVuZ3RoO1xuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIHZhciBCdXR0b24gPSBidXR0b25zW2ldO1xuXG4gICAgICAgICAgICBkYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IEJ1dHRvbi5TdWJ2aWV3LnByb3RvdHlwZS5tZXRhLmRpc3BsYXkgfHwgQnV0dG9uLlN1YnZpZXcucHJvdG90eXBlLnRlbXBsYXRlLFxuICAgICAgICAgICAgICAgIHR5cGU6IEJ1dHRvbi50eXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBidXR0b25zOiBkYXRhXG4gICAgICAgIH07XG4gICAgfVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctVHJheXtiYWNrZ3JvdW5kOiNGMUYwRjA7cGFkZGluZzo1cHg7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94fS5UcmF5LUJ1dHRvbntkaXNwbGF5OmlubGluZS1ibG9jaztwYWRkaW5nOjJweCA1cHg7bWFyZ2luOjJweCAwOy13ZWJraXQtYm9yZGVyLXJhZGl1czozcHg7LW1vei1ib3JkZXItcmFkaXVzOjNweDtib3JkZXItcmFkaXVzOjNweDtiYWNrZ3JvdW5kOiMxMDc1RjY7Y29sb3I6I2ZmZjtjdXJzb3I6cG9pbnRlcn1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBjb2RlID0gcmVxdWlyZSgnLi4vVUkvQ29kZS9Db2RlJykuc3Bhd24oKTtcblxuY29kZS5jb25maWd1cmUoe1xuICAgIHRlcm1pbmFsOiByZXF1aXJlKCcuLi9SdW4vdGVybWluYWwnKSxcbiAgICBvbkVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdlZGl0Jyk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gY29kZTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Ub29sYmFyL1Rvb2xiYXInKS5zcGF3bigpOyIsInZhciB0ZW1wbGF0ZXIgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpLmRlZmF1bHQudGVtcGxhdGU7bW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZXIoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uLCBzZWxmPXRoaXM7XG5cbmZ1bmN0aW9uIHByb2dyYW0xKGRlcHRoMCxkYXRhKSB7XG4gIFxuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXI7XG4gIGJ1ZmZlciArPSBcIlxcbiAgICAgICAgPGxpIGNsYXNzPSdGaWxlU3lzdGVtLWZpbGUnIGRhdGEtbmFtZT0nXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLm5hbWUpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAubmFtZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCInPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5uYW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLm5hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9saT5cXG4gICAgXCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH1cblxuICBidWZmZXIgKz0gXCI8dWwgY2xhc3M9J0ZpbGVTeXN0ZW0tbGlzdCc+XFxuICAgIFwiO1xuICBzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsIChkZXB0aDAgJiYgZGVwdGgwLnByb2dyYW1zKSwge2hhc2g6e30saW52ZXJzZTpzZWxmLm5vb3AsZm46c2VsZi5wcm9ncmFtKDEsIHByb2dyYW0xLCBkYXRhKSxkYXRhOmRhdGF9KTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyBidWZmZXIgKz0gc3RhY2sxOyB9XG4gIGJ1ZmZlciArPSBcIlxcbjwvdWw+XCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH0pOyIsInZhciBzdWJ2aWV3ICA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBjbGljayAgICA9IHJlcXVpcmUoJ29uY2xpY2snKSxcbiAgICBfICAgICAgICA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSxcbiAgICBwcm9ncmFtcyA9IHJlcXVpcmUoXCIuLi8uLi8uLi9tb2RlbHMvcHJvZ3JhbXNcIiksXG4gICAgdHJhbnNpdGlvbkNvbXBsZXRlID0gcmVxdWlyZSgndHJhbnNpdGlvbi1jb21wbGV0ZScpO1xuXG5yZXF1aXJlKCcuL0ZpbGVTeXN0ZW0ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ0ZpbGVTeXN0ZW0nLCB7XG4gICAgb25jZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBjbGljaygnLkZpbGVTeXN0ZW0tZmlsZScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdvcGVuRmlsZScsIFt0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1uYW1lJyldKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcHJvZ3JhbXMuYmluZCgnYWRkLCByZW1vdmUnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRyYW5zaXRpb25Db21wbGV0ZShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlbmRlcigpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBwcm9ncmFtcy5yZWFkeShmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHNlbGYucmVuZGVyKCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZGF0YTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBwcm9ncmFtczogXy5tYXAocHJvZ3JhbXMubGlzdCgpLnNvcnQoKSwgZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGl0ZW0ubmFtZS5yZXBsYWNlKC9cXC5bYS16QS1aXSskLywgJycpLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBpdGVtLm5hbWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL0ZpbGVTeXN0ZW0uaGFuZGxlYmFycycpXG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuRmlsZVN5c3RlbS1saXN0e2xpc3Qtc3R5bGU6bm9uZTtwYWRkaW5nOjA7bWFyZ2luOjA7Y3Vyc29yOnBvaW50ZXJ9LkZpbGVTeXN0ZW0tZmlsZXtsaW5lLWhlaWdodDo0NnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkICNGMUYxRjE7bWFyZ2luLWxlZnQ6MTVweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciB0ZW1wbGF0ZXIgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpLmRlZmF1bHQudGVtcGxhdGU7bW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZXIoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCI7XG5cblxuICBzdGFjazEgPSAoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAmJiBkZXB0aDAuc3VidmlldykpLHN0YWNrMSA9PSBudWxsIHx8IHN0YWNrMSA9PT0gZmFsc2UgPyBzdGFjazEgOiBzdGFjazEuVG9vbGJhcikpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyBidWZmZXIgKz0gc3RhY2sxOyB9XG4gIGJ1ZmZlciArPSBcIlxcblwiO1xuICBzdGFjazEgPSAoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAmJiBkZXB0aDAuc3VidmlldykpLHN0YWNrMSA9PSBudWxsIHx8IHN0YWNrMSA9PT0gZmFsc2UgPyBzdGFjazEgOiBzdGFjazEuRmlsZVN5c3RlbSkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyBidWZmZXIgKz0gc3RhY2sxOyB9XG4gIHJldHVybiBidWZmZXI7XG4gIH0pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpO1xuXG5yZXF1aXJlKCcuL0ZpbGVzLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdGaWxlcycsIHtcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9GaWxlcy5oYW5kbGViYXJzJyksXG4gICAgc3Vidmlld3M6IHtcbiAgICAgICAgVG9vbGJhcjogICAgcmVxdWlyZSgnLi9Ub29sYmFyL1Rvb2xiYXInKSxcbiAgICAgICAgRmlsZVN5c3RlbTogcmVxdWlyZSgnLi9GaWxlU3lzdGVtL0ZpbGVTeXN0ZW0nKVxuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctRmlsZVN5c3RlbXtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NTBweDtib3R0b206MDtvdmVyZmxvdzphdXRvO3dpZHRoOjEwMCV9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgdGVtcGxhdGVyID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKS5kZWZhdWx0LnRlbXBsYXRlO21vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVyKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICBcblxuXG4gIHJldHVybiBcIjxidXR0b24gY2xhc3M9J0ZpbGVzLVRvb2xiYXItbmV3Jz5OZXc8L2J1dHRvbj5cXG5cXG5Ub3VjaFNjcmlwdFxcblxcbjxidXR0b24gY2xhc3M9J0ZpbGVzLVRvb2xiYXItZGVsZXRlJz5EZWxldGU8L2J1dHRvbj5cIjtcbiAgfSk7IiwidmFyIFRvb2xiYXIgID0gcmVxdWlyZSgnLi4vLi4vVUkvVG9vbGJhci9Ub29sYmFyJyksXG4gICAgY2xpY2sgICAgPSByZXF1aXJlKCdvbmNsaWNrJyk7XG5cbnJlcXVpcmUoJy4vVG9vbGJhci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gVG9vbGJhci5leHRlbmQoJ0ZpbGVzLVRvb2xiYXInLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBjbGljayh7XG4gICAgICAgICAgICAnLkZpbGVzLVRvb2xiYXItbmV3JzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCduZXcnKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnLkZpbGVzLVRvb2xiYXItZGVsZXRlJzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoJy4vVG9vbGJhci5oYW5kbGViYXJzJylcbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLkZpbGVzLVRvb2xiYXItZGVsZXRle2Zsb2F0OnJpZ2h0fS5GaWxlcy1Ub29sYmFyLW5ld3tmbG9hdDpsZWZ0fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIjtcblxuXG4gIHN0YWNrMSA9ICgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zdWJ2aWV3KSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS5Ub29sYmFyKSksdHlwZW9mIHN0YWNrMSA9PT0gZnVuY3Rpb25UeXBlID8gc3RhY2sxLmFwcGx5KGRlcHRoMCkgOiBzdGFjazEpO1xuICBpZihzdGFjazEgfHwgc3RhY2sxID09PSAwKSB7IGJ1ZmZlciArPSBzdGFjazE7IH1cbiAgYnVmZmVyICs9IFwiXFxuXCI7XG4gIHN0YWNrMSA9ICgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zdWJ2aWV3KSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS50ZXJtaW5hbCkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyBidWZmZXIgKz0gc3RhY2sxOyB9XG4gIHJldHVybiBidWZmZXI7XG4gIH0pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpO1xuXG5yZXF1aXJlKCcuL1J1bi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnUnVuJywge1xuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL1J1bi5oYW5kbGViYXJzJyksXG4gICAgc3Vidmlld3M6IHtcbiAgICAgICAgVG9vbGJhcjogIHJlcXVpcmUoJy4vVG9vbGJhci9Ub29sYmFyJyksXG4gICAgICAgIHRlcm1pbmFsOiByZXF1aXJlKCcuL3Rlcm1pbmFsJylcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LVJ1bi1UZXJtaW5hbHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NTBweDtib3R0b206MDt3aWR0aDoxMDAlO3BhZGRpbmc6MTBweDtmb250LWZhbWlseTpDb25zb2xhcyxtb25hY28sbW9ub3NwYWNlOy13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOnRvdWNoO292ZXJmbG93OmF1dG99XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBrZXkgICAgID0gcmVxdWlyZSgnb25rZXknKTtcblxucmVxdWlyZSgnLi9UZXJtaW5hbC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldyhcIlJ1bi1UZXJtaW5hbFwiLCB7XG4gICAgcHJpbnQ6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZChcIjxkaXYgY2xhc3M9J1Rlcm1pbmFsLWxpbmUnPlwiK3N0cmluZytcIjwvZGl2PlwiKTtcbiAgICB9LFxuICAgIHByb21wdDogZnVuY3Rpb24oc3RyaW5nLCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgJGlucHV0ID0gJChcIjxpbnB1dCB0eXBlPSd0ZXh0JyBjbGFzcz0nVGVybWluYWwtcHJvbXB0LWlucHV0JyAvPlwiKTtcblxuICAgICAgICAkKFwiPGRpdiBjbGFzcz0nVGVybWluYWwtcHJvbXB0Jz5cIitzdHJpbmcrXCI6IDwvZGl2PlwiKVxuICAgICAgICAgICAgLmFwcGVuZCgkaW5wdXQpXG4gICAgICAgICAgICAuYXBwZW5kVG8odGhpcy4kd3JhcHBlcik7XG4gICAgICAgIFxuICAgICAgICBrZXkoJGlucHV0KS5kb3duKHtcbiAgICAgICAgICAgICdlbnRlcic6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCRpbnB1dC52YWwoKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgY2xlYXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmh0bWwoJycpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIlwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgXG5cblxuICByZXR1cm4gXCI8YnV0dG9uIGNsYXNzPSdSdW4tVG9vbGJhci1leGl0Jz5FeGl0PC9idXR0b24+XFxuXCI7XG4gIH0pOyIsInZhciBUb29sYmFyICA9IHJlcXVpcmUoJy4uLy4uL1VJL1Rvb2xiYXIvVG9vbGJhcicpLFxuICAgIGNsaWNrICAgID0gcmVxdWlyZSgnb25jbGljaycpLFxuICAgIGNvZGUgICAgID0gcmVxdWlyZSgnLi4vLi4vRWRpdG9yL2NvZGUnKTtcblxucmVxdWlyZSgnLi9Ub29sYmFyLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBUb29sYmFyLmV4dGVuZCgnUnVuLVRvb2xiYXInLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBjbGljayh7XG4gICAgICAgICAgICAnLlJ1bi1Ub29sYmFyLWV4aXQnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb2RlLmtpbGwoKTtcbiAgICAgICAgICAgICAgICBzZWxmLnRyaWdnZXIoJ2VkaXQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9Ub29sYmFyLmhhbmRsZWJhcnMnKVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuUnVuLVRvb2xiYXItZXhpdHtmbG9hdDpsZWZ0fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL1Rlcm1pbmFsL1Rlcm1pbmFsJykuc3Bhd24oKTtcbiIsInZhciBCbG9jayAgICAgICA9IHJlcXVpcmUoJy4vQ29tcG9uZW50cy9CbG9jaycpLFxuICAgIEVudmlyb25tZW50ID0gcmVxdWlyZSgnLi9Db21wb25lbnRzL0Vudmlyb25tZW50TW9kZWwnKSxcbiAgICBfICAgICAgICAgICA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSxcbiAgICBub3AgICAgICAgICA9IHJlcXVpcmUoJ25vcCcpO1xuXG5yZXF1aXJlKCcuL0NvZGUubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJsb2NrLmV4dGVuZCgnQ29kZScsIHtcbiAgICBsaXN0ZW5lcnM6IHtcbiAgICAgICAgJ2Rvd246ZXJyb3InOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMub25FcnJvci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudCA9IG5ldyBFbnZpcm9ubWVudCgpO1xuICAgICAgICB0aGlzLmZvY3VzKCk7XG4gICAgfSxcbiAgICBjb25maWd1cmU6IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICB0aGlzLnRlcm1pbmFsID0gY29uZmlnLnRlcm1pbmFsIHx8IG51bGw7XG4gICAgICAgIHRoaXMub25FcnJvciAgPSBjb25maWcub25FcnJvciAgfHwgbm9vcDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBiZWZvcmVSdW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLmVudmlyb25tZW50LmNsZWFyKCk7XG4gICAgfSxcbiAgICBraWxsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgfSxcbiAgICBkdW1wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIF8uZXh0ZW5kKHRoaXMuc3VwZXIuZHVtcC5hcHBseSh0aGlzKSwge1xuICAgICAgICAgICAgdmVyc2lvbjogXCIwLjAuMVwiXG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKioqIEV2ZW50cyAqKiovXG4gICAgb25FcnJvcjogbm9wXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUNvZGV7b3ZlcmZsb3c6YXV0bzstd2Via2l0LW92ZXJmbG93LXNjcm9sbGluZzp0b3VjaDtmb250LWZhbWlseTpDb25zb2xhcyxtb25hY28sbW9ub3NwYWNlO2xpbmUtaGVpZ2h0OjEuNmVtOy13ZWJraXQtdGFwLWhpZ2hsaWdodC1jb2xvcjpyZ2JhKDAsMCwwLDApOy1tb3otdXNlci1zZWxlY3Q6bm9uZTstbXMtdXNlci1zZWxlY3Q6bm9uZTsta2h0bWwtdXNlci1zZWxlY3Q6bm9uZTstd2Via2l0LXVzZXItc2VsZWN0Om5vbmU7LW8tdXNlci1zZWxlY3Q6bm9uZTt1c2VyLXNlbGVjdDpub25lfS5zdWJ2aWV3LUNvZGUtTGluZXttaW4taGVpZ2h0OjEuNmVtfVtjb250ZW50ZWRpdGFibGU9dHJ1ZV17LW1vei11c2VyLXNlbGVjdDp0ZXh0Oy1tcy11c2VyLXNlbGVjdDp0ZXh0Oy1raHRtbC11c2VyLXNlbGVjdDp0ZXh0Oy13ZWJraXQtdXNlci1zZWxlY3Q6dGV4dDstby11c2VyLXNlbGVjdDp0ZXh0O3VzZXItc2VsZWN0OnRleHR9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgc3VidmlldyAgICAgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgY3Vyc29yICAgICAgPSByZXF1aXJlKCcuLi9jdXJzb3InKSxcbiAgICBMaW5lICAgICAgICA9IHJlcXVpcmUoJy4vTGluZScpLFxuICAgIF8gICAgICAgICAgID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xuXG5yZXF1aXJlKCcuL0Jsb2NrLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdDb2RlLUJsb2NrJywge1xuICAgIGxpc3RlbmVyczoge1xuICAgICAgICAnZG93bjpwYXN0ZTpDb2RlLUN1cnNvcic6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdmFyIGxhc3QgPSBzdWJ2aWV3KHRoaXMuJHdyYXBwZXIuY2hpbGRyZW4oKS5sYXN0KCkpO1xuXG4gICAgICAgICAgICBpZighbGFzdC5pc0VtcHR5KCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZExpbmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5lbXB0eSgpO1xuICAgIH0sXG4gICAgYWRkTGluZTogZnVuY3Rpb24oY29udGVudCkge1xuICAgICAgICB2YXIgbGluZSA9IExpbmUuc3Bhd24oKTtcblxuICAgICAgICBpZihjb250ZW50KSB7XG4gICAgICAgICAgICBsaW5lLmxvYWQoY29udGVudCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZChsaW5lLiR3cmFwcGVyKTtcbiAgICAgICAgcmV0dXJuIGxpbmU7XG4gICAgfSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHN1YnZpZXcodGhpcy4kd3JhcHBlci5jaGlsZHJlbigpLmxhc3QoKSkuZm9jdXMoKTtcbiAgICB9LFxuICAgIGJlZm9yZVJ1bjogZnVuY3Rpb24oKSB7fSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmJlZm9yZVJ1bigpO1xuXG4gICAgICAgIC8vUnVuIGV2ZXJ5IGxpbmUgYXN5bmNyb25vdXNseVxuICAgICAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCksXG4gICAgICAgICAgICBpICAgPSAwLFxuICAgICAgICAgICAgbGVuID0gY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIChmdW5jdGlvbiBsb29wKCkge1xuICAgICAgICAgICAgc3VidmlldyhjaGlsZHJlbltpXSkucnVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICAgICAgICBsb29wKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKCk7XG4gICAgfSxcbiAgICBkdW1wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICB0aGlzLnR5cGUsXG4gICAgICAgICAgICBsaW5lczogXy5tYXAodGhpcy4kd3JhcHBlci5jaGlsZHJlbignLnN1YnZpZXctQ29kZS1MaW5lJyksIGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1YnZpZXcoY2hpbGQpLmR1bXAoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBlbXB0eTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaHRtbCgnJyk7XG4gICAgICAgIHRoaXMuYWRkTGluZSgpO1xuICAgIH0sXG4gICAgbG9hZDogZnVuY3Rpb24oZmlsZSkge1xuICAgICAgICB0aGlzLmh0bWwoJycpO1xuICAgICAgICBjb25zb2xlLmxvZyhmaWxlKTtcbiAgICAgICAgXG4gICAgICAgIGZvcih2YXIgaT0wOyBpPGZpbGUubGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYWRkTGluZShmaWxlLmxpbmVzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctQ29kZS1CbG9ja3tiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjM2KTstd2Via2l0LWJvcmRlci1yYWRpdXM6MnB4Oy1tb3otYm9yZGVyLXJhZGl1czoycHg7Ym9yZGVyLXJhZGl1czoycHg7Y29sb3I6IzExMX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBFbnZpcm9ubWVudCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY2xlYXIoKTtcbn07XG5cbkVudmlyb25tZW50LnByb3RvdHlwZSA9IHtcbiAgICBjbGVhcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudmFycyA9IHt9O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLnZhcnNbbmFtZV0gPSB2YWx1ZTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy52YXJzW25hbWVdO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW52aXJvbm1lbnQ7IiwidmFyIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgY3Vyc29yICA9IHJlcXVpcmUoJy4uL2N1cnNvcicpLFxuICAgIGNsaWNrICAgPSByZXF1aXJlKCdvbmNsaWNrJyksXG4gICAgXyAgICAgICA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxucmVxdWlyZSgnLi9GaWVsZC5sZXNzJyk7XG5cbmNsaWNrKCcuc3Vidmlldy1Db2RlLUZpZWxkJywgZnVuY3Rpb24oZSkge1xuICAgIHN1YnZpZXcodGhpcykuZm9jdXMoKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ0NvZGUtRmllbGQnLCB7XG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICBjdXJzb3IuYXBwZW5kVG8odGhpcy4kd3JhcHBlcik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgJGdldFRva2VuczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCcuc3Vidmlldy1Db2RlLVRva2VuJyk7XG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzdGFjayA9IFtdLFxuICAgICAgICAgICAgdG9rZW4sXG4gICAgICAgICAgICBwcmV2LFxuICAgICAgICAgICAgbmV4dDtcblxuICAgICAgICAvL0dldCBUb2tlbnNcbiAgICAgICAgdmFyICR0b2tlbnMgPSB0aGlzLiRnZXRUb2tlbnMoKTtcblxuICAgICAgICAvL0lnbm9yZSBFbXB0eSBMaW5lc1xuICAgICAgICBpZigkdG9rZW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vU3BlY2lhbCBDYXNlIGZvciBvbmUgYXN5bmMgdG9rZW4gKGZvciAmIHdoaWxlIGxvb3BzKVxuICAgICAgICBlbHNlIGlmKCR0b2tlbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHN1YnZpZXcoJHRva2Vuc1swXSk7XG5cbiAgICAgICAgICAgIGlmKHRva2VuLmlzQXN5bmMpIHtcbiAgICAgICAgICAgICAgICB0b2tlbi5ydW4oZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhyZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL0J1aWxkIFN0YWNrXG4gICAgICAgIGZvcih2YXIgaT0wOyBpPCR0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRva2VuID0gc3VidmlldygkdG9rZW5zW2ldKTtcblxuICAgICAgICAgICAgaWYodG9rZW4uaXNPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0b2tlbi5pc0xpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICAvLysrIGFuZCAtLSB0aGF0IG11c3Qgb3BlcmF0ZSBvbiB0aGUgcmF3IHZhcmlhYmxlXG4gICAgICAgICAgICAgICAgbmV4dCA9IHN1YnZpZXcoJHRva2Vuc1tpICsgMV0pO1xuICAgICAgICAgICAgICAgIGlmKHRva2VuICYmIHRva2VuLmlzVmFyICYmIG5leHQuaXNWYXJPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgICAgICBzdGFjay5wdXNoKG5leHQucnVuKHRva2VuKSk7XG4gICAgICAgICAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4udmFsKCkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYodG9rZW4uaXNUb2tlbikge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4ucnVuKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0b2tlbi50eXBlICE9ICdDb2RlLUN1cnNvcicpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVG9rZW4gbm90IHJlY29nbml6ZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL1JlZHVjZSBvcGVyYXRvcnNcbiAgICAgICAgdmFyIG1heFByZWNlZGVuY2UgPSA1ICsgMTtcbiAgICAgICAgd2hpbGUobWF4UHJlY2VkZW5jZS0tICYmIHN0YWNrLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGZvcihpPTA7IGk8c3RhY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IHN0YWNrW2ldO1xuXG4gICAgICAgICAgICAgICAgLy9OdWxsIHRva2VucyBzaG91bGQgYmUgZGlzY2FyZGVkXG4gICAgICAgICAgICAgICAgLy9UaGV5IGFyZSByZXR1cm5lZCB3aGVuIGEgc3RhdGVtZW50IGNhbmNlbHMgaXRzIHNlbGYgb3V0IGxpa2UgTk9UIE5PVCBvciAtLTRcbiAgICAgICAgICAgICAgICBpZih0b2tlbiAmJiB0b2tlbi5pc051bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhY2suc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICBpLS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYodG9rZW4gJiYgdG9rZW4uaXNPcGVyYXRvciAmJiAodHlwZW9mIHRva2VuLnByZWNlZGVuY2UgPT0gJ2Z1bmN0aW9uJyA/IHRva2VuLnByZWNlZGVuY2Uoc3RhY2ssIGkpIDogdG9rZW4ucHJlY2VkZW5jZSkgPT0gbWF4UHJlY2VkZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAvL09wZXJhdG9ycyBsaWtlIE5PVCB0aGF0IG9ubHkgb3BlcmF0ZSBvbiB0aGUgdG9rZW4gYWZ0ZXJcbiAgICAgICAgICAgICAgICAgICAgaWYodG9rZW4uaXNTaW5nbGVPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2suc3BsaWNlKGksIDIsIHRva2VuLnJ1bihzdGFja1tpICsgMV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGktLTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvL1N0YW5kYXJkIG9wZXJhdG9ycyB0aGF0IG9wZXJhdGUgb24gdG9rZW4gYmVmb3JlIGFuZCBhZnRlclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXYgPSBzdGFja1tpIC0gMV07XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0ID0gc3RhY2tbaSArIDFdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4uZXJyb3IoJ05vIGxlZnQtc2lkZSBmb3IgJyArIHRva2VuLnRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKGkgPT0gc3RhY2subGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuLmVycm9yKCdObyByaWdodC1zaWRlIGZvciAnICsgdG9rZW4udGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYocHJldiAmJiBwcmV2LmlzT3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2tlbi5lcnJvcignSW52YWxpZCByaWdodC1zaWRlIGZvciAnICsgdG9rZW4udGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZihuZXh0ICYmIG5leHQuaXNPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuLmVycm9yKCdJbnZhbGlkIGxlZnQtc2lkZSBmb3IgJyArIHRva2VuLnRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YWNrLnNwbGljZShpIC0gMSwgMywgdG9rZW4ucnVuKHByZXYsIG5leHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpLS07XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL1RoZSBzdGFjayBzaG91bGQgcmVkdWNlIHRvIGV4YWN0bHkgb25lIGxpdGVyYWxcbiAgICAgICAgaWYoc3RhY2subGVuZ3RoICE9PSAxKSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yKFwiU3ludGF4IEVycm9yXCIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhzdGFja1swXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdGFja1swXTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZXJyb3I6IHJlcXVpcmUoJy4vZXJyb3InKSxcbiAgICBkdW1wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICAgdGhpcy50eXBlLFxuICAgICAgICAgICAgdG9rZW5zOiBfLm1hcCh0aGlzLiRnZXRUb2tlbnMoKSwgZnVuY3Rpb24odG9rZW4pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3Vidmlldyh0b2tlbikuZHVtcCgpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGxvYWQ6IGZ1bmN0aW9uKGZpbGUpIHtcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8ZmlsZS50b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0b2tlbiA9IHN1YnZpZXcubG9va3VwKGZpbGUudG9rZW5zW2ldLnR5cGUpO1xuXG4gICAgICAgICAgICB0b2tlbiA9IHRva2VuLnNwYXduKCk7XG4gICAgICAgICAgICB0b2tlbi5sb2FkKGZpbGUudG9rZW5zW2ldKTtcblxuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQodG9rZW4uJHdyYXBwZXIpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG4iLCJ2YXIgRmllbGQgPSByZXF1aXJlKCcuL0ZpZWxkJyk7XG5cbnJlcXVpcmUoJy4vTGluZS5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmllbGQuZXh0ZW5kKCdDb2RlLUxpbmUnLCB7XG4gICAgaXNFbXB0eTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCcuc3Vidmlldy1Db2RlLVRva2VuJykubGVuZ3RoID09PSAwO1xuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctQ29kZXtjb3VudGVyLXJlc2V0OmxpbmVOdW1iZXJ9LnN1YnZpZXctQ29kZS1MaW5le3Bvc2l0aW9uOnJlbGF0aXZlO3BhZGRpbmctbGVmdDozMHB4Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveH0uc3Vidmlldy1Db2RlLUxpbmU6YmVmb3Jle2ZvbnQtZmFtaWx5OkNvbnNvbGFzLG1vbmFjbyxtb25vc3BhY2U7Y291bnRlci1pbmNyZW1lbnQ6bGluZU51bWJlcjtjb250ZW50OmNvdW50ZXIobGluZU51bWJlcik7cG9zaXRpb246YWJzb2x1dGU7aGVpZ2h0OjEwMCU7d2lkdGg6MzRweDtsZWZ0Oi00cHg7cGFkZGluZy1sZWZ0OjhweDtwYWRkaW5nLXRvcDouMWVtO2JhY2tncm91bmQ6cmdiYSgyNDEsMjQwLDI0MCwuNTMpO2JvcmRlci1yaWdodDoxcHggc29saWQgcmdiYSgwLDAsMCwuMTUpO2NvbG9yOiM1NTU7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIFRvb2x0aXAgPSByZXF1aXJlKCcuLi8uLi9Ub29sdGlwL1Rvb2x0aXAnKSxcbiAgICBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGNsaWNrICAgPSByZXF1aXJlKCdvbmNsaWNrJyk7XG5cbnJlcXVpcmUoXCIuL2Vycm9yLmxlc3NcIik7XG5cbnZhciBFcnIgPSBUb29sdGlwLmV4dGVuZCgnQ29kZS1FcnJvcicsIHtcbiAgICAgICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLiRhcnJvdy5hZGRDbGFzcygnQ29kZS1FcnJvci1hcnJvdycpO1xuICAgICAgICB9XG4gICAgfSksXG4gICAgZXJyb3I7XG5cbmNsaWNrLmFueXdoZXJlKGZ1bmN0aW9uKCkge1xuICAgIGlmKGVycm9yKSB7XG4gICAgICAgIGVycm9yLnJlbW92ZSgpO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKG1zZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHRoaXMudHJpZ2dlcignZXJyb3InLCBbdGhpcywgbXNnXSk7XG5cbiAgICBpZihlcnJvcikge1xuICAgICAgICBlcnJvci5yZW1vdmUoKTtcbiAgICB9XG4gICAgXG4gICAgLy9XYWl0IGZvciBhbmltYXRpb25cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBlcnJvciA9IEVyci5zcGF3bih7XG4gICAgICAgICAgICBtc2c6ICBtc2csXG4gICAgICAgICAgICAkZWw6ICBzZWxmLiR3cmFwcGVyXG4gICAgICAgIH0pO1xuICAgIH0sIDMwMCk7XG4gICAgXG4gICAgcmV0dXJuIGVycm9yO1xufTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUNvZGUtRXJyb3J7YmFja2dyb3VuZDojZjcwMDAwO2NvbG9yOiNmZmY7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjNweDstbW96LWJvcmRlci1yYWRpdXM6M3B4O2JvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveDtwYWRkaW5nOjJweCA2cHh9LkNvZGUtRXJyb3ItYXJyb3d7YmFja2dyb3VuZDojZjcwMDAwfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIEZpZWxkID0gcmVxdWlyZSgnLi4vQ29tcG9uZW50cy9GaWVsZCcpO1xucmVxdWlyZSgnLi9Bcmd1bWVudC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmllbGQuZXh0ZW5kKCdDb2RlLUFyZ3VtZW50Jywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICBjb25maWcgPSBjb25maWcgfHwge307XG4gICAgICAgIFxuICAgICAgICB0aGlzLm5hbWUgPSBjb25maWcubmFtZSB8fCBcIlwiO1xuICAgICAgICB0aGlzLnR5cGUgPSBjb25maWcudHlwZSB8fCBudWxsO1xuICAgIH0sXG4gICAgdGVtcGxhdGU6IFwiXFx1MjAwQlwiLFxuICAgIHRhZ05hbWU6ICdzcGFuJ1xufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuc3Vidmlldy1Db2RlLUFyZ3VtZW50e2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuNSk7cGFkZGluZzouM2VtfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIFRva2VuICAgICAgID0gcmVxdWlyZSgnLi4vVG9rZW4nKSxcbiAgICBBcmd1bWVudCAgICA9IHJlcXVpcmUoJy4uL0FyZ3VtZW50JyksXG4gICAgVmFyICAgICAgICAgPSByZXF1aXJlKCcuLi9MaXRlcmFscy9WYXIvVmFyJyksXG4gICAga2V5ICAgICAgICAgPSByZXF1aXJlKCdvbmtleScpO1xuXG5yZXF1aXJlKCcuL0Fzc2lnbi5sZXNzJyk7XG5cbi8vUHJldmVudCBFbnRlclxua2V5KCcuQ29kZS1Bc3NpZ24tVmFyJykuZG93bih7XG4gICAgJ2VudGVyJzogZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVG9rZW4uZXh0ZW5kKCdDb2RlLUFzc2lnbicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5uYW1lICAgPSBWYXIuc3Bhd24oKTtcbiAgICAgICAgdGhpcy52YWx1ZSAgPSBBcmd1bWVudC5zcGF3bigpO1xuXG4gICAgICAgIHRoaXMubmFtZS4kd3JhcHBlci5yZW1vdmVDbGFzcygndmlldy1Db2RlLVRva2VuJyk7XG5cbiAgICAgICAgdGhpcy4kd3JhcHBlclxuICAgICAgICAgICAgLmFwcGVuZCh0aGlzLm5hbWUuJHdyYXBwZXIpXG4gICAgICAgICAgICAuYXBwZW5kKCcgJnJBcnI7ICcpXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMudmFsdWUuJHdyYXBwZXIpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmh0bWwoJycpO1xuICAgIH0sXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiBcIiZyQXJyO1wiXG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLnZhbHVlLnJ1bigpO1xuICAgICAgICB0aGlzLm5hbWUuc2V0KHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm5hbWUuZm9jdXMoKTtcbiAgICB9LFxuICAgIGR1bXA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogIHRoaXMudHlwZSxcbiAgICAgICAgICAgIG5hbWU6ICB0aGlzLm5hbWUuZHVtcCgpLFxuICAgICAgICAgICAgdmFsdWU6IHRoaXMudmFsdWUuZHVtcCgpXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBsb2FkOiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGNvbnRlbnQpO1xuICAgICAgICB0aGlzLm5hbWUubG9hZChjb250ZW50Lm5hbWUpO1xuICAgICAgICB0aGlzLnZhbHVlLmxvYWQoY29udGVudC52YWx1ZSk7XG4gICAgfVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctQ29kZS1Bc3NpZ257YmFja2dyb3VuZDojODdGMDhCO2Rpc3BsYXk6aW5saW5lO3BhZGRpbmc6LjNlbSAwIC4zZW0gMnB4O21hcmdpbjowIDJweDstd2Via2l0LWJvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm9yZGVyLXJhZGl1czozcHg7Ym9yZGVyLXJhZGl1czozcHh9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgQ29udHJvbCAgPSByZXF1aXJlKCcuLi9Db250cm9sJyksXG4gICAgQXJndW1lbnQgPSByZXF1aXJlKCcuLi8uLi9Bcmd1bWVudCcpLFxuICAgIEJsb2NrICAgID0gcmVxdWlyZSgnLi4vLi4vLi4vQ29tcG9uZW50cy9CbG9jaycpLFxuICAgIF8gICAgICAgID0gcmVxdWlyZSgndW5kZXJzY29yZScpO1xuXG5yZXF1aXJlKCcuL0NvbmRpdGlvbmFsLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb250cm9sLmV4dGVuZCgnQ29kZS1Db25kaXRpb25hbCcsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy9EZWZpbmUgc3RhdGUgdmFyaWFibGVzXG4gICAgICAgIHRoaXMuY29uZGl0aW9ucyA9IFtdO1xuICAgICAgICB0aGlzLmVsc2VDb25kaXRpb24gPSBudWxsO1xuXG4gICAgICAgIC8vQWRkIGluaXRpYWwgY29uZGl0aW9uYWxcbiAgICAgICAgdGhpcy5hZGRDb25kaXRpb24oJ2lmJyk7XG4gICAgfSxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICdpZicsXG4gICAgICAgIG5hbWU6ICAgICdpZiBjb25kaXRpb25hbCdcbiAgICB9LFxuICAgIGFkZENvbmRpdGlvbjogZnVuY3Rpb24odHlwZSkge1xuICAgICAgICB2YXIgY29uZGl0aW9uID0ge1xuICAgICAgICAgICAgYmxvY2s6IEJsb2NrLnNwYXduKClcbiAgICAgICAgfTtcblxuICAgICAgICAvL0J1aWxkIENvbmRpdGlvbiBPYmplY3RzXG4gICAgICAgIGlmKHR5cGUgPT0gXCJlbHNlXCIpIHtcbiAgICAgICAgICAgIHRoaXMuZWxzZUNvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbi5hcmcgPSBBcmd1bWVudC5zcGF3bih7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJDb25kaXRpb25hbFwiXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb25kaXRpb25zLnB1c2goY29uZGl0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9BcHBlbmQgdG8gV3JhcHBlclxuICAgICAgICB2YXIgJGNvbmRpdGlvbiA9ICQoXCI8ZGl2IGNsYXNzPSdDb2RlLUNvbmRpdGlvbmFsLUJsb2NrJz5cIik7XG4gICAgICAgICAgICAkY29uZGl0aW9uSGVhZGVyID0gJChcIjxkaXYgY2xhc3M9J0NvZGUtQ29udHJvbC1IZWFkZXInPlwiKTtcblxuXG4gICAgICAgICRjb25kaXRpb25IZWFkZXIuYXBwZW5kKFxuICAgICAgICAgICAgdHlwZSA9PSBcImVsc2VcIiA/IFwiZWxzZTpcIiA6XG4gICAgICAgICAgICB0eXBlID09IFwiZWxzZSBpZlwiID8gXCJlbHNlIGlmIFwiIDpcbiAgICAgICAgICAgIHR5cGUgPT0gXCJpZlwiID8gXCJpZiBcIiA6IFwiXCJcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmKHR5cGUgIT0gXCJlbHNlXCIpIHtcbiAgICAgICAgICAgICRjb25kaXRpb25IZWFkZXJcbiAgICAgICAgICAgICAgICAuYXBwZW5kKGNvbmRpdGlvbi5hcmcuJHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgLmFwcGVuZChcIiB0aGVuOlwiKTtcbiAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICRjb25kaXRpb25cbiAgICAgICAgICAgIC5hcHBlbmQoJGNvbmRpdGlvbkhlYWRlcilcbiAgICAgICAgICAgIC5hcHBlbmQoY29uZGl0aW9uLmJsb2NrLiR3cmFwcGVyKTtcblxuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZCgkY29uZGl0aW9uKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIHJ1bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIGZvcih2YXIgaT0wOyBpPHRoaXMuY29uZGl0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIGNvbmRpdGlvbiA9IHRoaXMuY29uZGl0aW9uc1tpXTtcblxuICAgICAgICAgICAgaWYoY29uZGl0aW9uLmFyZy5ydW4oKSkge1xuICAgICAgICAgICAgICAgIGNvbmRpdGlvbi5ibG9jay5ydW4oKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0aGlzLmVsc2VDb25kaXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZWxzZUNvbmRpdGlvbi5ibG9jay5ydW4oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICB9LFxuICAgIGZvY3VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5jb25kaXRpb25zWzBdLmFyZy5mb2N1cygpO1xuICAgIH0sXG4gICAgZHVtcDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICAgICAgICBjb25kaXRpb25zOiBfLm1hcCh0aGlzLmNvbmRpdGlvbnMsIGZ1bmN0aW9uKGNvbmRpdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrOiBjb25kaXRpb24uYmxvY2suZHVtcCgpLFxuICAgICAgICAgICAgICAgICAgICBhcmc6ICAgY29uZGl0aW9uLmFyZy5kdW1wKClcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBlbHNlQ29uZGl0aW9uOiB0aGlzLmVsc2VDb25kaXRpb24uYmxvY2suZHVtcCgpXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBsb2FkOiBmdW5jdGlvbihjb250ZW50KSB7XG5cbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUNvZGUtQ29uZGl0aW9uYWx7YmFja2dyb3VuZDojQkRFMkZGO2NvbG9yOiMxOTI5N0N9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJyZXF1aXJlKCcuL0NvbnRyb2wubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4uL1Rva2VuJykuZXh0ZW5kKCdDb2RlLUNvbnRyb2wnLCB7XG4gICAgaXNDb250cm9sOiB0cnVlLFxuICAgIFxuICAgIC8qKiogU2hvdWxkIEJlIE92ZXJ3cml0dGVuICoqKi9cbiAgICBydW46ICAgIGZ1bmN0aW9uKCkge30sXG4gICAgZm9jdXM6ICBmdW5jdGlvbigpIHt9LFxuICAgIGNsZWFuOiAgZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaHRtbCgnJyk7XG4gICAgfSxcblxuICAgIC8qKiogRnVuY3Rpb25zICoqKi9cbiAgICB2YWxpZGF0ZVBvc2l0aW9uOiBmdW5jdGlvbihjdXJzb3IpIHtcbiAgICAgICAgaWYoc3VidmlldyhjdXJzb3IuJHdyYXBwZXIucGFyZW50KCkpLnR5cGUgPT0gJ0NvZGUtTGluZScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY3Vyc29yLmVycm9yKCdBICcgKyB0aGlzLm1ldGEubmFtZSArICcgbXVzdCBnbyBvbiBpdHMgb3duIGxpbmUuJyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUNvZGUtQ29udHJvbHtiYWNrZ3JvdW5kOiNGRkIyQjI7Y29sb3I6Izg4MEEwQTtwYWRkaW5nOi4wNWVtIDAgMDtkaXNwbGF5OmlubGluZS1ibG9jazttaW4td2lkdGg6MTAwJX0uQ29kZS1Db250cm9sLUhlYWRlcntwYWRkaW5nOjJweCA0cHh9LkNvZGUtQ29udHJvbC1IZWFkZXIgLnN1YnZpZXctQ29kZS1Bcmd1bWVudHstd2Via2l0LWJvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm9yZGVyLXJhZGl1czozcHg7Ym9yZGVyLXJhZGl1czozcHg7cGFkZGluZzouM2VtIDJweH0uc3Vidmlldy1Db2RlLUNvbnRyb2wgLnN1YnZpZXctQ29kZS1CbG9ja3ttaW4td2lkdGg6MjQwcHh9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgQ29udHJvbCAgPSByZXF1aXJlKCcuLi9Db250cm9sJyksXG4gICAgQXJndW1lbnQgPSByZXF1aXJlKCcuLi8uLi9Bcmd1bWVudCcpLFxuICAgIEJsb2NrICAgID0gcmVxdWlyZSgnLi4vLi4vLi4vQ29tcG9uZW50cy9CbG9jaycpO1xuXG5yZXF1aXJlKCcuL1doaWxlLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb250cm9sLmV4dGVuZCgnQ29kZS1XaGlsZScsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5jb25kaXRpb24gPSBBcmd1bWVudC5zcGF3bih7XG4gICAgICAgICAgICB0eXBlOiBcIkNvbmRpdGlvblwiXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuYmxvY2sgPSBCbG9jay5zcGF3bigpO1xuXG4gICAgICAgIC8vQnVpbGQgdGhlIFdyYXBwZXJcbiAgICAgICAgdmFyICRoZWFkZXIgPSAkKFwiPGRpdiBjbGFzcz0nQ29kZS1Db250cm9sLUhlYWRlcic+XCIpXG4gICAgICAgICAgICAuYXBwZW5kKFwid2hpbGUgXCIpXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMuY29uZGl0aW9uLiR3cmFwcGVyKVxuICAgICAgICAgICAgLmFwcGVuZCgnOicpO1xuICAgICAgICBcbiAgICAgICAgdGhpcy4kd3JhcHBlclxuICAgICAgICAgICAgLmFwcGVuZCgkaGVhZGVyKVxuICAgICAgICAgICAgLmFwcGVuZCh0aGlzLmJsb2NrLiR3cmFwcGVyKTtcbiAgICB9LFxuICAgIG1ldGE6IHtcbiAgICAgICAgZGlzcGxheTogJ3doaWxlJyxcbiAgICAgICAgbmFtZTogICAgJ3doaWxlIGxvb3AnXG4gICAgfSxcbiAgICBpc0FzeW5jOiB0cnVlLFxuICAgIHJ1bjogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgY29kZSA9IHRoaXMucGFyZW50KCdDb2RlJyk7XG4gICAgICAgIFxuICAgICAgICB2YXIgbG9vcCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaWYoc2VsZi5jb25kaXRpb24ucnVuKCkgJiYgY29kZS5ydW5uaW5nKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5ibG9jay5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwobG9vcCk7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgMCk7XG4gICAgfSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uLmZvY3VzKCk7XG4gICAgfSxcbiAgICBkdW1wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICAgICAgIHRoaXMudHlwZSxcbiAgICAgICAgICAgIGNvbmRpdGlvbjogIHRoaXMuY29uZGl0aW9uLmR1bXAoKSxcbiAgICAgICAgICAgIGJsb2NrOiAgICAgIHRoaXMuYmxvY2suZHVtcCgpXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBsb2FkOiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uLmxvYWQoY29udGVudC5jb25kaXRpb24pO1xuICAgICAgICB0aGlzLmJsb2NrLmxvYWQoY29udGVudC5ibG9jayk7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuc3Vidmlldy1Db2RlLVdoaWxlIC5Db2RlLUNvbnRyb2wtSGVhZGVyIC5zdWJ2aWV3LUNvZGUtQXJndW1lbnR7cGFkZGluZzouMmVtIDJweCAuM2VtO3RvcDotLjA1ZW07cG9zaXRpb246cmVsYXRpdmV9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKFwiLi9Db25kaXRpb25hbC9Db25kaXRpb25hbFwiKSxcbiAgICByZXF1aXJlKFwiLi9Mb29wL1doaWxlXCIpXG5dOyIsInZhciBBcmd1bWVudCA9IHJlcXVpcmUoJy4uL0FyZ3VtZW50JyksXG4gICAgY3Vyc29yICAgPSByZXF1aXJlKCcuLi8uLi9jdXJzb3InKSxcbiAgICBfICAgICAgICA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxucmVxdWlyZSgnLi9GdW5jdGlvbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi4vVG9rZW4nKS5leHRlbmQoJ0Z1bmN0aW9uJywge1xuICAgIGlzRnVuY3Rpb246IHRydWUsXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKHRoaXMubmFtZStcIihcIik7XG5cbiAgICAgICAgdGhpcy5hcmd1bWVudEluc3RhbmNlcyA9IFtdO1xuXG4gICAgICAgIC8vUGFyc2UgQXJndW1lbnRzXG4gICAgICAgIHZhciBpID0gdGhpcy5hcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIHZhciBhcmcgPSBBcmd1bWVudC5zcGF3bih0aGlzLmFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICB0aGlzLmFyZ3VtZW50SW5zdGFuY2VzLnB1c2goYXJnKTtcblxuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQoYXJnLiR3cmFwcGVyKTtcbiAgICAgICAgICAgIGlmKGkgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQoXCIsIFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQoXCIpXCIpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmh0bWwoJycpO1xuICAgIH0sXG5cbiAgICAvKioqIFNob3VsZCBCZSBPdmVyd3JpdHRlbiAqKiovXG4gICAgbmFtZTogJycsXG4gICAgLy9SdW5zIHdoZW4gdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZFxuICAgIHJ1bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgYXJndW1lbnQ6IGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJndW1lbnRJbnN0YW5jZXNbaV0ucnVuKCk7XG4gICAgfSxcbiAgICBhcmd1bWVudHM6IFtdLFxuICAgIGZvY3VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYodGhpcy5hcmd1bWVudEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmFyZ3VtZW50SW5zdGFuY2VzWzBdLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmFmdGVyKGN1cnNvcik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGR1bXA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogdGhpcy50eXBlLFxuICAgICAgICAgICAgYXJndW1lbnRzOiBfLm1hcCh0aGlzLmFyZ3VtZW50SW5zdGFuY2VzLCBmdW5jdGlvbihhcmcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnLmR1bXAoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBsb2FkOiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgXy5lYWNoKGNvbnRlbnQuYXJndW1lbnRzLCBmdW5jdGlvbihhcmcsIGkpIHtcbiAgICAgICAgICAgIHNlbGYuYXJndW1lbnRJbnN0YW5jZXNbaV0ubG9hZChhcmcpO1xuICAgICAgICB9KTtcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUZ1bmN0aW9ue2Rpc3BsYXk6aW5saW5lO2JhY2tncm91bmQ6I0QzRkZDNTtjb2xvcjojMkMyQzJDO3BhZGRpbmc6LjNlbTstd2Via2l0LWJvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm9yZGVyLXJhZGl1czozcHg7Ym9yZGVyLXJhZGl1czozcHg7bWFyZ2luOjAgMnB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIEZ1bmMgPSByZXF1aXJlKCcuLi9GdW5jdGlvbicpO1xuXG5yZXF1aXJlKCcuL1BhcmVudGhlc2VzLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBGdW5jLmV4dGVuZCgnUGFyZW50aGVzZXMnLCB7XG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnKCApJ1xuICAgIH0sXG4gICAgcnVuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJndW1lbnQoMCk7XG4gICAgfSxcbiAgICBhcmd1bWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJFeHByZXNzaW9uXCJcbiAgICAgICAgfVxuICAgIF1cbn0pOyIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LVBhcmVudGhlc2Vze2NvbG9yOiMwMDB9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgRnVuYyA9IHJlcXVpcmUoJy4uL0Z1bmN0aW9uJyk7XG5cbnJlcXVpcmUoJy4vUHJpbnQubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZ1bmMuZXh0ZW5kKCdwcmludCcsIHtcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdGVybWluYWwgPSB0aGlzLmVkaXRvcigpLnRlcm1pbmFsO1xuICAgICAgICBcbiAgICAgICAgaWYodGVybWluYWwpIHtcbiAgICAgICAgICAgIHRlcm1pbmFsLnByaW50KHRoaXMuYXJndW1lbnQoMCkpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBhcmd1bWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJTdHJpbmdcIixcbiAgICAgICAgICAgIG5hbWU6IFwiTWVzc2FnZVwiXG4gICAgICAgIH1cbiAgICBdLFxuICAgIG5hbWU6ICdwcmludCcsXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAncHJpbnQoICknXG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKCcuL1ByaW50L1ByaW50JyksXG4gICAgcmVxdWlyZSgnLi9QYXJlbnRoZXNlcy9QYXJlbnRoZXNlcycpXG5dO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctZmFsc2UsLnN1YnZpZXctdHJ1ZXtjb2xvcjojRkZGO2JhY2tncm91bmQ6IzUzQUVGNztsaW5lLWhlaWdodDoxLjNlbTttYXJnaW46LjE1ZW19XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgTGl0ZXJhbCA9IHJlcXVpcmUoJy4uL0xpdGVyYWwnKTtcbnJlcXVpcmUoJy4vQm9vbGVhbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ2ZhbHNlJywge1xuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICdmYWxzZSdcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcImZhbHNlXCIsXG4gICAgdmFsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5yZXF1aXJlKCcuL0Jvb2xlYW4ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVyYWwuZXh0ZW5kKCd0cnVlJywge1xuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICd0cnVlJ1xuICAgIH0sXG4gICAgdGVtcGxhdGU6IFwidHJ1ZVwiLFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn0pO1xuIiwicmVxdWlyZSgnLi9MaXRlcmFsLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9Ub2tlbicpLmV4dGVuZCgnTGl0ZXJhbCcsIHtcbiAgICBpc0xpdGVyYWw6IHRydWUsXG4gICAgdmFsOiBmdW5jdGlvbigpIHt9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUxpdGVyYWx7ZGlzcGxheTppbmxpbmUtYmxvY2s7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjNweDstbW96LWJvcmRlci1yYWRpdXM6M3B4O2JvcmRlci1yYWRpdXM6M3B4O3BhZGRpbmc6MCA0cHg7bWFyZ2luOjAgMXB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5yZXF1aXJlKCcuL051bWJlci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ0NvZGUtTnVtYmVyJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dCA9IHRoaXMuJHdyYXBwZXIuZmluZCgnLm51bWJlci1pbnB1dCcpO1xuICAgIH0sXG4gICAgdGFnTmFtZTogJ3NwYW4nLFxuICAgIG1ldGE6IHtcbiAgICAgICAgZGlzcGxheTogJzEyMydcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcIjxpbnB1dCB0eXBlPSd0ZXh0JyBwYXR0ZXJuPSdcXFxcZConIGNsYXNzPSdudW1iZXItaW5wdXQnLz5cIixcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJGlucHV0LmZvY3VzKCk7XG4gICAgfSxcbiAgICBjbGVhbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJGlucHV0Lmh0bWwoJycpO1xuICAgIH0sXG4gICAgdmFsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpcy4kaW5wdXQudmFsKCksIDEwKTtcbiAgICB9LFxuICAgIGR1bXA6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogIHRoaXMudHlwZSxcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLnZhbCgpXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBsb2FkOiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgICAgIHRoaXMuJGlucHV0LnZhbChjb250ZW50LnZhbHVlKTtcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LUNvZGUtTnVtYmVye2NvbG9yOnB1cnBsZX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBMaXRlcmFsID0gcmVxdWlyZSgnLi4vTGl0ZXJhbCcpLFxuICAgIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3Jyk7XG5cbnJlcXVpcmUoJy4vU3RyaW5nLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBMaXRlcmFsLmV4dGVuZCgnQ29kZS1TdHJpbmcnLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJGlucHV0ID0gdGhpcy4kd3JhcHBlci5maW5kKCcuc3RyaW5nLWlucHV0Jyk7XG4gICAgfSxcbiAgICB0YWdOYW1lOiAnc3BhbicsXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnXCJhYmNcIidcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcIiZsZHF1bzs8c3BhbiBjb250ZW50ZWRpdGFibGU9J3RydWUnIGNsYXNzPSdzdHJpbmctaW5wdXQnPjwvc3Bhbj4mcmRxdW87XCIsXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5mb2N1cygpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5odG1sKCcnKTtcbiAgICB9LFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRpbnB1dC50ZXh0KCk7XG4gICAgfSxcbiAgICBkdW1wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6ICB0aGlzLnR5cGUsXG4gICAgICAgICAgICB2YWx1ZTogdGhpcy52YWwoKVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgbG9hZDogZnVuY3Rpb24oY29udGVudCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5odG1sKGNvbnRlbnQudmFsdWUpO1xuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctQ29kZS1TdHJpbmd7Y29sb3I6IzFCMUJEMztiYWNrZ3JvdW5kOiNGREZEQUE7ZGlzcGxheTppbmxpbmU7cGFkZGluZzouMmVtfS5zdHJpbmctaW5wdXR7bGluZS1oZWlnaHQ6MWVtfS5zdHJpbmctaW5wdXQ6Zm9jdXN7b3V0bGluZTowfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5cbnJlcXVpcmUoJy4vVmFyLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBMaXRlcmFsLmV4dGVuZCgnQ29kZS1WYXInLCB7XG4gICAgaXNWYXI6IHRydWUsXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJG5hbWUgPSAkKFwiPHNwYW4gY29udGVudGVkaXRhYmxlPSd0cnVlJyBjbGFzcz0nQ29kZS1WYXItSW5wdXQnIGF1dG9jb3JyZWN0PSdvZmYnIGF1dG9jYXBpdGFsaXplPSdvZmYnIC8+XCIpO1xuXG4gICAgICAgIHRoaXMuJHdyYXBwZXJcbiAgICAgICAgICAgIC5hcHBlbmQodGhpcy4kbmFtZSk7XG4gICAgfSxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6IFwiVmFyXCJcbiAgICB9LFxuICAgIG5hbWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kbmFtZS52YWwoKTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIHRoaXMucGFyZW50KCdDb2RlJykuZW52aXJvbm1lbnQuc2V0KHRoaXMubmFtZSgpLCB2YWwpO1xuICAgICAgICByZXR1cm4gdmFsO1xuICAgIH0sXG4gICAgdmFsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyZW50KCdDb2RlJykuZW52aXJvbm1lbnQuZ2V0KHRoaXMubmFtZSgpKTtcbiAgICB9LFxuICAgIGZvY3VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kbmFtZS5mb2N1cygpO1xuICAgIH0sXG4gICAgZHVtcDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiAgdGhpcy50eXBlLFxuICAgICAgICAgICAgdmFsdWU6IHRoaXMuJG5hbWUuaHRtbCgpXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBsb2FkOiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgICAgIHRoaXMuJG5hbWUuaHRtbChjb250ZW50LnZhbHVlKTtcbiAgICB9XG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuc3Vidmlldy1Db2RlLVZhcntiYWNrZ3JvdW5kOiNBNkZGOTQ7Y29sb3I6IzFGMUYxRjtwYWRkaW5nOjA7bGluZS1oZWlnaHQ6MS4zZW07bWFyZ2luOi4xNWVtfS5Db2RlLVZhci1JbnB1dHtkaXNwbGF5OmlubGluZS1ibG9jazttaW4td2lkdGg6MTBweDtwYWRkaW5nOjAgNXB4O2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuNSk7dGV4dC1hbGlnbjpjZW50ZXJ9LkNvZGUtVmFyLUlucHV0OmZvY3Vze291dGxpbmU6MH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHJlcXVpcmUoJy4vU3RyaW5nL1N0cmluZycpLFxuICAgIHJlcXVpcmUoJy4vTnVtYmVyL051bWJlcicpLFxuICAgIHJlcXVpcmUoJy4vQm9vbGVhbnMvVHJ1ZScpLFxuICAgIHJlcXVpcmUoJy4vQm9vbGVhbnMvRmFsc2UnKSxcbiAgICByZXF1aXJlKCcuL1Zhci9WYXInKVxuXTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Cb29sZWFuJykuZXh0ZW5kKCdBTkQnLCB7XG4gICAgdGVtcGxhdGU6IFwiQU5EXCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCAmJiBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJ2YXIgT3BlcmF0b3IgPSByZXF1aXJlKCcuLi9PcGVyYXRvcicpO1xucmVxdWlyZSgnLi9Cb29sZWFuLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBPcGVyYXRvci5leHRlbmQoJ0NvZGUtQm9vbGVhbicsIHtcbiAgICBwcmVjZWRlbmNlOiAwXG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuc3Vidmlldy1Db2RlLUJvb2xlYW57Y29sb3I6I0ZGRjtiYWNrZ3JvdW5kOiNFOTdGRTB9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQm9vbGVhbicpLmV4dGVuZCgnQ29kZS1OT1QnLCB7XG4gICAgaXNTaW5nbGVPcGVyYXRvcjogICB0cnVlLFxuICAgIHRlbXBsYXRlOiAgICAgICAgICAgXCJOT1RcIixcbiAgICBwcmVjZWRlbmNlOiAgICAgICAgIDUsXG4gICAgcnVuOiBmdW5jdGlvbihleHApIHtcbiAgICAgICAgaWYoZXhwLnR5cGUgPT0gJ05PVCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaXNOdWxsOiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICFleHA7XG4gICAgICAgIH1cbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Cb29sZWFuJykuZXh0ZW5kKCdPUicsIHtcbiAgICB0ZW1wbGF0ZTogXCJPUlwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgfHwgc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Jvb2xlYW4nKS5leHRlbmQoJ1hPUicsIHtcbiAgICB0ZW1wbGF0ZTogXCJYT1JcIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuICFmaXJzdCAhPSAhc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZSgnLi9BTkQnKSxcbiAgICByZXF1aXJlKCcuL09SJyksXG4gICAgcmVxdWlyZSgnLi9YT1InKSxcbiAgICByZXF1aXJlKCcuL05PVCcpXG5dO1xuIiwidmFyIE9wZXJhdG9yID0gcmVxdWlyZSgnLi4vT3BlcmF0b3InKTtcbnJlcXVpcmUoJy4vQ29tcGFyYXRvci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gT3BlcmF0b3IuZXh0ZW5kKCdDb2RlLUNvbXBhcmF0b3InLCB7XG4gICAgcHJlY2VkZW5jZTogMVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctQ29kZS1Db21wYXJhdG9ye2NvbG9yOiNGRkY7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC43NSl9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQ29tcGFyYXRvcicpLmV4dGVuZCgnRXF1YWxzJywge1xuICAgIHRlbXBsYXRlOiBcIj1cIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0ID09IHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9yJykuZXh0ZW5kKCdHcmVhdGVyVGhhbicsIHtcbiAgICB0ZW1wbGF0ZTogXCI+XCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCA+IHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9yJykuZXh0ZW5kKCdHcmVhdGVyVGhhbkVxdWFscycsIHtcbiAgICB0ZW1wbGF0ZTogXCImZ2U7XCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCA+PSBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQ29tcGFyYXRvcicpLmV4dGVuZCgnTGVzc1RoYW4nLCB7XG4gICAgdGVtcGxhdGU6IFwiPFwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgPCBzZWNvbmQ7XG4gICAgfVxufSk7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0NvbXBhcmF0b3InKS5leHRlbmQoJ0xlc3NUaGFuRXF1YWxzJywge1xuICAgIHRlbXBsYXRlOiBcIiZsZTtcIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0IDw9IHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHJlcXVpcmUoJy4vR3JlYXRlclRoYW4nKSxcbiAgICByZXF1aXJlKCcuL0dyZWF0ZXJUaGFuRXF1YWxzJyksXG4gICAgcmVxdWlyZSgnLi9FcXVhbHMnKSxcbiAgICByZXF1aXJlKCcuL0xlc3NUaGFuRXF1YWxzJyksXG4gICAgcmVxdWlyZSgnLi9MZXNzVGhhbicpXG5dOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9NYXRoJykuZXh0ZW5kKCdEaXZpZGUnLCB7XG4gICAgdGVtcGxhdGU6IFwiJmZyYXNsO1wiLFxuICAgIHByZWNlZGVuY2U6IDMsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdC9zZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vTWF0aCcpLmV4dGVuZCgnRXhwJywge1xuICAgIHRlbXBsYXRlOiBcIl5cIixcbiAgICBwcmVjZWRlbmNlOiA0LFxuICAgIHJ1bjogTWF0aC5wb3dcbn0pOyIsInZhciBPcGVyYXRvciA9IHJlcXVpcmUoJy4uL09wZXJhdG9yJyk7XG5yZXF1aXJlKCcuL01hdGgubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9wZXJhdG9yLmV4dGVuZCgnQ29kZS1NYXRoJywge1xuICAgIFxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctQ29kZS1NYXRoe2NvbG9yOiNGRkY7YmFja2dyb3VuZDojRkZBNDVDfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ01pbnVzJywge1xuICAgIHRlbXBsYXRlOiBcIi1cIixcbiAgICBwcmVjZWRlbmNlOiBmdW5jdGlvbihzdGFjaywgaSkge1xuICAgICAgICBpZihpID09PSAwIHx8IHN0YWNrW2kgLSAxXS5pc09wZXJhdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmlzU2luZ2xlT3BlcmF0b3IgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIDU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG5cbiAgICAgICAgLy9OZWdhdGlvbiBPcGVyYXRvclxuICAgICAgICBpZih0eXBlb2Ygc2Vjb25kID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZihmaXJzdC50eXBlID09ICdNaW51cycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBpc051bGw6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC1maXJzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vTWludXMgT3BlcmF0b3JcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmlyc3QgLSBzZWNvbmQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmlzU2luZ2xlT3BlcmF0b3IgPSBmYWxzZTtcbiAgICB9LFxuICAgIGNsZWFuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pc1NpbmdsZU9wZXJhdG9yID0gZmFsc2U7XG4gICAgfVxufSk7XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ0NvZGUtTWludXNNaW51cycsIHtcbiAgICBpc1Zhck9wZXJhdG9yOiB0cnVlLFxuICAgIHRlbXBsYXRlOiAgIFwiLS1cIixcbiAgICBwcmVjZWRlbmNlOiA1LFxuICAgIHJ1bjogZnVuY3Rpb24oaW50KSB7XG4gICAgICAgIGlmKF8uaXNPYmplY3QoaW50KSAmJiBpbnQuaXNUb2tlbiAmJiBpbnQudHlwZSA9PSAnQ29kZS1WYXInKSB7XG4gICAgICAgICAgICB2YXIgdmFsID0gaW50LnZhbCgpO1xuXG4gICAgICAgICAgICBpZih0eXBlb2YgdmFsID09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgdmFsLS07XG4gICAgICAgICAgICAgICAgcmV0dXJuIGludC5zZXQodmFsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIi0tIHdhcyB1c2VkIG9uIGEgdmFyaWFibGUgd2l0aCBub24taW50ZWdlciB2YWx1ZS5cIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGludC52YWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoXCItLSBjYW4gb25seSBiZSB1c2VkIG9uIHZhcmlhYmxlcy5cIik7XG4gICAgICAgIH1cbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9NYXRoJykuZXh0ZW5kKCdNdWx0aXBseScsIHtcbiAgICB0ZW1wbGF0ZTogXCImdGltZXM7XCIsXG4gICAgcHJlY2VkZW5jZTogMyxcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0KnNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9NYXRoJykuZXh0ZW5kKCdQbHVzJywge1xuICAgIHRlbXBsYXRlOiBcIitcIixcbiAgICBwcmVjZWRlbmNlOiAyLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgKyBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJ2YXIgXyA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ0NvZGUtUGx1c1BsdXMnLCB7XG4gICAgaXNWYXJPcGVyYXRvcjogdHJ1ZSxcbiAgICB0ZW1wbGF0ZTogICBcIisrXCIsXG4gICAgcHJlY2VkZW5jZTogNSxcbiAgICBydW46IGZ1bmN0aW9uKGludCkge1xuICAgICAgICBpZihfLmlzT2JqZWN0KGludCkgJiYgaW50LmlzVG9rZW4gJiYgaW50LnR5cGUgPT0gJ0NvZGUtVmFyJykge1xuICAgICAgICAgICAgdmFyIHZhbCA9IGludC52YWwoKTtcblxuICAgICAgICAgICAgaWYodHlwZW9mIHZhbCA9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgIHZhbCsrO1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnQuc2V0KHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCIrKyB3YXMgdXNlZCBvbiBhIHZhcmlhYmxlIHdpdGggbm9uLWludGVnZXIgdmFsdWUuXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnQudmFsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmVycm9yKFwiKysgY2FuIG9ubHkgYmUgdXNlZCBvbiB2YXJpYWJsZXMuXCIpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKCcuL0V4cCcpLFxuICAgIHJlcXVpcmUoJy4vRGl2aWRlJyksXG4gICAgcmVxdWlyZSgnLi9NdWx0aXBseScpLFxuICAgIHJlcXVpcmUoJy4vTWludXMnKSxcbiAgICByZXF1aXJlKCcuL1BsdXMnKSxcbiAgICByZXF1aXJlKCcuL1BsdXNQbHVzJyksXG4gICAgcmVxdWlyZSgnLi9NaW51c01pbnVzJylcbl07XG4iLCJyZXF1aXJlKCcuL09wZXJhdG9yLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9Ub2tlbicpLmV4dGVuZCgnT3BlcmF0b3InLCB7XG4gICAgaXNPcGVyYXRvcjogdHJ1ZSxcbiAgICB0YWdOYW1lOiAnc3Bhbidcbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnN1YnZpZXctT3BlcmF0b3J7ZGlzcGxheTppbmxpbmUtYmxvY2s7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjNweDstbW96LWJvcmRlci1yYWRpdXM6M3B4O2JvcmRlci1yYWRpdXM6M3B4O3BhZGRpbmc6MCA2cHg7bGluZS1oZWlnaHQ6MS4zZW07bWFyZ2luOi4xNWVtIDFweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9ycy9pbmRleCcpLmNvbmNhdChcbiAgICByZXF1aXJlKCcuL01hdGgvaW5kZXgnKSxcbiAgICByZXF1aXJlKCcuL0Jvb2xlYW4vaW5kZXgnKVxuKTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBjdXJzb3IgID0gcmVxdWlyZSgnLi4vY3Vyc29yJyksXG4gICAgbm9wICAgICA9IHJlcXVpcmUoJ25vcCcpO1xuXG5yZXF1aXJlKCcuL1Rva2VuLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdDb2RlLVRva2VuJywge1xuICAgIGlzVG9rZW46IHRydWUsXG4gICAgbWV0YToge30sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFmdGVyKGN1cnNvcik7XG4gICAgfSxcbiAgICBlcnJvcjogcmVxdWlyZSgnLi4vQ29tcG9uZW50cy9lcnJvcicpLFxuICAgIHZhbGlkYXRlUG9zaXRpb246IGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIGVkaXRvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudCgnQ29kZScpO1xuICAgIH0sXG4gICAgZHVtcDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiB0aGlzLnR5cGVcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGxvYWQ6IG5vcFxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vRnVuY3Rpb25zL2luZGV4JykuY29uY2F0KFxuICAgIHJlcXVpcmUoJy4vTGl0ZXJhbHMvaW5kZXgnKSxcbiAgICByZXF1aXJlKCcuL09wZXJhdG9ycy9pbmRleCcpLFxuICAgIHJlcXVpcmUoJy4vQ29udHJvbC9pbmRleCcpLFxuICAgIHJlcXVpcmUoJy4vQXNzaWduL0Fzc2lnbicpXG4pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpO1xuXG5yZXF1aXJlKCcuL2N1cnNvci5sZXNzJyk7XG5cbnZhciBDdXJzb3IgPSBzdWJ2aWV3KCdDb2RlLUN1cnNvcicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vVE9ETzogVEhJUyBJUyBXUk9OR1xuICAgICAgICAkKGRvY3VtZW50KS5vbignZm9jdXMnLCAnaW5wdXQsIGRpdicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5oaWRlKCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgcGFzdGU6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgdGhpcy5zaG93KCk7XG5cbiAgICAgICAgLy9HZXQgdGhlIHR5cGVcbiAgICAgICAgdmFyIFR5cGUgPSBzdWJ2aWV3Lmxvb2t1cCh0eXBlKTtcblxuICAgICAgICBpZighVHlwZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlR5cGUgJ1wiK3R5cGUrXCInIGRvZXMgbm90IGV4aXN0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9WYWxpZGF0ZSBQb3NpdGlvblxuICAgICAgICBpZihUeXBlLlN1YnZpZXcucHJvdG90eXBlLnZhbGlkYXRlUG9zaXRpb24odGhpcykpIHtcblxuICAgICAgICAgICAgLy9QYXN0ZSB0aGUgZnVuY3Rpb25cbiAgICAgICAgICAgIHZhciBjb21tYW5kID0gVHlwZS5zcGF3bigpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmJlZm9yZShjb21tYW5kLiR3cmFwcGVyKTtcbiAgICAgICAgICAgIGNvbW1hbmQuZm9jdXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vRXZlbnRcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdwYXN0ZScpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBzaG93OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ2Rpc3BsYXknLCAnaW5saW5lLWJsb2NrJyk7XG4gICAgICAgICQoJzpmb2N1cycpLmJsdXIoKTtcbiAgICB9LFxuICAgIGhpZGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgfSxcbiAgICBhcHBlbmRUbzogZnVuY3Rpb24oJGVsKSB7XG4gICAgICAgIHRoaXMuc2hvdygpO1xuICAgICAgICAkZWwuYXBwZW5kKHRoaXMuJHdyYXBwZXIpO1xuICAgIH0sXG4gICAgZXJyb3I6IHJlcXVpcmUoJy4vQ29tcG9uZW50cy9lcnJvcicpXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDdXJzb3Iuc3Bhd24oKTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIkAtd2Via2l0LWtleWZyYW1lcyBmbGFzaHswJSwxMDAle29wYWNpdHk6MX01MCV7b3BhY2l0eTowfX0uc3Vidmlldy1Db2RlLUN1cnNvcntwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDoycHg7aGVpZ2h0OjEuMmVtO21hcmdpbjotLjFlbSAtMXB4O3RvcDouMjVlbTtiYWNrZ3JvdW5kOiMxMjc5RkM7LXdlYmtpdC1hbmltYXRpb246Zmxhc2ggMXMgaW5maW5pdGV9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBwcmVmaXggID0gcmVxdWlyZSgncHJlZml4JyksXG4gICAgJCAgICAgICA9IHJlcXVpcmUoJ3Vub3BpbmlvbmF0ZScpLnNlbGVjdG9yO1xuXG5yZXF1aXJlKCcuL1NsaWRlci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnU2xpZGVyJywge1xuXG4gICAgLyoqKiBDb25maWd1cmF0aW9uICoqKi9cbiAgICBwYW5lbHM6ICAgICAgICAgW10sXG4gICAgZGVmYXVsdFBhbmVsOiAgIDAsXG4gICAgc3BlZWQ6ICAgICAgICAgIDMwMCxcblxuICAgIC8qKiogQ29yZSBGdW5jdGlvbmFsaXR5ICoqKi9cbiAgICBvbmNlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kc2xpZGVyID0gJChcIjxkaXYgY2xhc3M9J1NsaWRlci1TbGlkZXInPlwiKVxuICAgICAgICAgICAgLmFwcGVuZFRvKHRoaXMuJHdyYXBwZXIpO1xuXG4gICAgICAgIC8vQ29uZmlndXJlIFRyYW5zaXRpb25zXG4gICAgICAgIHRoaXMuX3NldHVwVHJhbnNpdGlvbnMoKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMucGFuZWxXaWR0aCA9IDEwMC90aGlzLnBhbmVscy5sZW5ndGg7XG4gICAgICAgIFxuICAgICAgICAvL0J1aWxkIHRoZSBwYW5lbHNcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5wYW5lbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBwYW5lbCA9IHRoaXMucGFuZWxzW2ldLFxuICAgICAgICAgICAgICAgIHN1YnZpZXcgPSBwYW5lbC5jb250ZW50LmlzU3Vidmlld1Bvb2wgPyBwYW5lbC5jb250ZW50LnNwYXduKCkgOiBwYW5lbC5jb250ZW50O1xuXG4gICAgICAgICAgICAvL0NvbmZpZ3VyZSB0aGUgUGFuZWxcbiAgICAgICAgICAgIHBhbmVsLmNvbnRlbnQgICA9IHN1YnZpZXc7XG4gICAgICAgICAgICBwYW5lbC4kd3JhcHBlciAgPSBzdWJ2aWV3LiR3cmFwcGVyO1xuXG4gICAgICAgICAgICAvL0FkZCBDbGFzc1xuICAgICAgICAgICAgcGFuZWwuJHdyYXBwZXJcbiAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoJ1NsaWRlci1QYW5lbCcpXG4gICAgICAgICAgICAgICAgLmNzcygnd2lkdGgnLCB0aGlzLnBhbmVsV2lkdGggKyAnJScpO1xuXG4gICAgICAgICAgICAvL0FwcGVuZFxuICAgICAgICAgICAgdGhpcy4kc2xpZGVyLmFwcGVuZChwYW5lbC4kd3JhcHBlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvL1NldCBTbGlkZXIgV2lkdGhcbiAgICAgICAgdGhpcy4kc2xpZGVyLmNzcygnd2lkdGgnLCAodGhpcy5wYW5lbHMubGVuZ3RoKjEwMCkgKyAnJScpO1xuICAgIH0sXG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2hvdyh0aGlzLmRlZmF1bHRQYW5lbCk7XG4gICAgfSxcblxuICAgIC8qKiogTWV0aG9kcyAqKiovXG4gICAgc2hvdzogZnVuY3Rpb24oaSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYodHlwZW9mIGkgPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGkgPSB0aGlzLl9nZXRQYW5lbE51bShpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuJHNsaWRlci5jc3MoXG4gICAgICAgICAgICBwcmVmaXguZGFzaCgndHJhbnNmb3JtJyksIFxuICAgICAgICAgICAgJ3RyYW5zbGF0ZSgtJyArIChpKnRoaXMucGFuZWxXaWR0aCkgKyAnJSknXG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy50cmlnZ2VyKCdzbGlkZScsIFtpXSk7XG5cbiAgICAgICAgaWYoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIHRoaXMuc3BlZWQpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKiogSW50ZXJuYWwgTWV0aG9kcyAqKiovXG4gICAgX2dldFBhbmVsTnVtOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIHZhciBpID0gdGhpcy5wYW5lbHMubGVuZ3RoO1xuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIGlmKHRoaXMucGFuZWxzW2ldLm5hbWUgPT0gbmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5lcnJvcignUGFuZWwgXCInK25hbWUrJ1wiIGlzIG5vdCBkZWZpbmVkLicpO1xuICAgICAgICByZXR1cm4gMDtcbiAgICB9LFxuICAgIF9zZXR1cFRyYW5zaXRpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kc2xpZGVyLmNzcyhwcmVmaXguZGFzaCgndHJhbnNpdGlvbicpLCBwcmVmaXguZGFzaCgndHJhbnNmb3JtJykgKyAnICcgKyAodGhpcy5zcGVlZC8xMDAwKSArICdzJyk7XG4gICAgfSxcbiAgICBfcmVtb3ZlVHJhbnNpdGlvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRzbGlkZXIuY3NzKHByZWZpeC5kYXNoKCd0cmFuc2l0aW9uJyksICdub25lJyk7XG4gICAgfVxuXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LVNsaWRlcntwb3NpdGlvbjpyZWxhdGl2ZTt3aWR0aDoxMDAlO2hlaWdodDoxMDAlO292ZXJmbG93OmhpZGRlbn0uU2xpZGVyLVNsaWRlcntwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7dG9wOjA7aGVpZ2h0OjEwMCU7d2hpdGUtc3BhY2U6bm93cmFwfS5TbGlkZXItUGFuZWx7ZGlzcGxheTppbmxpbmUtYmxvY2s7cG9zaXRpb246cmVsYXRpdmU7aGVpZ2h0OjEwMCU7dmVydGljYWwtYWxpZ246dG9wO3doaXRlLXNwYWNlOm5vcm1hbH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBzdWJ2aWV3ICAgICA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBjbGljayAgICA9IHJlcXVpcmUoJ29uY2xpY2snKTtcblxucmVxdWlyZSgnLi9Ub29sYmFyLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KFwiVG9vbGJhclwiKTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5zdWJ2aWV3LVRvb2xiYXJ7cG9zaXRpb246YWJzb2x1dGU7aGVpZ2h0OjUwcHg7d2lkdGg6MTAwJTtiYWNrZ3JvdW5kOiNGMUYwRjA7Ym9yZGVyLWJvdHRvbTpzb2xpZCAxcHggI0NDQzstbW96LWJveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LWJveC1zaXppbmc6Ym9yZGVyLWJveDtib3gtc2l6aW5nOmJvcmRlci1ib3g7cGFkZGluZy10b3A6MjBweDt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjojNDE0MTQxfS5zdWJ2aWV3LVRvb2xiYXIgYnV0dG9ue2NvbG9yOiMyQTkwRkY7Ym9yZGVyOjA7YmFja2dyb3VuZDowIDA7Zm9udC1zaXplOjE1cHg7b3V0bGluZTowO3BhZGRpbmc6MCA1cHg7aGVpZ2h0OjEwMCV9LnN1YnZpZXctVG9vbGJhciBidXR0b246YWN0aXZle2NvbG9yOiNCQURCRkZ9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgdGVtcGxhdGVyID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKS5kZWZhdWx0LnRlbXBsYXRlO21vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVyKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMubXNnKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLm1zZyk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgcmV0dXJuIGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKTtcbiAgfSk7IiwidmFyIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgJCAgICAgICA9IHJlcXVpcmUoJ3Vub3BpbmlvbmF0ZScpLnNlbGVjdG9yO1xuXG52YXIgJGJvZHkgPSAkKCdib2R5Jyk7XG5cbnJlcXVpcmUoJy4vVG9vbHRpcC5sZXNzJyk7XG5cbnZhciBhcnJvd1NwYWNlICA9IDEwLFxuICAgIGFycm93T2Zmc2V0ID0gNixcbiAgICBtYXJnaW4gICAgICA9IDU7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnVG9vbHRpcCcsIHtcbiAgICBjb25maWc6IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgICAgICB0aGlzLm1zZyA9IGNvbmZpZy5tc2c7XG4gICAgfSxcbiAgICBpbml0OiBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgdmFyICRlbCA9IGNvbmZpZy4kZWwsXG4gICAgICAgICAgICAkY29uc3RyYWluID0gY29uZmlnLiRjb25zdHJhaW4gfHwgJGJvZHk7IC8vQ29uc3RyYWludCBzaG91bGQgYWx3YXlzIGhhdmUgcmVsYXRpdmUgb3IgYWJzb2x1dGUgcG9zaXRpb25pbmdcblxuICAgICAgICAvKioqIEFwcGVuZCB0byBEb2N1bWVudCAqKiovXG4gICAgICAgIC8vIERvIHRoaXMgaGVyZSBzbyB0aGF0IHRoZSBkZWZhdWx0IGRpbWVuc2lvbnMgc2hvdyB1cFxuICAgICAgICAkY29uc3RyYWluXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMuJHdyYXBwZXIpXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMuJGFycm93KTtcblxuICAgICAgICAvKioqIEdldCBwb3NpdGlvbiBkYXRhICoqKi9cbiAgICAgICAgdmFyIGVsICAgICAgPSAkZWwub2Zmc2V0KCksXG4gICAgICAgICAgICBjb24gICAgID0gJGNvbnN0cmFpbi5vZmZzZXQoKTtcblxuICAgICAgICBlbC53aWR0aCAgICA9ICRlbC5vdXRlcldpZHRoKCk7XG4gICAgICAgIGVsLmhlaWdodCAgID0gJGVsLm91dGVySGVpZ2h0KCk7XG5cbiAgICAgICAgY29uLndpZHRoICAgPSAkY29uc3RyYWluLm91dGVyV2lkdGgoKTtcbiAgICAgICAgY29uLmhlaWdodCAgPSAkY29uc3RyYWluLm91dGVySGVpZ2h0KCk7XG5cbiAgICAgICAgdmFyIHdyYXBIICAgPSB0aGlzLiR3cmFwcGVyLm91dGVySGVpZ2h0KCksXG4gICAgICAgICAgICB3cmFwVyAgID0gdGhpcy4kd3JhcHBlci5vdXRlcldpZHRoKCk7XG5cbiAgICAgICAgLy9HZXQgZGVyaXZlZCBwb3NpdGlvbiBkYXRhXG4gICAgICAgIGVsLm1pZCA9IGVsLmxlZnQgKyBlbC53aWR0aC8yO1xuXG4gICAgICAgIC8qKiogRGV0ZXJtaW5lIHZlcnRpY2FsIHBvc2l0aW9uICoqKi9cbiAgICAgICAgdmFyIHRvcFNwYWNlICAgID0gZWwudG9wIC0gY29uLnRvcCAtIG1hcmdpbiAtIGFycm93U3BhY2UsXG4gICAgICAgICAgICBib3R0b21TcGFjZSA9IChjb24udG9wICsgY29uLmhlaWdodCkgLSAoZWwudG9wICsgZWwuaGVpZ2h0KSAtIG1hcmdpbiAtIGFycm93U3BhY2UsXG4gICAgICAgICAgICB0b3A7XG5cbiAgICAgICAgLy9QdXQgaXQgYWJvdmUgdGhlIGVsZW1lbnRcbiAgICAgICAgaWYodG9wU3BhY2UgPiBib3R0b21TcGFjZSkge1xuICAgICAgICAgICAgaWYod3JhcEggPiB0b3BTcGFjZSkge1xuICAgICAgICAgICAgICAgIHdyYXBIID0gdG9wU3BhY2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRvcCA9IGVsLnRvcCAtIHdyYXBIIC0gYXJyb3dTcGFjZTtcblxuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ3RvcCcsIHRvcCk7XG4gICAgICAgICAgICB0aGlzLiRhcnJvdy5jc3MoJ3RvcCcsIHRvcCArIHdyYXBIICsgYXJyb3dPZmZzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9QdXQgaXQgYmVsb3cgdGhlIGVsZW1lbnRcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZih3cmFwSCA+IGJvdHRvbVNwYWNlKSB7XG4gICAgICAgICAgICAgICAgd3JhcEggPSB0b3BTcGFjZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdG9wID0gZWwudG9wICsgZWwuaGVpZ2h0ICsgYXJyb3dTcGFjZTtcblxuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ3RvcCcsIHRvcCk7XG4gICAgICAgICAgICB0aGlzLiRhcnJvdy5jc3MoJ3RvcCcsIHRvcCAtIGFycm93T2Zmc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuJHdyYXBwZXIuY3NzKCdoZWlnaHQnLCB3cmFwSCk7XG5cbiAgICAgICAgLyoqKiBEZXRlcm1pbmUgSG9yaXpvbnRhbCBQb3NpdGlvbiAqKiovXG4gICAgICAgIHZhciBjZW50ZXJMZWZ0ID0gZWwubWlkIC0gd3JhcFcvMjtcbiAgICAgICAgdGhpcy4kYXJyb3cuY3NzKCdsZWZ0JywgZWwubWlkIC0gYXJyb3dPZmZzZXQpO1xuICAgICAgICBcbiAgICAgICAgaWYoY2VudGVyTGVmdCA8IGNvbi5sZWZ0KSB7XG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmNzcygnbGVmdCcsIG1hcmdpbik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihjZW50ZXJMZWZ0ICsgd3JhcFcgPiBjb24ubGVmdCArIGNvbi53aWR0aCkge1xuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ3JpZ2h0JywgbWFyZ2luKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuY3NzKCdsZWZ0JywgY2VudGVyTGVmdCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIFxuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRhcnJvdy5kZXRhY2goKTtcbiAgICAgICAgdGhpcy4kd3JhcHBlclxuICAgICAgICAgICAgLmNzcygnaGVpZ2h0JywgJ2F1dG8nKVxuICAgICAgICAgICAgLmNzcygnbGVmdCcsICdhdXRvJylcbiAgICAgICAgICAgIC5jc3MoJ3JpZ2h0JywgJ2F1dG8nKTtcbiAgICB9LFxuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL1Rvb2x0aXAuaGFuZGxlYmFycycpLFxuICAgIGRhdGE6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbXNnOiB0aGlzLm1zZ1xuICAgICAgICB9O1xuICAgIH0sXG4gICAgJGFycm93OiAkKFwiPGRpdiBjbGFzcz0nVG9vbHRpcC1hcnJvdyc+XCIpXG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuc3Vidmlldy1Ub29sdGlwe3Bvc2l0aW9uOmFic29sdXRlO21heC13aWR0aDoxMDAlO21heC1oZWlnaHQ6MTAwJTtvdmVyZmxvdzphdXRvO3otaW5kZXg6MTAwMX0uVG9vbHRpcC1hcnJvd3twb3NpdGlvbjphYnNvbHV0ZTstd2Via2l0LXRyYW5zZm9ybTpyb3RhdGUoNDVkZWcpOy1tb3otdHJhbnNmb3JtOnJvdGF0ZSg0NWRlZyk7LW8tdHJhbnNmb3JtOnJvdGF0ZSg0NWRlZyk7LW1zLXRyYW5zZm9ybTpyb3RhdGUoNDVkZWcpO3RyYW5zZm9ybTpyb3RhdGUoNDVkZWcpO3dpZHRoOjEycHg7aGVpZ2h0OjEycHg7ei1pbmRleDoxMDAwfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIFNsaWRlciA9IHJlcXVpcmUoJy4vVUkvU2xpZGVyL1NsaWRlcicpO1xuXG5yZXF1aXJlKCcuL21haW4ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNsaWRlci5leHRlbmQoJ21haW4nLCB7XG4gICAgbGlzdGVuZXJzOiB7XG4gICAgICAgICdkb3duOm9wZW4nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuc2hvdygnZmlsZXMnKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ2Rvd246bmV3LCBkb3duOm9wZW5GaWxlLCBkb3duOmVkaXQnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuc2hvdygnZWRpdG9yJyk7XG4gICAgICAgIH0sXG4gICAgICAgICdkb3duOnJ1bic6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnNob3coJ3J1bicsIGNhbGxiYWNrKTtcbiAgICAgICAgfSxcbiAgICAgICAgJ3NlbGY6c2xpZGUnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICQoXCI6Zm9jdXNcIikuYmx1cigpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwYW5lbHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogICAgICAgJ2ZpbGVzJyxcbiAgICAgICAgICAgIGNvbnRlbnQ6ICAgIHJlcXVpcmUoJy4vRmlsZXMvRmlsZXMnKVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAgICAgICAnZWRpdG9yJyxcbiAgICAgICAgICAgIGNvbnRlbnQ6ICAgIHJlcXVpcmUoJy4vRWRpdG9yL0VkaXRvcicpXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICAgICAgICdydW4nLFxuICAgICAgICAgICAgY29udGVudDogICAgcmVxdWlyZSgnLi9SdW4vUnVuJylcbiAgICAgICAgfVxuICAgIF0sXG4gICAgZGVmYXVsdFBhbmVsOiAnZmlsZXMnXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcImJvZHksaHRtbHtoZWlnaHQ6MTAwJTt3aWR0aDoxMDAlfWJvZHl7LW1vei11c2VyLXNlbGVjdDpub25lOy1tcy11c2VyLXNlbGVjdDpub25lOy1raHRtbC11c2VyLXNlbGVjdDpub25lOy13ZWJraXQtdXNlci1zZWxlY3Q6bm9uZTstby11c2VyLXNlbGVjdDpub25lO3VzZXItc2VsZWN0Om5vbmU7bWFyZ2luOjA7cG9zaXRpb246YWJzb2x1dGU7Zm9udC1mYW1pbHk6QXZlbmlyLFxcXCJIZWx2ZXRpY2EgTmV1ZVxcXCIsSGVsdmV0aWNhLHNhbnMtc2VyaWY7LXdlYmtpdC10YXAtaGlnaGxpZ2h0LWNvbG9yOnJnYmEoMCwwLDAsMCl9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiXX0=
