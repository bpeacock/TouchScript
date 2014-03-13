(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require("../views/main.js");


},{"../views/main.js":100}],2:[function(require,module,exports){
var Environment = function() {

};

Environment.prototype = {
    clear: function() {
        
    }
};

module.exports = Environment;
},{}],3:[function(require,module,exports){
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
},{"./handlebars/base":4,"./handlebars/exception":5,"./handlebars/runtime":6,"./handlebars/safe-string":7,"./handlebars/utils":8}],4:[function(require,module,exports){
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
},{"./exception":5,"./utils":8}],5:[function(require,module,exports){
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
},{}],6:[function(require,module,exports){
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
},{"./base":4,"./exception":5,"./utils":8}],7:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],8:[function(require,module,exports){
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
},{"./safe-string":7}],9:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime');

},{"./dist/cjs/handlebars.runtime":3}],10:[function(require,module,exports){
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
},{}],11:[function(require,module,exports){
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
        $document.delegate(selector, 'mousedown', callback);
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

module.exports = click;


},{"unopinionate":10}],12:[function(require,module,exports){
module.exports=require(10)
},{}],13:[function(require,module,exports){
var $ = require('unopinionate').selector,
    $document = $(document);

var Drag = function(selector, config) {
    
};

Drag.prototype = {

};

module.exports = Drag;

},{"unopinionate":12}],14:[function(require,module,exports){
var $ = require('unopinionate').selector;

var Drop = function(selector, config) {

};

Drop.prototype = {

};

module.exports = Drop;
},{"unopinionate":12}],15:[function(require,module,exports){
var Drag = require("./Drag"),
    Drop = require("./Drop");

var dropIndex = {};

var drag = function(selector, config) {
    return new Drag(selector, config);
};

drag.drop = function(selector, config) {
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

module.exports = drag;

},{"./Drag":13,"./Drop":14}],16:[function(require,module,exports){
module.exports=require(10)
},{}],17:[function(require,module,exports){
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


},{"./specialKeys":19,"unopinionate":16}],18:[function(require,module,exports){
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

},{}],21:[function(require,module,exports){
//     Underscore.js 1.5.2
//     http://underscorejs.org
//     (c) 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
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
  _.VERSION = '1.5.2';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
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
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    return _.filter(obj, function(value, index, list) {
      return !iterator.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
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
    return _.map(obj, function(value){ return value[key]; });
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs, first) {
    if (_.isEmpty(attrs)) return first ? void 0 : [];
    return _[first ? 'find' : 'filter'](obj, function(value) {
      for (var key in attrs) {
        if (attrs[key] !== value[key]) return false;
      }
      return true;
    });
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.where(obj, attrs, true);
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity, value: -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed > result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity, value: Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
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

  // Sample **n** random values from an array.
  // If **n** is not specified, returns a single random element from the array.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (arguments.length < 2 || guard) {
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    return _.isFunction(value) ? value : function(obj){ return obj[value]; };
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, value, context) {
    var iterator = lookupIterator(value);
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
    return function(obj, value, context) {
      var result = {};
      var iterator = value == null ? _.identity : lookupIterator(value);
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
    (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
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
    iterator = iterator == null ? _.identity : lookupIterator(iterator);
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
    return (n == null) || guard ? array[0] : slice.call(array, 0, n);
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
    if ((n == null) || guard) {
      return array[array.length - 1];
    } else {
      return slice.call(array, Math.max(array.length - n, 0));
    }
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
        return _.indexOf(other, item) >= 0;
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
    var length = _.max(_.pluck(arguments, "length").concat(0));
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
  // arguments pre-filled, without changing its dynamic `this` context.
  _.partial = function(func) {
    var args = slice.call(arguments, 1);
    return function() {
      return func.apply(this, args.concat(slice.call(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error("bindAll must be passed function names");
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
      previous = options.leading === false ? 0 : new Date;
      timeout = null;
      result = func.apply(context, args);
    };
    return function() {
      var now = new Date;
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
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
    return function() {
      context = this;
      args = arguments;
      timestamp = new Date();
      var later = function() {
        var last = (new Date()) - timestamp;
        if (last < wait) {
          timeout = setTimeout(later, wait - last);
        } else {
          timeout = null;
          if (!immediate) result = func.apply(context, args);
        }
      };
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) result = func.apply(context, args);
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
    return function() {
      var args = [func];
      push.apply(args, arguments);
      return wrapper.apply(this, args);
    };
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
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
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
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
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

}).call(this);

},{}],22:[function(require,module,exports){
module.exports=require(10)
},{}],23:[function(require,module,exports){
var log = require("loglevel"),
    _   = require("underscore");

/*** Cache ***/
var statePrefix = "state-",
    stateRegex  = new RegExp("^"+statePrefix, ""),
    noop = function() {},
    stateClassFilter = function(c) {
        return c.match(stateRegex);
    },
    getStateClassRegex = function(key) {
        return new RegExp("^" + statePrefix + key + "-", "");
    };

/*** The Class ***/
var State = function(view, defaults) {
    this.view       = view;
    this.data       = {};
    this.bindings   = {};
    this.listeners  = {};

    this._setDefaults(defaults);
};

State.prototype = {

    /*** Getters & Setters ***/
    set: function(key, value) {
        //Validate
        if(!key.match(/^[a-zA-Z0-9\.]+$/)) {
            log.error("State name '" + key + "' is not alphanumeric.");
        }
        else {
            //Set
            if(this.get(key) != value) {
                this.data[key] = value;
                this.trigger(key, value);

                if(value === true || value === false || (typeof value == 'string' && value.match(/^[a-zA-Z0-9]+$/))) {

                    var classes = this.view._getClasses(),
                        regex   = getStateClassRegex(key),
                        i       = classes.length,
                        defined = false,
                        newState = statePrefix + key + "-" + value;

                    while(i--) {
                        if(classes[i].match(regex)) {
                            if(newState == classes[i])  return this; //Don't do anything if there is no change (efficient!!!)
                            else                        classes[i] = newState;

                            defined = true;
                            break;
                        }
                    }

                    if(!defined) classes.push(newState);
                    this.view._setClasses(classes);
                }
            }
        }

        return this;
    },
    get: function(key) {
        return this.data[key];
    },
    remove: function(key) {
        if(this.get(key)) {
            delete this.data[key];
            this.trigger(key, null);

            var classes = this.view._getClasses(),
                len     = classes.length,
                regex   = getStateClassRegex(key);

            classes = _.reject(classes, function(c) {
                return c.match(regex);
            });

            if(classes.length != len) this.view.wrapper.className = classes.join(' '); //Don't do anything if there is no change (efficient!!!)
        }

        return this;
    },

    /*** Event Bindings ***/
    bind: function(key, callback) {
        this.bindings[key] = callback;
        return callback;
    },
    unbind: function(key) {
        delete this.bindings[key];
        return this;
    },
    trigger: function(key, value) {
        value = value === undefined ? this.get(key) : value;
        (this.bindings[key] || noop)(value);

        //Tell all of the listening children
        var $children = this.view.$wrapper.find('.' + this._listenCssPrefix + this.view.type + '-' + key),
            i = $children.length;

        while(i--) {
            var child = $children[i][subview._domPropertyName];
            child.state._hear(this.view.type, key, value);
        }

        return this;
    },


    /*** Communicatory Get/Set/Bind ***/
    //These methods communicate with the closest parent of the given type
    askParent: function(type, key) {
        var parent = this.view.$wrapper.closest('.'+this.view._viewCssPrefix + type)[0];

        if(parent)  return parent[subview._domPropertyName].state.get(key);
        else        return undefined;
    },
    tellParent: function(type, key, value) {
        var parent = this.view.$wrapper.closest('.'+this.view._viewCssPrefix + type)[0];

        if(parent) parent[subview._domPropertyName].state.set(key, value);
        return this;
    },
    _listenCssPrefix: "listen-",
    listen: function(type, key, callback) {
        var classes = this.view._getClasses();
        classes.push(this._listenCssPrefix+type+"-"+key);
        this.view._setClasses(classes);

        this.listeners[type + '-' + key] = callback;
        return this;
    },
    _hear: function(type, key, value) {
        (this.listeners[type + '-' + key] || noop)(value);
        return this;
    },


    /*** Updates State From DOM Classes ***/
    _setDefaults: function(defaults) {
        var self = this;

        this.defaults   = defaults || this.defaults;
        this.data       = {};

        _.each(
            _.extend(this.defaults, this._getStateClasses()),
            function(value, key) {
                self.set(key, value);
            }
        );

        return this;
    },

    /*** State Class methods ***/
    _getStateClasses: function() {
        var classes = this.view._getClasses(),
            i = classes.length,
            data = {};

        while(i--) {
            var c = classes[i];

            if(c.match(stateRegex)) {
                var parts = c.split('-');
                if(parts.length == 3) {
                    data[parts[1]] = parts[2];
                }
            }
        }

        return data;
    }
};

module.exports = State;


},{"loglevel":20,"underscore":21}],24:[function(require,module,exports){
var _    = require('underscore'),
    log  = require("loglevel");

var View = function() {};

View.prototype = {
    isView: true,

    /*** Default Attributes (should be overwritten) ***/
    tagName:    "div",
    className:  "",
    template:   "",

    //State data gets mapped to classes
    state:      {},

    //Data goes into the templates and may also be a function that returns an object
    data:       {},

    //Subviews are a set of subviews that will be fed into the templating engine
    subviews:   {},

    /*** Initialization Functions (should be configured but will be manipulated when defining the subview) ***/
    config: function(config) { //Runs before render
        for(var i=0; i<this.configFunctions.length; i++) {
            this.configFunctions[i].apply(this, [config]);
        }
    }, 
    configFunctions: [],
    init: function(config) { //Runs after render
        for(var i=0; i<this.initFunctions.length; i++) {
            this.initFunctions[i].apply(this, [config]);
        }
    }, 
    initFunctions: [],
    clean: function() { //Runs on remove
        for(var i=0; i<this.cleanFunctions.length; i++) {
            this.cleanFunctions[i].apply(this, []);
        }
    }, 
    cleanFunctions: [],

    /*** Rendering ***/
    render: function() {
        var self = this,
            html = '',
            postLoad = false;

        //No Templating Engine
        if(typeof this.template == 'string') {
            html = this.template;
        }
        else {
            var data = _.extend(this.state.data, typeof this.data == 'function' ? this.data() : this.data);
            
            //Define the subview variable
            data.subview = {};
            $.each(this.subviews, function(name, subview) {
                if(subview.isViewPool) {
                    data.subview[name] = subview.template;
                }
                else {
                    postLoad = true;
                    data.subview[name] = "<script class='post-load-view' type='text/html' data-name='"+name+"'></script>";
                }
            });

            //Run the templating engine
            if(_.isFunction(this.template)) {
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
            this.$wrapper.find('.post-load-view').each(function() {
                var $this = $(this);
                $this
                    .after(self.subviews[$this.attr('data-name')].$wrapper)
                    .remove();
            });
        }

        return this;
    },
    html: function(html) {
        //Remove & clean subviews in the wrapper 
        this.$wrapper.find('.view').each(function() {
            subview(this).remove();
        });

        this.wrapper.innerHTML = html;

        //Load subviews in the wrapper
        subview.load(this.$wrapper);

        return this;
    },
    remove: function() {
        //Detach
        var parent = this.wrapper.parentNode;
        if(parent) {
            parent.removeChild(this.wrapper);
        }

        //Clean
        this.state.setDefaults();
        this.clean();

        this.pool._release();
        return this;
    },

    /*** State API ***/
    /*set: function(key, value) {
        this.state.set(key, value);
        return this;
    },
    get: function(key) {
        return this.state.get(key);
    },
    bind: function(key, callback) {
        this.state.bind(key, callback);
        return callback;
    },
    unbind: function(key) {
        this.state.unbind(key);
        return this;
    },
    trigger: function(key, value) {
        this.state.trigger(key, value);
        return this;
    },*/
    tellParent: function(type, key, value) {
        this.state.tellParent(type, key, value);
        return this;
    },
    askParent: function(type, key) {
        return this.state.askParent(type, key);
    },
    listen: function(type, key, value) {
        this.state.listen(type, key, value);
        return this;
    },

    /*** Classes ***/
    _viewCssPrefix: 'view-',
    _getClasses: function() {
        return this.wrapper.className.split(/\s+/);
    },
    _setClasses: function(classes) {
        var newClassName = classes.join(' ');
        if(this.wrapper.className != newClassName) this.wrapper.className = newClassName;

        return this;
    },
    _addDefaultClasses: function() {
        var classes = this._getClasses();
        classes.push(this._viewCssPrefix + this.type);

        var superClass = this.super;
        while(true) {
            if(superClass.type) {
                classes.push(this._viewCssPrefix + superClass.type);
                superClass = superClass.super;
            }
            else {
                break;
            }
        }

        //Add Default View Class
        classes.push('view');

        //Add className
        classes = classes.concat(this.className.split(' '));

        this._setClasses(_.uniq(classes));

        return this;
    }
};

module.exports = View;




},{"loglevel":20,"underscore":21}],25:[function(require,module,exports){
var State = require("./State"),
    $     = require("unopinionate").selector;

var ViewPool = function(View) {
    //Configuration
    this.View   = View;
    this.type   = View.prototype.type;
    this.super  = View.prototype.super;
    this.template = "<"+this.View.prototype.tagName+" class='"+this.View.prototype._viewCssPrefix + this.View.prototype.type+" "+this.View.prototype.className+"'></"+this.View.prototype.tagName+">";

    //View Configuration
    this.View.prototype.pool = this;

    //Pool
    this.pool = [];
};

ViewPool.prototype = {
    isViewPool: true,
    spawn: function(el, config) {
        //jQuery normalization
        var $el = el ? (el.jquery ? el : $(el)): null;
        el = el && el.jquery ? el[0] : el;

        //Argument surgery
        if(el && el.view) {
            return el.view;
        }
        else {
            config = config || ($.isPlainObject(el) ? el : undefined);
            
            //Get the DOM node
            if(!el || !el.nodeType) {
                if(this.pool.length !== 0) {
                    return this.pool.pop();
                }
                else {
                    el = document.createElement(this.View.prototype.tagName);
                    $el = $(el);
                }
            }
            
            var view = new this.View();
            el[subview._domPropertyName] = view;
            
            view.wrapper  = el;
            view.$wrapper = $el;
            view._addDefaultClasses();

            //Add view State
            view.state = new State(view, view.state);

            //Render (don't chain since introduces opportunity for user error)
            view.config(config); 
            view.render();
            view.init(config);

            return view;
        }
    },
    extend: function(name, config) {
        return subview(name, this, config);
    },
    destroy: function() {
        this.pool = null;
        delete subview.views[this.type];
    },

    _release: function(view) {
        this.pool.push(view);
        return this;
    }
};

module.exports = ViewPool;

},{"./State":23,"unopinionate":22}],26:[function(require,module,exports){
var _               = require("underscore"),
    log             = require("loglevel"),
    $               = require("unopinionate").selector,
    ViewPool        = require("./ViewPool"),
    ViewTemplate    = require("./View"),
    viewTypeRegex   = new RegExp('^' + ViewTemplate.prototype._viewCssPrefix);

var subview = function(name, protoViewPool, config) {
    var ViewPrototype;

    //Return View object from DOM element
    if(name.nodeType || name.jquery) {
        return (name.jquery ? name[0] : name)[subview._domPropertyName] || null;
    }
    //Define a subview
    else {
        //Argument surgery
        if(protoViewPool && protoViewPool.isViewPool) {
            ViewPrototype = protoViewPool.View;
        }
        else {
            config          = protoViewPool;
            ViewPrototype   = ViewTemplate;
        }

        config = config || {};

        //Validate Name
        if(subview._validateName(name)) {

            //Create the new View
            var View = function() {},
                superClass = new ViewPrototype();

            //Extend the existing init, config & clean functions rather than overwriting them
            _.each(['init', 'config', 'clean'], function(name) {
                config[name+'Functions'] = superClass[name+'Functions'].slice(0); //Clone superClass init
                if(config[name]) {
                    config[name+'Functions'].push(config[name]);
                    delete config[name];
                }
            });

            View.prototype       = _.extend(superClass, config);
            View.prototype.type  = name;
            View.prototype.super = ViewPrototype.prototype;
            
            //Save the New View
            var viewPool = new ViewPool(View);
            subview.views[name] = viewPool;

            return viewPool;
        }
        else {
            return null;
        }
    }
};

subview.views = {};

//Obscure DOM property name for subview wrappers
subview._domPropertyName = "subview12345";

/*** API ***/
subview.load = function(scope) {
    var $scope = scope ? $(scope) : $('body'),
        $views = $scope.find("[class^='view-']"),
        finder = function(c) {
            return c.match(viewTypeRegex);
        };

    for(var i=0; i<$views.length; i++) {
        var el = $views[i],
            classes = el.className.split(/\s+/);

        type =  _.find(classes, finder).replace(viewTypeRegex, '');

        if(type && this.views[type]) {
            this.views[type].spawn($views[i]);
        }
        else {
            log.error("subview '"+type+"' is not defined.");
        }
    }

    return this;
};

subview.lookup = function(name) {
    if(typeof name == 'string') {
        return this.views[name];
    }
    else {
        if(name.isViewPool) {
            return name;
        }
        else if(name.isView) {
            return name.pool;
        }
        else {
            return undefined;
        }
    }
};

subview._validateName = function(name) {
    if(!name.match(/^[a-zA-Z0-9]+$/)) {
        log.error("subview name '" + name + "' is not alphanumeric.");
        return false;
    }

    if(subview.views[name]) {
        log.error("subview '" + name + "' is already defined.");
        return false;
    }

    return true;
};

/*** Export ***/
window.subview = module.exports = subview;

/*** Startup Actions ***/
$(function() {
    if(!subview.noInit) {
        console.log("HERE");
        subview.load();
    }
});



},{"./View":24,"./ViewPool":25,"loglevel":20,"underscore":21,"unopinionate":22}],27:[function(require,module,exports){
var subview     = require('subview'),
    Line        = require('./Line.js'),
    cursor      = require('./cursor'),
    Line        = require('./Line'),
    Environment = require('../../models/Environment');

require('./Block.less');

module.exports = subview('Block', {
    init: function() {
        this.environment = new Environment();
        this.empty();
    },
    empty: function() {
        this.html('');
        var line = Line.spawn();
        this.$wrapper.append(line.$wrapper);

        return this;
    },
    focus: function() {
        subview(this.$wrapper.children().last()).focus();
        return this;
    },
    run: function() {
        //Clear the environment
        this.environment.clear();

        //Run every line
        var children = this.$wrapper.children();
        for(var i=0; i<children.length; i++) {
            subview(children[i]).run();
        }

        return this;
    }
});

},{"../../models/Environment":2,"./Block.less":28,"./Line":33,"./Line.js":33,"./cursor":35,"subview":26}],28:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Block{background:#fff;-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],29:[function(require,module,exports){
var Block = require('./Block');
require('./Editor.less');

module.exports = Block.extend('Editor', {
    init: function() {
        this.focus();
    }
});

},{"./Block":27,"./Editor.less":30}],30:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Editor{overflow:hidden}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],31:[function(require,module,exports){
var subview = require('subview'),
    cursor  = require('./cursor'),
    click   = require('onclick');

require('./Field.less');

$(document).on('mousedown touchstart', '.view-Field', function(e) {
    e.stopPropagation();
    subview(this).focus();
});

module.exports = subview('Field', {
    init: function() {

    },
    dump: function() {

    },
    focus: function() {
        this.$wrapper.append(cursor.$wrapper);
        return this;
    },
    run: function() {
        var stack = [],
            token;

        //Build Stack
        var children = this.$wrapper.children();
        for(var i=0; i<children.length; i++) {
            token = subview(children[i]);

            if(token.isFunction || token.isControl) {
                stack.push(token.run());
            }
            else if(token.isOperator) {
                stack.push(token);
            }
            else if(token.isLiteral) {
                stack.push(token.val());
            }
            else if(token.type != 'Cursor') {
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
                else if(token.isOperator && (typeof token.precedence == 'function' ? token.precedence(stack, i) : token.precedence) == maxPrecedence) {
                    //Operators like NOT that only operate on the token after
                    if(token.isSingleOperator) {
                        stack.splice(i, 2, token.run(stack[i + 1]));
                        i--;
                    }
                    //Standard operators that operate on token before and after
                    else {
                        var prev = stack[i - 1];
                            next = stack[i + 1];

                        if(i === 0) {
                            token.error('No left-side for ' + token.template);
                            return;
                        }
                        else if(i == stack.length - 1) {
                            token.error('No right-side for ' + token.template);
                            return;
                        }
                        else if(prev.isOperator) {
                            token.error('Invalid right-side for ' + token.template);
                        }
                        else if(next.isOperator) {
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
            return stack[0];
        }
    },
    error: function(msg) {
        console.error(msg);
    }
});

},{"./Field.less":32,"./cursor":35,"onclick":11,"subview":26}],32:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],33:[function(require,module,exports){
var Field = require('./Field');

require('./Line.less');

module.exports = Field.extend('Line', {
    
});

},{"./Field":31,"./Line.less":34}],34:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Editor{counter-reset:lineNumber}.view-Line{position:relative;min-height:1.2em;padding-left:30px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.view-Line:before{font-family:Consolas,monaco,monospace;counter-increment:lineNumber;content:counter(lineNumber);position:absolute;height:100%;width:34px;left:-4px;padding-left:8px;padding-top:.1em;background:#F1F0F0;border-right:1px solid #CCC;color:#555;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],35:[function(require,module,exports){
var subview = require('subview');

require('./cursor.less');

var Cursor = subview('Cursor', {
    init: function() {
        var self = this;

        $(document).on('focus', 'input, div', function() {
            self.$wrapper.hide();
        });
    },
    paste: function(type) {
        //Make sure the cursor is shown
        this.$wrapper.show();
        $(':focus').blur();

        //Get the type
        var Type = subview.lookup(type);

        if(!Type) {
            console.error("Type '"+type+"' does not exist");
        }

        //Validate Position
        if(Type.View.prototype.validatePosition(this)) {

            //Paste the function
            var command = Type.spawn();
            
            this.$wrapper.before(command.$wrapper);
            command.focus();
        }
        
        return this;
    },
    error: function(msg) {
        console.error('Cursor: '+msg);
    }
});

module.exports = Cursor.spawn();

},{"./cursor.less":36,"subview":26}],36:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "@-webkit-keyframes flash{0%,100%{opacity:1}50%{opacity:0}}.view-cursor{position:relative;display:inline-block;width:2px;height:1.1em;margin:-.05em -1px;top:.05em;background:#1279FC;-webkit-animation:flash 1s infinite}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],37:[function(require,module,exports){
var subview = require('subview'),
    key     = require('onkey');

require('./Terminal.less');

module.exports = subview("Terminal", {
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

},{"./Terminal.less":38,"onkey":18,"subview":26}],38:[function(require,module,exports){
module.exports=require(32)
},{}],39:[function(require,module,exports){
var Field = require('../Editor/Field');
require('./Argument.less');

module.exports = Field.extend('Argument', {
    init: function(config) {
        this.name = config.name || "";
        this.type = config.type || null;
    },
    template: "\u200B",
    tagName: 'span'
});

},{"../Editor/Field":31,"./Argument.less":40}],40:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Argument{background:#fff;min-width:15px;min-height:1.2em;margin:0 2px;padding:.1em 2px;-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],41:[function(require,module,exports){
var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Editor/Block');

require('./Conditional.less');

module.exports = Control.extend('Conditional', {
    init: function() {
        //Define state variables
        this.conditions = [];
        this.elseCondition = null;

        //Add initial conditional
        this.addCondition('if');
    },
    meta: {
        display: 'if'
    },
    addCondition: function(type) {
        var condition = {
            block: Block.spawn()
        };

        //Build Condition
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
        var $condition = $("<div class='conditional-block'></div>");

        $condition.append(
            type == "else" ? "else:" :
            type == "else if" ? "else if " :
            type == "if" ? "if " : ""
        );
        
        if(type != "else") {
            $condition
                .append(condition.arg.$wrapper)
                .append(" then:");
        }
            
        $condition.append(condition.block.$wrapper);

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
    }
});

},{"../../../Editor/Block":27,"../../Argument":39,"../Control":43,"./Conditional.less":42}],42:[function(require,module,exports){
module.exports=require(32)
},{}],43:[function(require,module,exports){
require('./Control.less');

module.exports = require('../Token').extend('Control', {
    isControl: true,
    
    /*** Should Be Overwritten ***/
    run:    function() {},
    focus:  function() {},

    /*** Functions ***/
    validatePosition: function(cursor) {
        if(subview(cursor.$wrapper.parent()).type == 'Line') {
            return true;
        }
        else {
            cursor.error(this.type + ' must go on its own line.');
            return false;
        }
    }
});

},{"../Token":89,"./Control.less":44}],44:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Control{background:orange;padding:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],45:[function(require,module,exports){
module.exports = [
    require("./Conditional/Conditional")
];
},{"./Conditional/Conditional":41}],46:[function(require,module,exports){
var Argument = require('../Argument'),
    cursor   = require('../../Editor/cursor');

require('./Function.less');

module.exports = require('../Token').extend('Function', {
    isFunction: true,
    init: function() {
        this.$wrapper.append(this.name+"(");

        //Parse Arguments
        var i = this.arguments.length;
        while(i--) {
            var arg = Argument.spawn(this.arguments[i]);
            this.arguments[i] = arg;

            this.$wrapper.append(arg.$wrapper);
            if(i > 0) {
                this.$wrapper.append(", ");
            }
        }
        
        this.$wrapper.append(")");
    },

    /*** Should Be Overwritten ***/
    name: '',
    //Runs when the function is called
    run: function() {
        
    },
    argument: function(i) {
        return this.arguments[i].run();
    },
    arguments: [],
    focus: function() {
        if(this.arguments.length > 0) {
            this.arguments[0].focus();
        }
        else {
            this.$wrapper.after(cursor);
        }
    }
});

},{"../../Editor/cursor":35,"../Argument":39,"../Token":89,"./Function.less":47}],47:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Function{display:inline-block;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;background:#1075F6;margin:2px;padding:3px 5px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],48:[function(require,module,exports){
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
},{"../Function":46,"./Parentheses.less":49}],49:[function(require,module,exports){
module.exports=require(32)
},{}],50:[function(require,module,exports){
var terminal = require('../../../terminal'),
    Func    = require('../Function');

require('./Print.less');

module.exports = Func.extend('print', {
    run: function() {
        terminal.print(this.argument(0));
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

},{"../../../terminal":102,"../Function":46,"./Print.less":51}],51:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Parentheses{color:#747474;background:#FFF9B6}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],52:[function(require,module,exports){
module.exports = [
    require('./Print/Print'),
    require('./Parentheses/Parentheses')
];

},{"./Parentheses/Parentheses":48,"./Print/Print":50}],53:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-False,.view-True{color:#fff;background:#D32CD3}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],54:[function(require,module,exports){
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

},{"../Literal":56,"./Boolean.less":53}],55:[function(require,module,exports){
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

},{"../Literal":56,"./Boolean.less":53}],56:[function(require,module,exports){
require('./Literal.less');

module.exports = require('../Token').extend('Literal', {
    isLiteral: true,
    val: function() {}
});

},{"../Token":89,"./Literal.less":57}],57:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Literal{-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px;padding:0 4px;margin:0 1px;display:inline-block}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],58:[function(require,module,exports){
var Literal = require('../Literal');
require('./Number.less');

module.exports = Literal.extend('Number', {
    init: function() {
        this.$input = this.$wrapper.find('.number-input');
    },
    tagName: 'span',
    meta: {
        display: '123'
    },
    template: "<input type='number' class='number-input'/>",
    focus: function() {
        this.$input.focus();
    },
    clean: function() {
        this.$input.html('');
    },
    val: function() {
        return parseFloat(this.$input.val());
    }
});

},{"../Literal":56,"./Number.less":59}],59:[function(require,module,exports){
module.exports=require(32)
},{}],60:[function(require,module,exports){
var Literal = require('../Literal');
require('./String.less');

module.exports = Literal.extend('String', {
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
    }
});

},{"../Literal":56,"./String.less":61}],61:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-String{color:#000;background:#FFFFA1;padding:0;display:inline}.string-input:focus{outline:0}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],62:[function(require,module,exports){
module.exports = [
    require('./String/String'),
    require('./Number/Number'),
    require('./Booleans/True'),
    require('./Booleans/False')
];

},{"./Booleans/False":54,"./Booleans/True":55,"./Number/Number":58,"./String/String":60}],63:[function(require,module,exports){
module.exports = require('./Boolean').extend('AND', {
    template: "AND",
    run: function(first, second) {
        return first && second;
    }
});

},{"./Boolean":64}],64:[function(require,module,exports){
var Operator = require('../Operator');
require('./Boolean.less');

module.exports = Operator.extend('Boolean', {
    precedence: 0
});
},{"../Operator":86,"./Boolean.less":65}],65:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Boolean{background:#F53939;font-style:italic}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],66:[function(require,module,exports){
module.exports = require('./Boolean').extend('NOT', {
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

},{"./Boolean":64}],67:[function(require,module,exports){
module.exports = require('./Boolean').extend('OR', {
    template: "OR",
    run: function(first, second) {
        return first || second;
    }
});

},{"./Boolean":64}],68:[function(require,module,exports){
module.exports = require('./Boolean').extend('XOR', {
    template: "XOR",
    run: function(first, second) {
        return !first != !second;
    }
});

},{"./Boolean":64}],69:[function(require,module,exports){
module.exports = [
    require('./AND'),
    require('./OR'),
    require('./XOR'),
    require('./NOT')
];

},{"./AND":63,"./NOT":66,"./OR":67,"./XOR":68}],70:[function(require,module,exports){
var Operator = require('../Operator');
require('./Comparator.less');

module.exports = Operator.extend('Comparator', {
    precedence: 1
});
},{"../Operator":86,"./Comparator.less":71}],71:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Comparator{background:#35C062}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],72:[function(require,module,exports){
module.exports = require('./Comparator').extend('Equals', {
    template: "=",
    run: function(first, second) {
        return first == second;
    }
});

},{"./Comparator":70}],73:[function(require,module,exports){
module.exports = require('./Comparator').extend('GreaterThan', {
    template: ">",
    run: function(first, second) {
        return first > second;
    }
});

},{"./Comparator":70}],74:[function(require,module,exports){
module.exports = require('./Comparator').extend('GreaterThanEquals', {
    template: "&ge;",
    run: function(first, second) {
        return first >= second;
    }
});

},{"./Comparator":70}],75:[function(require,module,exports){
module.exports = require('./Comparator').extend('LessThan', {
    template: "<",
    run: function(first, second) {
        return first < second;
    }
});
},{"./Comparator":70}],76:[function(require,module,exports){
module.exports = require('./Comparator').extend('LessThanEquals', {
    template: "&le;",
    run: function(first, second) {
        return first <= second;
    }
});

},{"./Comparator":70}],77:[function(require,module,exports){
module.exports = [
    require('./GreaterThan'),
    require('./GreaterThanEquals'),
    require('./Equals'),
    require('./LessThanEquals'),
    require('./LessThan')
];
},{"./Equals":72,"./GreaterThan":73,"./GreaterThanEquals":74,"./LessThan":75,"./LessThanEquals":76}],78:[function(require,module,exports){
module.exports = require('./Math').extend('Divide', {
    template: "&frasl;",
    precedence: 3,
    run: function(first, second) {
        return first/second;
    }
});

},{"./Math":80}],79:[function(require,module,exports){
module.exports = require('./Math').extend('Exp', {
    template: "^",
    precedence: 4,
    run: Math.pow
});
},{"./Math":80}],80:[function(require,module,exports){
var Operator = require('../Operator');
require('./Math.less');

module.exports = Operator.extend('Math', {
    
});
},{"../Operator":86,"./Math.less":81}],81:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Math{background:#F53939}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],82:[function(require,module,exports){
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

},{"./Math":80}],83:[function(require,module,exports){
module.exports = require('./Math').extend('Multiply', {
    template: "&times;",
    precedence: 3,
    run: function(first, second) {
        return first*second;
    }
});

},{"./Math":80}],84:[function(require,module,exports){
module.exports = require('./Math').extend('Plus', {
    template: "+",
    precedence: 2,
    run: function(first, second) {
        return first + second;
    }
});

},{"./Math":80}],85:[function(require,module,exports){
module.exports = [
    require('./Exp'),
    require('./Divide'),
    require('./Multiply'),
    require('./Minus'),
    require('./Plus')
];

},{"./Divide":78,"./Exp":79,"./Minus":82,"./Multiply":83,"./Plus":84}],86:[function(require,module,exports){
require('./Operator.less');

module.exports = require('../Token').extend('Operator', {
    isOperator: true,
    tagName: 'span'
});

},{"../Token":89,"./Operator.less":87}],87:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Operator{-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;padding:0 4px;margin:0 1px;display:inline-block}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],88:[function(require,module,exports){
module.exports = require('./Comparators/index').concat(
    require('./Math/index'),
    require('./Boolean/index')
);
},{"./Boolean/index":69,"./Comparators/index":77,"./Math/index":85}],89:[function(require,module,exports){
var subview = require('subview'),
    cursor  = require('../Editor/cursor');

require('./Token.less');

module.exports = subview('Token', {
    init: function() {},
    meta: {},
    focus: function() {
        this.$wrapper.after(cursor);
    },
    error: function(msg) {
        console.error(msg);
    },
    validatePosition: function(cursor) {
        return true;
    }
});

},{"../Editor/cursor":35,"./Token.less":90,"subview":26}],90:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Token{color:#FFF}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],91:[function(require,module,exports){
module.exports = require('./Functions/index').concat(
    require('./Literals/index'),
    require('./Operators/index'),
    require('./Control/index')
);
},{"./Control/index":45,"./Functions/index":52,"./Literals/index":62,"./Operators/index":88}],92:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Toolbar-run'>&#9658;</button>";
  });
},{"handlebars/runtime":9}],93:[function(require,module,exports){
var subview = require('subview'),
    click   = require('onclick'),
    editor  = require('../editor'),
    terminal = require('../terminal');

require('./Toolbar.less');

module.exports = subview("Toolbar", {
    init: function() {
        click({
            '.Toolbar-run': function() {
                terminal.clear();
                editor.run();
            }
        });
    },
    template: require('./Toolbar.handlebars')
});

},{"../editor":98,"../terminal":102,"./Toolbar.handlebars":92,"./Toolbar.less":94,"onclick":11,"subview":26}],94:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Toolbar{background:#F1F0F0;border-bottom:solid 1px #CCC;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.Toolbar-run{float:right}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],95:[function(require,module,exports){
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
},{"handlebars/runtime":9}],96:[function(require,module,exports){
var subview = require('subview'),
    buttons = require('../Tokens/index.js'),
    drag    = require('ondrag'),
    click   = require('onclick'),
    cursor  = require('../Editor/cursor');

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
                name: Button.View.prototype.meta.display || Button.View.prototype.template,
                type: Button.type
            });
        }

        return {
            buttons: data
        };
    }
});
},{"../Editor/cursor":35,"../Tokens/index.js":91,"./Tray.handlebars":95,"./Tray.less":97,"onclick":11,"ondrag":15,"subview":26}],97:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Tray{background:#F1F0F0;padding:5px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.Tray-Button{display:inline-block;padding:2px 5px;margin:2px 0;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;background:#1075F6;color:#fff;cursor:pointer}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],98:[function(require,module,exports){
module.exports = require('./Editor/Editor').spawn();

},{"./Editor/Editor":29}],99:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, functionType="function";


  buffer += "<div class='panel panel-edit'>\n    ";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Toolbar)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    ";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.editor)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    ";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Tray)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</div>\n\n<div class='panel panel-run'>\n    ";
  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.terminal)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</div>";
  return buffer;
  });
},{"handlebars/runtime":9}],100:[function(require,module,exports){
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

},{"./Toolbar/Toolbar":93,"./Tray/Tray":96,"./editor":98,"./main.handlebars":99,"./main.less":101,"./terminal":102,"subview":26}],101:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".panel{display:inline-block;position:relative;width:300px;height:400px;vertical-align:top;border:1px solid #DBDBDB}.view-Toolbar{position:absolute;height:30px;width:100%}.view-Editor{position:absolute;bottom:150px;top:30px;width:100%}.view-Tray{position:absolute;height:150px;bottom:0;width:100%}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],102:[function(require,module,exports){
module.exports = require('./Terminal/Terminal').spawn();

},{"./Terminal/Terminal":37}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL2V4YW1wbGVzL2V4YW1wbGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL21vZGVscy9FbnZpcm9ubWVudC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy5ydW50aW1lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2Jhc2UuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvZXhjZXB0aW9uLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3J1bnRpbWUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvc2FmZS1zdHJpbmcuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvdXRpbHMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL3J1bnRpbWUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9vbmNsaWNrL25vZGVfbW9kdWxlcy91bm9waW5pb25hdGUvdW5vcGluaW9uYXRlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvb25jbGljay9zcmMvb25DbGljay5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29uZHJhZy9zcmMvRHJhZy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29uZHJhZy9zcmMvRHJvcC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29uZHJhZy9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29ua2V5L3NyYy9FdmVudC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29ua2V5L3NyYy9tYWluLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvb25rZXkvc3JjL3NwZWNpYWxLZXlzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvc3Vidmlldy9ub2RlX21vZHVsZXMvbG9nbGV2ZWwvbGliL2xvZ2xldmVsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvc3Vidmlldy9ub2RlX21vZHVsZXMvdW5kZXJzY29yZS91bmRlcnNjb3JlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvc3Vidmlldy9zcmMvU3RhdGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9zdWJ2aWV3L3NyYy9WaWV3LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvc3Vidmlldy9zcmMvVmlld1Bvb2wuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9zdWJ2aWV3L3NyYy9tYWluLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvQmxvY2suanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0VkaXRvci9CbG9jay5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvRWRpdG9yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvRWRpdG9yLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0VkaXRvci9GaWVsZC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvRWRpdG9yL0ZpZWxkLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0VkaXRvci9MaW5lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvTGluZS5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvY3Vyc29yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvY3Vyc29yLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rlcm1pbmFsL1Rlcm1pbmFsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvQXJndW1lbnQuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9Bcmd1bWVudC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvQ29udHJvbC9Db25kaXRpb25hbC9Db25kaXRpb25hbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL0NvbnRyb2wvQ29udHJvbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL0NvbnRyb2wvQ29udHJvbC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvQ29udHJvbC9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL0Z1bmN0aW9ucy9GdW5jdGlvbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL0Z1bmN0aW9ucy9GdW5jdGlvbi5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvRnVuY3Rpb25zL1BhcmVudGhlc2VzL1BhcmVudGhlc2VzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvRnVuY3Rpb25zL1ByaW50L1ByaW50LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvRnVuY3Rpb25zL1ByaW50L1ByaW50Lmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9GdW5jdGlvbnMvaW5kZXguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9MaXRlcmFscy9Cb29sZWFucy9Cb29sZWFuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9MaXRlcmFscy9Cb29sZWFucy9GYWxzZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL0xpdGVyYWxzL0Jvb2xlYW5zL1RydWUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9MaXRlcmFscy9MaXRlcmFsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvTGl0ZXJhbHMvTGl0ZXJhbC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvTGl0ZXJhbHMvTnVtYmVyL051bWJlci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL0xpdGVyYWxzL1N0cmluZy9TdHJpbmcuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9MaXRlcmFscy9TdHJpbmcvU3RyaW5nLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9MaXRlcmFscy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL0FORC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL0Jvb2xlYW4uanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9Cb29sZWFuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9OT1QuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9PUi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL1hPUi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvT3BlcmF0b3JzL0NvbXBhcmF0b3JzL0NvbXBhcmF0b3IuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvQ29tcGFyYXRvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvT3BlcmF0b3JzL0NvbXBhcmF0b3JzL0VxdWFscy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9HcmVhdGVyVGhhbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9HcmVhdGVyVGhhbkVxdWFscy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9MZXNzVGhhbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9MZXNzVGhhbkVxdWFscy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9NYXRoL0RpdmlkZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9NYXRoL0V4cC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9NYXRoL01hdGguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9NYXRoLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9NaW51cy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9NYXRoL011bHRpcGx5LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvUGx1cy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL09wZXJhdG9ycy9NYXRoL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvT3BlcmF0b3JzL09wZXJhdG9yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9Ub2tlbnMvT3BlcmF0b3JzL09wZXJhdG9yLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9PcGVyYXRvcnMvaW5kZXguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9Ub2tlbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9rZW5zL1Rva2VuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rva2Vucy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9vbGJhci9Ub29sYmFyLmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1Rvb2xiYXIvVG9vbGJhci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVG9vbGJhci9Ub29sYmFyLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1RyYXkvVHJheS5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9UcmF5L1RyYXkuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1RyYXkvVHJheS5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9lZGl0b3IuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL21haW4uaGFuZGxlYmFycyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvbWFpbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvbWFpbi5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy90ZXJtaW5hbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNXZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZHQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7O0FDQUE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7O0FDQUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBOztBQ0FBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInJlcXVpcmUoXCIuLi92aWV3cy9tYWluLmpzXCIpO1xuXG4iLCJ2YXIgRW52aXJvbm1lbnQgPSBmdW5jdGlvbigpIHtcblxufTtcblxuRW52aXJvbm1lbnQucHJvdG90eXBlID0ge1xuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgXG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFbnZpcm9ubWVudDsiLCJcInVzZSBzdHJpY3RcIjtcbi8qZ2xvYmFscyBIYW5kbGViYXJzOiB0cnVlICovXG52YXIgYmFzZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvYmFzZVwiKTtcblxuLy8gRWFjaCBvZiB0aGVzZSBhdWdtZW50IHRoZSBIYW5kbGViYXJzIG9iamVjdC4gTm8gbmVlZCB0byBzZXR1cCBoZXJlLlxuLy8gKFRoaXMgaXMgZG9uZSB0byBlYXNpbHkgc2hhcmUgY29kZSBiZXR3ZWVuIGNvbW1vbmpzIGFuZCBicm93c2UgZW52cylcbnZhciBTYWZlU3RyaW5nID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9zYWZlLXN0cmluZ1wiKVtcImRlZmF1bHRcIl07XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy91dGlsc1wiKTtcbnZhciBydW50aW1lID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9ydW50aW1lXCIpO1xuXG4vLyBGb3IgY29tcGF0aWJpbGl0eSBhbmQgdXNhZ2Ugb3V0c2lkZSBvZiBtb2R1bGUgc3lzdGVtcywgbWFrZSB0aGUgSGFuZGxlYmFycyBvYmplY3QgYSBuYW1lc3BhY2VcbnZhciBjcmVhdGUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGhiID0gbmV3IGJhc2UuSGFuZGxlYmFyc0Vudmlyb25tZW50KCk7XG5cbiAgVXRpbHMuZXh0ZW5kKGhiLCBiYXNlKTtcbiAgaGIuU2FmZVN0cmluZyA9IFNhZmVTdHJpbmc7XG4gIGhiLkV4Y2VwdGlvbiA9IEV4Y2VwdGlvbjtcbiAgaGIuVXRpbHMgPSBVdGlscztcblxuICBoYi5WTSA9IHJ1bnRpbWU7XG4gIGhiLnRlbXBsYXRlID0gZnVuY3Rpb24oc3BlYykge1xuICAgIHJldHVybiBydW50aW1lLnRlbXBsYXRlKHNwZWMsIGhiKTtcbiAgfTtcblxuICByZXR1cm4gaGI7XG59O1xuXG52YXIgSGFuZGxlYmFycyA9IGNyZWF0ZSgpO1xuSGFuZGxlYmFycy5jcmVhdGUgPSBjcmVhdGU7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gSGFuZGxlYmFyczsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG5cbnZhciBWRVJTSU9OID0gXCIxLjMuMFwiO1xuZXhwb3J0cy5WRVJTSU9OID0gVkVSU0lPTjt2YXIgQ09NUElMRVJfUkVWSVNJT04gPSA0O1xuZXhwb3J0cy5DT01QSUxFUl9SRVZJU0lPTiA9IENPTVBJTEVSX1JFVklTSU9OO1xudmFyIFJFVklTSU9OX0NIQU5HRVMgPSB7XG4gIDE6ICc8PSAxLjAucmMuMicsIC8vIDEuMC5yYy4yIGlzIGFjdHVhbGx5IHJldjIgYnV0IGRvZXNuJ3QgcmVwb3J0IGl0XG4gIDI6ICc9PSAxLjAuMC1yYy4zJyxcbiAgMzogJz09IDEuMC4wLXJjLjQnLFxuICA0OiAnPj0gMS4wLjAnXG59O1xuZXhwb3J0cy5SRVZJU0lPTl9DSEFOR0VTID0gUkVWSVNJT05fQ0hBTkdFUztcbnZhciBpc0FycmF5ID0gVXRpbHMuaXNBcnJheSxcbiAgICBpc0Z1bmN0aW9uID0gVXRpbHMuaXNGdW5jdGlvbixcbiAgICB0b1N0cmluZyA9IFV0aWxzLnRvU3RyaW5nLFxuICAgIG9iamVjdFR5cGUgPSAnW29iamVjdCBPYmplY3RdJztcblxuZnVuY3Rpb24gSGFuZGxlYmFyc0Vudmlyb25tZW50KGhlbHBlcnMsIHBhcnRpYWxzKSB7XG4gIHRoaXMuaGVscGVycyA9IGhlbHBlcnMgfHwge307XG4gIHRoaXMucGFydGlhbHMgPSBwYXJ0aWFscyB8fCB7fTtcblxuICByZWdpc3RlckRlZmF1bHRIZWxwZXJzKHRoaXMpO1xufVxuXG5leHBvcnRzLkhhbmRsZWJhcnNFbnZpcm9ubWVudCA9IEhhbmRsZWJhcnNFbnZpcm9ubWVudDtIYW5kbGViYXJzRW52aXJvbm1lbnQucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogSGFuZGxlYmFyc0Vudmlyb25tZW50LFxuXG4gIGxvZ2dlcjogbG9nZ2VyLFxuICBsb2c6IGxvZyxcblxuICByZWdpc3RlckhlbHBlcjogZnVuY3Rpb24obmFtZSwgZm4sIGludmVyc2UpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChuYW1lKSA9PT0gb2JqZWN0VHlwZSkge1xuICAgICAgaWYgKGludmVyc2UgfHwgZm4pIHsgdGhyb3cgbmV3IEV4Y2VwdGlvbignQXJnIG5vdCBzdXBwb3J0ZWQgd2l0aCBtdWx0aXBsZSBoZWxwZXJzJyk7IH1cbiAgICAgIFV0aWxzLmV4dGVuZCh0aGlzLmhlbHBlcnMsIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaW52ZXJzZSkgeyBmbi5ub3QgPSBpbnZlcnNlOyB9XG4gICAgICB0aGlzLmhlbHBlcnNbbmFtZV0gPSBmbjtcbiAgICB9XG4gIH0sXG5cbiAgcmVnaXN0ZXJQYXJ0aWFsOiBmdW5jdGlvbihuYW1lLCBzdHIpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChuYW1lKSA9PT0gb2JqZWN0VHlwZSkge1xuICAgICAgVXRpbHMuZXh0ZW5kKHRoaXMucGFydGlhbHMsICBuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXJ0aWFsc1tuYW1lXSA9IHN0cjtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyRGVmYXVsdEhlbHBlcnMoaW5zdGFuY2UpIHtcbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2hlbHBlck1pc3NpbmcnLCBmdW5jdGlvbihhcmcpIHtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiTWlzc2luZyBoZWxwZXI6ICdcIiArIGFyZyArIFwiJ1wiKTtcbiAgICB9XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdibG9ja0hlbHBlck1pc3NpbmcnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIGludmVyc2UgPSBvcHRpb25zLmludmVyc2UgfHwgZnVuY3Rpb24oKSB7fSwgZm4gPSBvcHRpb25zLmZuO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oY29udGV4dCkpIHsgY29udGV4dCA9IGNvbnRleHQuY2FsbCh0aGlzKTsgfVxuXG4gICAgaWYoY29udGV4dCA9PT0gdHJ1ZSkge1xuICAgICAgcmV0dXJuIGZuKHRoaXMpO1xuICAgIH0gZWxzZSBpZihjb250ZXh0ID09PSBmYWxzZSB8fCBjb250ZXh0ID09IG51bGwpIHtcbiAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgIH0gZWxzZSBpZiAoaXNBcnJheShjb250ZXh0KSkge1xuICAgICAgaWYoY29udGV4dC5sZW5ndGggPiAwKSB7XG4gICAgICAgIHJldHVybiBpbnN0YW5jZS5oZWxwZXJzLmVhY2goY29udGV4dCwgb3B0aW9ucyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gaW52ZXJzZSh0aGlzKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGZuKGNvbnRleHQpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2VhY2gnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIGZuID0gb3B0aW9ucy5mbiwgaW52ZXJzZSA9IG9wdGlvbnMuaW52ZXJzZTtcbiAgICB2YXIgaSA9IDAsIHJldCA9IFwiXCIsIGRhdGE7XG5cbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZiAob3B0aW9ucy5kYXRhKSB7XG4gICAgICBkYXRhID0gY3JlYXRlRnJhbWUob3B0aW9ucy5kYXRhKTtcbiAgICB9XG5cbiAgICBpZihjb250ZXh0ICYmIHR5cGVvZiBjb250ZXh0ID09PSAnb2JqZWN0Jykge1xuICAgICAgaWYgKGlzQXJyYXkoY29udGV4dCkpIHtcbiAgICAgICAgZm9yKHZhciBqID0gY29udGV4dC5sZW5ndGg7IGk8ajsgaSsrKSB7XG4gICAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIGRhdGEuaW5kZXggPSBpO1xuICAgICAgICAgICAgZGF0YS5maXJzdCA9IChpID09PSAwKTtcbiAgICAgICAgICAgIGRhdGEubGFzdCAgPSAoaSA9PT0gKGNvbnRleHQubGVuZ3RoLTEpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0ID0gcmV0ICsgZm4oY29udGV4dFtpXSwgeyBkYXRhOiBkYXRhIH0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IodmFyIGtleSBpbiBjb250ZXh0KSB7XG4gICAgICAgICAgaWYoY29udGV4dC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBpZihkYXRhKSB7IFxuICAgICAgICAgICAgICBkYXRhLmtleSA9IGtleTsgXG4gICAgICAgICAgICAgIGRhdGEuaW5kZXggPSBpO1xuICAgICAgICAgICAgICBkYXRhLmZpcnN0ID0gKGkgPT09IDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0ID0gcmV0ICsgZm4oY29udGV4dFtrZXldLCB7ZGF0YTogZGF0YX0pO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGkgPT09IDApe1xuICAgICAgcmV0ID0gaW52ZXJzZSh0aGlzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignaWYnLCBmdW5jdGlvbihjb25kaXRpb25hbCwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNvbmRpdGlvbmFsKSkgeyBjb25kaXRpb25hbCA9IGNvbmRpdGlvbmFsLmNhbGwodGhpcyk7IH1cblxuICAgIC8vIERlZmF1bHQgYmVoYXZpb3IgaXMgdG8gcmVuZGVyIHRoZSBwb3NpdGl2ZSBwYXRoIGlmIHRoZSB2YWx1ZSBpcyB0cnV0aHkgYW5kIG5vdCBlbXB0eS5cbiAgICAvLyBUaGUgYGluY2x1ZGVaZXJvYCBvcHRpb24gbWF5IGJlIHNldCB0byB0cmVhdCB0aGUgY29uZHRpb25hbCBhcyBwdXJlbHkgbm90IGVtcHR5IGJhc2VkIG9uIHRoZVxuICAgIC8vIGJlaGF2aW9yIG9mIGlzRW1wdHkuIEVmZmVjdGl2ZWx5IHRoaXMgZGV0ZXJtaW5lcyBpZiAwIGlzIGhhbmRsZWQgYnkgdGhlIHBvc2l0aXZlIHBhdGggb3IgbmVnYXRpdmUuXG4gICAgaWYgKCghb3B0aW9ucy5oYXNoLmluY2x1ZGVaZXJvICYmICFjb25kaXRpb25hbCkgfHwgVXRpbHMuaXNFbXB0eShjb25kaXRpb25hbCkpIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmludmVyc2UodGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBvcHRpb25zLmZuKHRoaXMpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ3VubGVzcycsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnNbJ2lmJ10uY2FsbCh0aGlzLCBjb25kaXRpb25hbCwge2ZuOiBvcHRpb25zLmludmVyc2UsIGludmVyc2U6IG9wdGlvbnMuZm4sIGhhc2g6IG9wdGlvbnMuaGFzaH0pO1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignd2l0aCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZiAoIVV0aWxzLmlzRW1wdHkoY29udGV4dCkpIHJldHVybiBvcHRpb25zLmZuKGNvbnRleHQpO1xuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignbG9nJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIHZhciBsZXZlbCA9IG9wdGlvbnMuZGF0YSAmJiBvcHRpb25zLmRhdGEubGV2ZWwgIT0gbnVsbCA/IHBhcnNlSW50KG9wdGlvbnMuZGF0YS5sZXZlbCwgMTApIDogMTtcbiAgICBpbnN0YW5jZS5sb2cobGV2ZWwsIGNvbnRleHQpO1xuICB9KTtcbn1cblxudmFyIGxvZ2dlciA9IHtcbiAgbWV0aG9kTWFwOiB7IDA6ICdkZWJ1ZycsIDE6ICdpbmZvJywgMjogJ3dhcm4nLCAzOiAnZXJyb3InIH0sXG5cbiAgLy8gU3RhdGUgZW51bVxuICBERUJVRzogMCxcbiAgSU5GTzogMSxcbiAgV0FSTjogMixcbiAgRVJST1I6IDMsXG4gIGxldmVsOiAzLFxuXG4gIC8vIGNhbiBiZSBvdmVycmlkZGVuIGluIHRoZSBob3N0IGVudmlyb25tZW50XG4gIGxvZzogZnVuY3Rpb24obGV2ZWwsIG9iaikge1xuICAgIGlmIChsb2dnZXIubGV2ZWwgPD0gbGV2ZWwpIHtcbiAgICAgIHZhciBtZXRob2QgPSBsb2dnZXIubWV0aG9kTWFwW2xldmVsXTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY29uc29sZVttZXRob2RdKSB7XG4gICAgICAgIGNvbnNvbGVbbWV0aG9kXS5jYWxsKGNvbnNvbGUsIG9iaik7XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuZXhwb3J0cy5sb2dnZXIgPSBsb2dnZXI7XG5mdW5jdGlvbiBsb2cobGV2ZWwsIG9iaikgeyBsb2dnZXIubG9nKGxldmVsLCBvYmopOyB9XG5cbmV4cG9ydHMubG9nID0gbG9nO3ZhciBjcmVhdGVGcmFtZSA9IGZ1bmN0aW9uKG9iamVjdCkge1xuICB2YXIgb2JqID0ge307XG4gIFV0aWxzLmV4dGVuZChvYmosIG9iamVjdCk7XG4gIHJldHVybiBvYmo7XG59O1xuZXhwb3J0cy5jcmVhdGVGcmFtZSA9IGNyZWF0ZUZyYW1lOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgZXJyb3JQcm9wcyA9IFsnZGVzY3JpcHRpb24nLCAnZmlsZU5hbWUnLCAnbGluZU51bWJlcicsICdtZXNzYWdlJywgJ25hbWUnLCAnbnVtYmVyJywgJ3N0YWNrJ107XG5cbmZ1bmN0aW9uIEV4Y2VwdGlvbihtZXNzYWdlLCBub2RlKSB7XG4gIHZhciBsaW5lO1xuICBpZiAobm9kZSAmJiBub2RlLmZpcnN0TGluZSkge1xuICAgIGxpbmUgPSBub2RlLmZpcnN0TGluZTtcblxuICAgIG1lc3NhZ2UgKz0gJyAtICcgKyBsaW5lICsgJzonICsgbm9kZS5maXJzdENvbHVtbjtcbiAgfVxuXG4gIHZhciB0bXAgPSBFcnJvci5wcm90b3R5cGUuY29uc3RydWN0b3IuY2FsbCh0aGlzLCBtZXNzYWdlKTtcblxuICAvLyBVbmZvcnR1bmF0ZWx5IGVycm9ycyBhcmUgbm90IGVudW1lcmFibGUgaW4gQ2hyb21lIChhdCBsZWFzdCksIHNvIGBmb3IgcHJvcCBpbiB0bXBgIGRvZXNuJ3Qgd29yay5cbiAgZm9yICh2YXIgaWR4ID0gMDsgaWR4IDwgZXJyb3JQcm9wcy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgdGhpc1tlcnJvclByb3BzW2lkeF1dID0gdG1wW2Vycm9yUHJvcHNbaWR4XV07XG4gIH1cblxuICBpZiAobGluZSkge1xuICAgIHRoaXMubGluZU51bWJlciA9IGxpbmU7XG4gICAgdGhpcy5jb2x1bW4gPSBub2RlLmZpcnN0Q29sdW1uO1xuICB9XG59XG5cbkV4Y2VwdGlvbi5wcm90b3R5cGUgPSBuZXcgRXJyb3IoKTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBFeGNlcHRpb247IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi91dGlsc1wiKTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xudmFyIENPTVBJTEVSX1JFVklTSU9OID0gcmVxdWlyZShcIi4vYmFzZVwiKS5DT01QSUxFUl9SRVZJU0lPTjtcbnZhciBSRVZJU0lPTl9DSEFOR0VTID0gcmVxdWlyZShcIi4vYmFzZVwiKS5SRVZJU0lPTl9DSEFOR0VTO1xuXG5mdW5jdGlvbiBjaGVja1JldmlzaW9uKGNvbXBpbGVySW5mbykge1xuICB2YXIgY29tcGlsZXJSZXZpc2lvbiA9IGNvbXBpbGVySW5mbyAmJiBjb21waWxlckluZm9bMF0gfHwgMSxcbiAgICAgIGN1cnJlbnRSZXZpc2lvbiA9IENPTVBJTEVSX1JFVklTSU9OO1xuXG4gIGlmIChjb21waWxlclJldmlzaW9uICE9PSBjdXJyZW50UmV2aXNpb24pIHtcbiAgICBpZiAoY29tcGlsZXJSZXZpc2lvbiA8IGN1cnJlbnRSZXZpc2lvbikge1xuICAgICAgdmFyIHJ1bnRpbWVWZXJzaW9ucyA9IFJFVklTSU9OX0NIQU5HRVNbY3VycmVudFJldmlzaW9uXSxcbiAgICAgICAgICBjb21waWxlclZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tjb21waWxlclJldmlzaW9uXTtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUZW1wbGF0ZSB3YXMgcHJlY29tcGlsZWQgd2l0aCBhbiBvbGRlciB2ZXJzaW9uIG9mIEhhbmRsZWJhcnMgdGhhbiB0aGUgY3VycmVudCBydW50aW1lLiBcIitcbiAgICAgICAgICAgIFwiUGxlYXNlIHVwZGF0ZSB5b3VyIHByZWNvbXBpbGVyIHRvIGEgbmV3ZXIgdmVyc2lvbiAoXCIrcnVudGltZVZlcnNpb25zK1wiKSBvciBkb3duZ3JhZGUgeW91ciBydW50aW1lIHRvIGFuIG9sZGVyIHZlcnNpb24gKFwiK2NvbXBpbGVyVmVyc2lvbnMrXCIpLlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVXNlIHRoZSBlbWJlZGRlZCB2ZXJzaW9uIGluZm8gc2luY2UgdGhlIHJ1bnRpbWUgZG9lc24ndCBrbm93IGFib3V0IHRoaXMgcmV2aXNpb24geWV0XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGVtcGxhdGUgd2FzIHByZWNvbXBpbGVkIHdpdGggYSBuZXdlciB2ZXJzaW9uIG9mIEhhbmRsZWJhcnMgdGhhbiB0aGUgY3VycmVudCBydW50aW1lLiBcIitcbiAgICAgICAgICAgIFwiUGxlYXNlIHVwZGF0ZSB5b3VyIHJ1bnRpbWUgdG8gYSBuZXdlciB2ZXJzaW9uIChcIitjb21waWxlckluZm9bMV0rXCIpLlwiKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0cy5jaGVja1JldmlzaW9uID0gY2hlY2tSZXZpc2lvbjsvLyBUT0RPOiBSZW1vdmUgdGhpcyBsaW5lIGFuZCBicmVhayB1cCBjb21waWxlUGFydGlhbFxuXG5mdW5jdGlvbiB0ZW1wbGF0ZSh0ZW1wbGF0ZVNwZWMsIGVudikge1xuICBpZiAoIWVudikge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJObyBlbnZpcm9ubWVudCBwYXNzZWQgdG8gdGVtcGxhdGVcIik7XG4gIH1cblxuICAvLyBOb3RlOiBVc2luZyBlbnYuVk0gcmVmZXJlbmNlcyByYXRoZXIgdGhhbiBsb2NhbCB2YXIgcmVmZXJlbmNlcyB0aHJvdWdob3V0IHRoaXMgc2VjdGlvbiB0byBhbGxvd1xuICAvLyBmb3IgZXh0ZXJuYWwgdXNlcnMgdG8gb3ZlcnJpZGUgdGhlc2UgYXMgcHN1ZWRvLXN1cHBvcnRlZCBBUElzLlxuICB2YXIgaW52b2tlUGFydGlhbFdyYXBwZXIgPSBmdW5jdGlvbihwYXJ0aWFsLCBuYW1lLCBjb250ZXh0LCBoZWxwZXJzLCBwYXJ0aWFscywgZGF0YSkge1xuICAgIHZhciByZXN1bHQgPSBlbnYuVk0uaW52b2tlUGFydGlhbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIGlmIChyZXN1bHQgIT0gbnVsbCkgeyByZXR1cm4gcmVzdWx0OyB9XG5cbiAgICBpZiAoZW52LmNvbXBpbGUpIHtcbiAgICAgIHZhciBvcHRpb25zID0geyBoZWxwZXJzOiBoZWxwZXJzLCBwYXJ0aWFsczogcGFydGlhbHMsIGRhdGE6IGRhdGEgfTtcbiAgICAgIHBhcnRpYWxzW25hbWVdID0gZW52LmNvbXBpbGUocGFydGlhbCwgeyBkYXRhOiBkYXRhICE9PSB1bmRlZmluZWQgfSwgZW52KTtcbiAgICAgIHJldHVybiBwYXJ0aWFsc1tuYW1lXShjb250ZXh0LCBvcHRpb25zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRoZSBwYXJ0aWFsIFwiICsgbmFtZSArIFwiIGNvdWxkIG5vdCBiZSBjb21waWxlZCB3aGVuIHJ1bm5pbmcgaW4gcnVudGltZS1vbmx5IG1vZGVcIik7XG4gICAgfVxuICB9O1xuXG4gIC8vIEp1c3QgYWRkIHdhdGVyXG4gIHZhciBjb250YWluZXIgPSB7XG4gICAgZXNjYXBlRXhwcmVzc2lvbjogVXRpbHMuZXNjYXBlRXhwcmVzc2lvbixcbiAgICBpbnZva2VQYXJ0aWFsOiBpbnZva2VQYXJ0aWFsV3JhcHBlcixcbiAgICBwcm9ncmFtczogW10sXG4gICAgcHJvZ3JhbTogZnVuY3Rpb24oaSwgZm4sIGRhdGEpIHtcbiAgICAgIHZhciBwcm9ncmFtV3JhcHBlciA9IHRoaXMucHJvZ3JhbXNbaV07XG4gICAgICBpZihkYXRhKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gcHJvZ3JhbShpLCBmbiwgZGF0YSk7XG4gICAgICB9IGVsc2UgaWYgKCFwcm9ncmFtV3JhcHBlcikge1xuICAgICAgICBwcm9ncmFtV3JhcHBlciA9IHRoaXMucHJvZ3JhbXNbaV0gPSBwcm9ncmFtKGksIGZuKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcm9ncmFtV3JhcHBlcjtcbiAgICB9LFxuICAgIG1lcmdlOiBmdW5jdGlvbihwYXJhbSwgY29tbW9uKSB7XG4gICAgICB2YXIgcmV0ID0gcGFyYW0gfHwgY29tbW9uO1xuXG4gICAgICBpZiAocGFyYW0gJiYgY29tbW9uICYmIChwYXJhbSAhPT0gY29tbW9uKSkge1xuICAgICAgICByZXQgPSB7fTtcbiAgICAgICAgVXRpbHMuZXh0ZW5kKHJldCwgY29tbW9uKTtcbiAgICAgICAgVXRpbHMuZXh0ZW5kKHJldCwgcGFyYW0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9LFxuICAgIHByb2dyYW1XaXRoRGVwdGg6IGVudi5WTS5wcm9ncmFtV2l0aERlcHRoLFxuICAgIG5vb3A6IGVudi5WTS5ub29wLFxuICAgIGNvbXBpbGVySW5mbzogbnVsbFxuICB9O1xuXG4gIHJldHVybiBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdmFyIG5hbWVzcGFjZSA9IG9wdGlvbnMucGFydGlhbCA/IG9wdGlvbnMgOiBlbnYsXG4gICAgICAgIGhlbHBlcnMsXG4gICAgICAgIHBhcnRpYWxzO1xuXG4gICAgaWYgKCFvcHRpb25zLnBhcnRpYWwpIHtcbiAgICAgIGhlbHBlcnMgPSBvcHRpb25zLmhlbHBlcnM7XG4gICAgICBwYXJ0aWFscyA9IG9wdGlvbnMucGFydGlhbHM7XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSB0ZW1wbGF0ZVNwZWMuY2FsbChcbiAgICAgICAgICBjb250YWluZXIsXG4gICAgICAgICAgbmFtZXNwYWNlLCBjb250ZXh0LFxuICAgICAgICAgIGhlbHBlcnMsXG4gICAgICAgICAgcGFydGlhbHMsXG4gICAgICAgICAgb3B0aW9ucy5kYXRhKTtcblxuICAgIGlmICghb3B0aW9ucy5wYXJ0aWFsKSB7XG4gICAgICBlbnYuVk0uY2hlY2tSZXZpc2lvbihjb250YWluZXIuY29tcGlsZXJJbmZvKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xufVxuXG5leHBvcnRzLnRlbXBsYXRlID0gdGVtcGxhdGU7ZnVuY3Rpb24gcHJvZ3JhbVdpdGhEZXB0aChpLCBmbiwgZGF0YSAvKiwgJGRlcHRoICovKSB7XG4gIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAzKTtcblxuICB2YXIgcHJvZyA9IGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBbY29udGV4dCwgb3B0aW9ucy5kYXRhIHx8IGRhdGFdLmNvbmNhdChhcmdzKSk7XG4gIH07XG4gIHByb2cucHJvZ3JhbSA9IGk7XG4gIHByb2cuZGVwdGggPSBhcmdzLmxlbmd0aDtcbiAgcmV0dXJuIHByb2c7XG59XG5cbmV4cG9ydHMucHJvZ3JhbVdpdGhEZXB0aCA9IHByb2dyYW1XaXRoRGVwdGg7ZnVuY3Rpb24gcHJvZ3JhbShpLCBmbiwgZGF0YSkge1xuICB2YXIgcHJvZyA9IGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIHJldHVybiBmbihjb250ZXh0LCBvcHRpb25zLmRhdGEgfHwgZGF0YSk7XG4gIH07XG4gIHByb2cucHJvZ3JhbSA9IGk7XG4gIHByb2cuZGVwdGggPSAwO1xuICByZXR1cm4gcHJvZztcbn1cblxuZXhwb3J0cy5wcm9ncmFtID0gcHJvZ3JhbTtmdW5jdGlvbiBpbnZva2VQYXJ0aWFsKHBhcnRpYWwsIG5hbWUsIGNvbnRleHQsIGhlbHBlcnMsIHBhcnRpYWxzLCBkYXRhKSB7XG4gIHZhciBvcHRpb25zID0geyBwYXJ0aWFsOiB0cnVlLCBoZWxwZXJzOiBoZWxwZXJzLCBwYXJ0aWFsczogcGFydGlhbHMsIGRhdGE6IGRhdGEgfTtcblxuICBpZihwYXJ0aWFsID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGhlIHBhcnRpYWwgXCIgKyBuYW1lICsgXCIgY291bGQgbm90IGJlIGZvdW5kXCIpO1xuICB9IGVsc2UgaWYocGFydGlhbCBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgcmV0dXJuIHBhcnRpYWwoY29udGV4dCwgb3B0aW9ucyk7XG4gIH1cbn1cblxuZXhwb3J0cy5pbnZva2VQYXJ0aWFsID0gaW52b2tlUGFydGlhbDtmdW5jdGlvbiBub29wKCkgeyByZXR1cm4gXCJcIjsgfVxuXG5leHBvcnRzLm5vb3AgPSBub29wOyIsIlwidXNlIHN0cmljdFwiO1xuLy8gQnVpbGQgb3V0IG91ciBiYXNpYyBTYWZlU3RyaW5nIHR5cGVcbmZ1bmN0aW9uIFNhZmVTdHJpbmcoc3RyaW5nKSB7XG4gIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xufVxuXG5TYWZlU3RyaW5nLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gXCJcIiArIHRoaXMuc3RyaW5nO1xufTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBTYWZlU3RyaW5nOyIsIlwidXNlIHN0cmljdFwiO1xuLypqc2hpbnQgLVcwMDQgKi9cbnZhciBTYWZlU3RyaW5nID0gcmVxdWlyZShcIi4vc2FmZS1zdHJpbmdcIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgZXNjYXBlID0ge1xuICBcIiZcIjogXCImYW1wO1wiLFxuICBcIjxcIjogXCImbHQ7XCIsXG4gIFwiPlwiOiBcIiZndDtcIixcbiAgJ1wiJzogXCImcXVvdDtcIixcbiAgXCInXCI6IFwiJiN4Mjc7XCIsXG4gIFwiYFwiOiBcIiYjeDYwO1wiXG59O1xuXG52YXIgYmFkQ2hhcnMgPSAvWyY8PlwiJ2BdL2c7XG52YXIgcG9zc2libGUgPSAvWyY8PlwiJ2BdLztcblxuZnVuY3Rpb24gZXNjYXBlQ2hhcihjaHIpIHtcbiAgcmV0dXJuIGVzY2FwZVtjaHJdIHx8IFwiJmFtcDtcIjtcbn1cblxuZnVuY3Rpb24gZXh0ZW5kKG9iaiwgdmFsdWUpIHtcbiAgZm9yKHZhciBrZXkgaW4gdmFsdWUpIHtcbiAgICBpZihPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIGtleSkpIHtcbiAgICAgIG9ialtrZXldID0gdmFsdWVba2V5XTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0cy5leHRlbmQgPSBleHRlbmQ7dmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbmV4cG9ydHMudG9TdHJpbmcgPSB0b1N0cmluZztcbi8vIFNvdXJjZWQgZnJvbSBsb2Rhc2hcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXN0aWVqcy9sb2Rhc2gvYmxvYi9tYXN0ZXIvTElDRU5TRS50eHRcbnZhciBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbn07XG4vLyBmYWxsYmFjayBmb3Igb2xkZXIgdmVyc2lvbnMgb2YgQ2hyb21lIGFuZCBTYWZhcmlcbmlmIChpc0Z1bmN0aW9uKC94LykpIHtcbiAgaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbiAgfTtcbn1cbnZhciBpc0Z1bmN0aW9uO1xuZXhwb3J0cy5pc0Z1bmN0aW9uID0gaXNGdW5jdGlvbjtcbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpID8gdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT09ICdbb2JqZWN0IEFycmF5XScgOiBmYWxzZTtcbn07XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBlc2NhcGVFeHByZXNzaW9uKHN0cmluZykge1xuICAvLyBkb24ndCBlc2NhcGUgU2FmZVN0cmluZ3MsIHNpbmNlIHRoZXkncmUgYWxyZWFkeSBzYWZlXG4gIGlmIChzdHJpbmcgaW5zdGFuY2VvZiBTYWZlU3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy50b1N0cmluZygpO1xuICB9IGVsc2UgaWYgKCFzdHJpbmcgJiYgc3RyaW5nICE9PSAwKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICAvLyBGb3JjZSBhIHN0cmluZyBjb252ZXJzaW9uIGFzIHRoaXMgd2lsbCBiZSBkb25lIGJ5IHRoZSBhcHBlbmQgcmVnYXJkbGVzcyBhbmRcbiAgLy8gdGhlIHJlZ2V4IHRlc3Qgd2lsbCBkbyB0aGlzIHRyYW5zcGFyZW50bHkgYmVoaW5kIHRoZSBzY2VuZXMsIGNhdXNpbmcgaXNzdWVzIGlmXG4gIC8vIGFuIG9iamVjdCdzIHRvIHN0cmluZyBoYXMgZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGl0LlxuICBzdHJpbmcgPSBcIlwiICsgc3RyaW5nO1xuXG4gIGlmKCFwb3NzaWJsZS50ZXN0KHN0cmluZykpIHsgcmV0dXJuIHN0cmluZzsgfVxuICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoYmFkQ2hhcnMsIGVzY2FwZUNoYXIpO1xufVxuXG5leHBvcnRzLmVzY2FwZUV4cHJlc3Npb24gPSBlc2NhcGVFeHByZXNzaW9uO2Z1bmN0aW9uIGlzRW1wdHkodmFsdWUpIHtcbiAgaWYgKCF2YWx1ZSAmJiB2YWx1ZSAhPT0gMCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2UgaWYgKGlzQXJyYXkodmFsdWUpICYmIHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5leHBvcnRzLmlzRW1wdHkgPSBpc0VtcHR5OyIsIi8vIENyZWF0ZSBhIHNpbXBsZSBwYXRoIGFsaWFzIHRvIGFsbG93IGJyb3dzZXJpZnkgdG8gcmVzb2x2ZVxuLy8gdGhlIHJ1bnRpbWUgb24gYSBzdXBwb3J0ZWQgcGF0aC5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9kaXN0L2Nqcy9oYW5kbGViYXJzLnJ1bnRpbWUnKTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbihmdW5jdGlvbihyb290KSB7XG4gICAgdmFyIHVub3BpbmlvbmF0ZSA9IHtcbiAgICAgICAgc2VsZWN0b3I6IHJvb3QualF1ZXJ5IHx8IHJvb3QuWmVwdG8gfHwgcm9vdC5lbmRlciB8fCByb290LiQsXG4gICAgICAgIHRlbXBsYXRlOiByb290LkhhbmRsZWJhcnMgfHwgcm9vdC5NdXN0YWNoZVxuICAgIH07XG5cbiAgICAvKioqIEV4cG9ydCAqKiovXG5cbiAgICAvL0FNRFxuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIHVub3BpbmlvbmF0ZTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vQ29tbW9uSlNcbiAgICBlbHNlIGlmKHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSB1bm9waW5pb25hdGU7XG4gICAgfVxuICAgIC8vR2xvYmFsXG4gICAgZWxzZSB7XG4gICAgICAgIHJvb3QudW5vcGluaW9uYXRlID0gdW5vcGluaW9uYXRlO1xuICAgIH1cbn0pKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiBnbG9iYWwpO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsInZhciAkID0gcmVxdWlyZSgndW5vcGluaW9uYXRlJykuc2VsZWN0b3I7XG5cbnZhciAkZG9jdW1lbnQgICA9ICQoZG9jdW1lbnQpLFxuICAgIGJpbmRpbmdzICAgID0ge307XG5cbnZhciBjbGljayA9IGZ1bmN0aW9uKGV2ZW50cykge1xuICAgIGNsaWNrLmJpbmQuYXBwbHkoY2xpY2ssIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIGNsaWNrO1xufTtcblxuLyoqKiBDb25maWd1cmF0aW9uIE9wdGlvbnMgKioqL1xuY2xpY2suZGlzdGFuY2VMaW1pdCA9IDEwO1xuY2xpY2sudGltZUxpbWl0ICAgICA9IDE0MDtcblxuLyoqKiBVc2VmdWwgUHJvcGVydGllcyAqKiovXG5jbGljay5pc1RvdWNoID0gKCdvbnRvdWNoc3RhcnQnIGluIHdpbmRvdykgfHxcbiAgICAgICAgICAgICAgICB3aW5kb3cuRG9jdW1lbnRUb3VjaCAmJlxuICAgICAgICAgICAgICAgIGRvY3VtZW50IGluc3RhbmNlb2YgRG9jdW1lbnRUb3VjaDtcblxuLyoqKiBDYWNoZWQgRnVuY3Rpb25zICoqKi9cbnZhciBvblRvdWNoc3RhcnQgPSBmdW5jdGlvbihlKSB7XG4gICAgdmFyICR0aGlzICAgICAgID0gJCh0aGlzKSxcbiAgICAgICAgc3RhcnRUaW1lICAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSxcbiAgICAgICAgc3RhcnRQb3MgICAgPSBjbGljay5fZ2V0UG9zKGUpO1xuXG4gICAgJHRoaXMub25lKCd0b3VjaGVuZCcsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpOyAvL1ByZXZlbnRzIGNsaWNrIGV2ZW50IGZyb20gZmlyaW5nXG4gICAgICAgIFxuICAgICAgICB2YXIgdGltZSAgICAgICAgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHN0YXJ0VGltZSxcbiAgICAgICAgICAgIGVuZFBvcyAgICAgID0gY2xpY2suX2dldFBvcyhlKSxcbiAgICAgICAgICAgIGRpc3RhbmNlICAgID0gTWF0aC5zcXJ0KFxuICAgICAgICAgICAgICAgIE1hdGgucG93KGVuZFBvcy54IC0gc3RhcnRQb3MueCwgMikgK1xuICAgICAgICAgICAgICAgIE1hdGgucG93KGVuZFBvcy55IC0gc3RhcnRQb3MueSwgMilcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgaWYodGltZSA8IGNsaWNrLnRpbWVMaW1pdCAmJiBkaXN0YW5jZSA8IGNsaWNrLmRpc3RhbmNlTGltaXQpIHtcbiAgICAgICAgICAgIC8vRmluZCB0aGUgY29ycmVjdCBjYWxsYmFja1xuICAgICAgICAgICAgJC5lYWNoKGJpbmRpbmdzLCBmdW5jdGlvbihzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZigkdGhpcy5pcyhzZWxlY3RvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkoZS50YXJnZXQsIFtlXSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqKiBBUEkgKioqL1xuY2xpY2suYmluZCA9IGZ1bmN0aW9uKGV2ZW50cykge1xuXG4gICAgLy9Bcmd1bWVudCBTdXJnZXJ5XG4gICAgaWYoISQuaXNQbGFpbk9iamVjdChldmVudHMpKSB7XG4gICAgICAgIG5ld0V2ZW50cyA9IHt9O1xuICAgICAgICBuZXdFdmVudHNbYXJndW1lbnRzWzBdXSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgZXZlbnRzID0gbmV3RXZlbnRzO1xuICAgIH1cblxuICAgICQuZWFjaChldmVudHMsIGZ1bmN0aW9uKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuXG4gICAgICAgIC8qKiogUmVnaXN0ZXIgQmluZGluZyAqKiovXG4gICAgICAgIGlmKHR5cGVvZiBiaW5kaW5nc1tzZWxlY3Rvcl0gIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNsaWNrLnVuYmluZChzZWxlY3Rvcik7IC8vRW5zdXJlIG5vIGR1cGxpY2F0ZXNcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgYmluZGluZ3Nbc2VsZWN0b3JdID0gY2FsbGJhY2s7XG5cbiAgICAgICAgLyoqKiBUb3VjaCBTdXBwb3J0ICoqKi9cbiAgICAgICAgaWYoY2xpY2suaXNUb3VjaCkge1xuICAgICAgICAgICAgJGRvY3VtZW50LmRlbGVnYXRlKHNlbGVjdG9yLCAndG91Y2hzdGFydCcsIG9uVG91Y2hzdGFydCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKioqIE1vdXNlIFN1cHBvcnQgKioqL1xuICAgICAgICAkZG9jdW1lbnQuZGVsZWdhdGUoc2VsZWN0b3IsICdtb3VzZWRvd24nLCBjYWxsYmFjayk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbmNsaWNrLnVuYmluZCA9IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgJGRvY3VtZW50XG4gICAgICAgIC51bmRlbGVnYXRlKHNlbGVjdG9yLCAndG91Y2hzdGFydCcpXG4gICAgICAgIC51bmRlbGVnYXRlKHNlbGVjdG9yLCAnY2xpY2snKTtcblxuICAgIGRlbGV0ZSBiaW5kaW5nc1tzZWxlY3Rvcl07XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbmNsaWNrLnVuYmluZEFsbCA9IGZ1bmN0aW9uKCkge1xuICAgICQuZWFjaChiaW5kaW5ncywgZnVuY3Rpb24oc2VsZWN0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgICRkb2N1bWVudFxuICAgICAgICAgICAgLnVuZGVsZWdhdGUoc2VsZWN0b3IsICd0b3VjaHN0YXJ0JylcbiAgICAgICAgICAgIC51bmRlbGVnYXRlKHNlbGVjdG9yLCAnY2xpY2snKTtcbiAgICB9KTtcbiAgICBcbiAgICBiaW5kaW5ncyA9IHt9O1xuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5jbGljay50cmlnZ2VyID0gZnVuY3Rpb24oc2VsZWN0b3IsIGUpIHtcbiAgICBlID0gZSB8fCAkLkV2ZW50KCdjbGljaycpO1xuXG4gICAgaWYodHlwZW9mIGJpbmRpbmdzW3NlbGVjdG9yXSAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICBiaW5kaW5nc1tzZWxlY3Rvcl0oZSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiTm8gY2xpY2sgZXZlbnRzIGJvdW5kIGZvciBzZWxlY3RvciAnXCIrc2VsZWN0b3IrXCInLlwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKiogSW50ZXJuYWwgKGJ1dCB1c2VmdWwpIE1ldGhvZHMgKioqL1xuY2xpY2suX2dldFBvcyA9IGZ1bmN0aW9uKGUpIHtcbiAgICBlID0gZS5vcmlnaW5hbEV2ZW50O1xuXG4gICAgaWYoZS5wYWdlWCB8fCBlLnBhZ2VZKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBlLnBhZ2VYLFxuICAgICAgICAgICAgeTogZS5wYWdlWVxuICAgICAgICB9O1xuICAgIH1cbiAgICBlbHNlIGlmKGUuY2hhbmdlZFRvdWNoZXMpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WCxcbiAgICAgICAgICAgIHk6IGUuY2hhbmdlZFRvdWNoZXNbMF0uY2xpZW50WVxuICAgICAgICB9O1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IGUuY2xpZW50WCArIGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdCArIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0LFxuICAgICAgICAgICAgeTogZS5jbGllbnRZICsgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgICsgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcFxuICAgICAgICB9O1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gY2xpY2s7XG5cbiIsInZhciAkID0gcmVxdWlyZSgndW5vcGluaW9uYXRlJykuc2VsZWN0b3IsXG4gICAgJGRvY3VtZW50ID0gJChkb2N1bWVudCk7XG5cbnZhciBEcmFnID0gZnVuY3Rpb24oc2VsZWN0b3IsIGNvbmZpZykge1xuICAgIFxufTtcblxuRHJhZy5wcm90b3R5cGUgPSB7XG5cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRHJhZztcbiIsInZhciAkID0gcmVxdWlyZSgndW5vcGluaW9uYXRlJykuc2VsZWN0b3I7XG5cbnZhciBEcm9wID0gZnVuY3Rpb24oc2VsZWN0b3IsIGNvbmZpZykge1xuXG59O1xuXG5Ecm9wLnByb3RvdHlwZSA9IHtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEcm9wOyIsInZhciBEcmFnID0gcmVxdWlyZShcIi4vRHJhZ1wiKSxcbiAgICBEcm9wID0gcmVxdWlyZShcIi4vRHJvcFwiKTtcblxudmFyIGRyb3BJbmRleCA9IHt9O1xuXG52YXIgZHJhZyA9IGZ1bmN0aW9uKHNlbGVjdG9yLCBjb25maWcpIHtcbiAgICByZXR1cm4gbmV3IERyYWcoc2VsZWN0b3IsIGNvbmZpZyk7XG59O1xuXG5kcmFnLmRyb3AgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG4gICAgdmFyIGRyb3AgPSBuZXcgRHJvcChzZWxlY3RvciwgY29uZmlnKTtcblxuICAgIC8vZHJvcCBpbmRleGluZ1xuICAgIHZhciBhZGRUb0luZGV4ID0gZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBpZih0eXBlb2YgZHJvcEluZGV4W25hbWVdID09ICd1bmRlZmluZWQnKSBkcm9wSW5kZXhbbmFtZV0gPSBbZHJvcF07XG4gICAgICAgIGVsc2UgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyb3BJbmRleFtuYW1lXS5wdXNoKGRyb3ApO1xuICAgIH07XG5cbiAgICBpZighY29uZmlnLnRhZykge1xuICAgICAgICBhZGRUb0luZGV4KCcnKTtcbiAgICB9XG4gICAgZWxzZSBpZih0eXBlb2YgY29uZmlnLnRhZyA9PSAnU3RyaW5nJykge1xuICAgICAgICBhZGRUb0luZGV4KGNvbmZpZy50YWcpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdmFyIGkgPSBjb25maWcudGFnLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICBhZGRUb0luZGV4KGNvbmZpZy50YWdbaV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGRyb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRyYWc7XG4iLCJ2YXIgJCA9IHJlcXVpcmUoJ3Vub3BpbmlvbmF0ZScpLnNlbGVjdG9yLFxuICAgICAgICBzcGVjaWFsS2V5cyA9IHJlcXVpcmUoJy4vc3BlY2lhbEtleXMnKTtcblxudmFyICR3aW5kb3cgPSAkKHdpbmRvdyk7XG5cbnZhciBFdmVudCA9IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgdGhpcy5zZWxlY3RvciAgID0gc2VsZWN0b3I7XG4gICAgdGhpcy4kc2NvcGUgICAgID0gc2VsZWN0b3IgPyAkKHNlbGVjdG9yKSA6ICR3aW5kb3c7XG4gICAgdGhpcy5jYWxsYmFja3MgID0gW107XG4gICAgdGhpcy5hY3RpdmUgICAgID0gdHJ1ZTtcbn07XG5cbkV2ZW50LnByb3RvdHlwZSA9IHtcbiAgICB1cDogZnVuY3Rpb24oZXZlbnRzKSB7XG4gICAgICAgIHRoaXMuYmluZCgndXAnLCBldmVudHMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGRvd246IGZ1bmN0aW9uKGV2ZW50cykge1xuICAgICAgICB0aGlzLmJpbmQoJ2Rvd24nLCBldmVudHMpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGJpbmQ6IGZ1bmN0aW9uKHR5cGUsIGV2ZW50cykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgaWYoJC5pc1BsYWluT2JqZWN0KGV2ZW50cykpIHtcbiAgICAgICAgICAgICQuZWFjaChldmVudHMsIGZ1bmN0aW9uKGtleSwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9hZGQodHlwZSwga2V5LCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZCh0eXBlLCBmYWxzZSwgZXZlbnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgb246IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmFjdGl2ZSA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgb2ZmOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5hY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kc2NvcGVcbiAgICAgICAgICAgIC51bmJpbmQoJ2tleWRvd24nKVxuICAgICAgICAgICAgLnVuYmluZCgna2V5dXAnKTtcbiAgICB9LFxuXG4gICAgLyoqKiBJbnRlcm5hbCBGdW5jdGlvbnMgKioqL1xuICAgIF9hZGQ6IGZ1bmN0aW9uKHR5cGUsIGNvbmRpdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBpZighdGhpcy5jYWxsYmFja3NbdHlwZV0pIHtcbiAgICAgICAgICAgIHRoaXMuY2FsbGJhY2tzW3R5cGVdID0gW107XG5cbiAgICAgICAgICAgIHRoaXMuJHNjb3BlLmJpbmQoJ2tleScgKyB0eXBlLCBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgaWYoc2VsZi5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNhbGxiYWNrcyA9IHNlbGYuY2FsbGJhY2tzW3R5cGVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvcih2YXIgaT0wOyBpPGNhbGxiYWNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGNhbGxiYWNrID0gY2FsbGJhY2tzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIWNhbGxiYWNrLmNvbmRpdGlvbnMgfHwgc2VsZi5fdmFsaWRhdGUoY2FsbGJhY2suY29uZGl0aW9ucywgZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoY29uZGl0aW9ucykge1xuICAgICAgICAgICAgY2FsbGJhY2suY29uZGl0aW9ucyA9IHRoaXMuX3BhcnNlQ29uZGl0aW9ucyhjb25kaXRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2FsbGJhY2tzW3R5cGVdLnB1c2goY2FsbGJhY2spO1xuICAgIH0sXG4gICAgX3BhcnNlQ29uZGl0aW9uczogZnVuY3Rpb24oYykge1xuICAgICAgICB2YXIgY29uZGl0aW9ucyA9IHtcbiAgICAgICAgICAgIHNoaWZ0OiAgIC9cXGJzaGlmdFxcYi9pLnRlc3QoYyksXG4gICAgICAgICAgICBhbHQ6ICAgICAvXFxiKGFsdHxhbHRlcm5hdGUpXFxiL2kudGVzdChjKSxcbiAgICAgICAgICAgIGN0cmw6ICAgIC9cXGIoY3RybHxjb250cm9sfGNtZHxjb21tYW5kKVxcYi9pLnRlc3QoYylcbiAgICAgICAgfTtcblxuICAgICAgICAvL0tleSBCaW5kaW5nXG4gICAgICAgIHZhciBrZXlzID0gYy5tYXRjaCgvXFxiKD8hc2hpZnR8YWx0fGFsdGVybmF0ZXxjdHJsfGNvbnRyb2x8Y21kfGNvbW1hbmQpKFxcdyspXFxiL2dpKTtcblxuICAgICAgICBpZigha2V5cykge1xuICAgICAgICAgICAgLy9Vc2UgbW9kaWZpZXIgYXMga2V5IGlmIHRoZXJlIGlzIG5vIG90aGVyIGtleVxuICAgICAgICAgICAga2V5cyA9IGMubWF0Y2goL1xcYihcXHcrKVxcYi9naSk7XG5cbiAgICAgICAgICAgIC8vTW9kaWZpZXJzIHNob3VsZCBhbGwgYmUgZmFsc2VcbiAgICAgICAgICAgIGNvbmRpdGlvbnMuc2hpZnQgPVxuICAgICAgICAgICAgY29uZGl0aW9ucy5hbHQgICA9XG4gICAgICAgICAgICBjb25kaXRpb25zLmN0cmwgID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZihrZXlzKSB7XG4gICAgICAgICAgICBjb25kaXRpb25zLmtleSA9IGtleXNbMF07XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmKGtleXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIk1vcmUgdGhhbiBvbmUga2V5IGJvdW5kIGluICdcIitjK1wiJy4gVXNpbmcgdGhlIGZpcnN0IG9uZSAoXCIra2V5c1swXStcIikuXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uZGl0aW9ucy5rZXkgICAgICA9IG51bGw7XG4gICAgICAgICAgICBjb25kaXRpb25zLmtleUNvZGUgID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb25kaXRpb25zO1xuICAgIH0sXG4gICAgX2tleUNvZGVUZXN0OiBmdW5jdGlvbihrZXksIGtleUNvZGUpIHtcbiAgICAgICAgaWYodHlwZW9mIHNwZWNpYWxLZXlzW2tleUNvZGVdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdmFyIGtleURlZiA9IHNwZWNpYWxLZXlzW2tleUNvZGVdO1xuXG4gICAgICAgICAgICBpZihrZXlEZWYgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ga2V5RGVmLnRlc3Qoa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXlEZWYgPT09IGtleS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoa2V5Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIGtleS50b1VwcGVyQ2FzZSgpLmNoYXJDb2RlQXQoMCkgPT09IGtleUNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF92YWxpZGF0ZTogZnVuY3Rpb24oYywgZSkge1xuICAgICAgICByZXR1cm4gIChjLmtleSA/IHRoaXMuX2tleUNvZGVUZXN0KGMua2V5LCBlLndoaWNoKSA6IHRydWUpICYmXG4gICAgICAgICAgICAgICAgYy5zaGlmdCA9PT0gZS5zaGlmdEtleSAmJlxuICAgICAgICAgICAgICAgIGMuYWx0ICAgPT09IGUuYWx0S2V5ICYmXG4gICAgICAgICAgICAgICAgKCFjLmN0cmwgfHwgKGMuY3RybCA9PT0gZS5tZXRhS2V5KSAhPT0gKGMuY3RybCA9PT0gZS5jdHJsS2V5KSk7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudDtcblxuIiwidmFyIEV2ZW50ID0gcmVxdWlyZSgnLi9FdmVudC5qcycpLFxuICAgIGV2ZW50cyA9IFtdO1xuXG52YXIga2V5ID0gZnVuY3Rpb24oc2VsZWN0b3IpIHsgLy9GYWN0b3J5IGZvciBFdmVudCBvYmplY3RzXG4gICAgcmV0dXJuIGtleS5fY3JlYXRlRXZlbnQoc2VsZWN0b3IpO1xufTtcblxua2V5LmRvd24gPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICByZXR1cm4gdGhpcy5fY3JlYXRlRXZlbnQoKS5kb3duKGNvbmZpZyk7XG59O1xuXG5rZXkudXAgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgICByZXR1cm4gdGhpcy5fY3JlYXRlRXZlbnQoKS51cChjb25maWcpO1xufTtcblxua2V5LnVuYmluZEFsbCA9IGZ1bmN0aW9uKCkge1xuICAgIHdoaWxlKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgICAgZXZlbnRzLnBvcCgpLmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8vQ3JlYXRlcyBuZXcgRXZlbnQgb2JqZWN0cyAoY2hlY2tpbmcgZm9yIGV4aXN0aW5nIGZpcnN0KVxua2V5Ll9jcmVhdGVFdmVudCA9IGZ1bmN0aW9uKHNlbGVjdG9yKSB7XG4gICAgdmFyIGUgPSBuZXcgRXZlbnQoc2VsZWN0b3IpO1xuICAgIGV2ZW50cy5wdXNoKGUpO1xuICAgIHJldHVybiBlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBrZXk7XG4iLCIvL0Fkb3B0ZWQgZnJvbSBbalF1ZXJ5IGhvdGtleXNdKGh0dHBzOi8vZ2l0aHViLmNvbS9qZXJlc2lnL2pxdWVyeS5ob3RrZXlzL2Jsb2IvbWFzdGVyL2pxdWVyeS5ob3RrZXlzLmpzKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICA4OiBcImJhY2tzcGFjZVwiLFxuICAgIDk6IFwidGFiXCIsXG4gICAgMTA6IC9eKHJldHVybnxlbnRlcikkL2ksXG4gICAgMTM6IC9eKHJldHVybnxlbnRlcikkL2ksXG4gICAgMTY6IFwic2hpZnRcIixcbiAgICAxNzogL14oY3RybHxjb250cm9sKSQvaSxcbiAgICAxODogL14oYWx0fGFsdGVybmF0ZSkkL2ksXG4gICAgMTk6IFwicGF1c2VcIixcbiAgICAyMDogXCJjYXBzbG9ja1wiLFxuICAgIDI3OiAvXihlc2N8ZXNjYXBlKSQvaSxcbiAgICAzMjogXCJzcGFjZVwiLFxuICAgIDMzOiBcInBhZ2V1cFwiLFxuICAgIDM0OiBcInBhZ2Vkb3duXCIsXG4gICAgMzU6IFwiZW5kXCIsXG4gICAgMzY6IFwiaG9tZVwiLFxuICAgIDM3OiBcImxlZnRcIixcbiAgICAzODogXCJ1cFwiLFxuICAgIDM5OiBcInJpZ2h0XCIsXG4gICAgNDA6IFwiZG93blwiLFxuICAgIDQ1OiBcImluc2VydFwiLFxuICAgIDQ2OiAvXihkZWx8ZGVsZXRlKSQvaSxcbiAgICA5MTogL14oY21kfGNvbW1hbmQpJC9pLFxuICAgIDk2OiBcIjBcIixcbiAgICA5NzogXCIxXCIsXG4gICAgOTg6IFwiMlwiLFxuICAgIDk5OiBcIjNcIixcbiAgICAxMDA6IFwiNFwiLFxuICAgIDEwMTogXCI1XCIsXG4gICAgMTAyOiBcIjZcIixcbiAgICAxMDM6IFwiN1wiLFxuICAgIDEwNDogXCI4XCIsXG4gICAgMTA1OiBcIjlcIixcbiAgICAxMDY6IFwiKlwiLFxuICAgIDEwNzogXCIrXCIsXG4gICAgMTA5OiBcIi1cIixcbiAgICAxMTA6IFwiLlwiLFxuICAgIDExMSA6IFwiL1wiLFxuICAgIDExMjogXCJmMVwiLFxuICAgIDExMzogXCJmMlwiLFxuICAgIDExNDogXCJmM1wiLFxuICAgIDExNTogXCJmNFwiLFxuICAgIDExNjogXCJmNVwiLFxuICAgIDExNzogXCJmNlwiLFxuICAgIDExODogXCJmN1wiLFxuICAgIDExOTogXCJmOFwiLFxuICAgIDEyMDogXCJmOVwiLFxuICAgIDEyMTogXCJmMTBcIixcbiAgICAxMjI6IFwiZjExXCIsXG4gICAgMTIzOiBcImYxMlwiLFxuICAgIDE0NDogXCJudW1sb2NrXCIsXG4gICAgMTQ1OiBcInNjcm9sbFwiLFxuICAgIDE4NjogXCI7XCIsXG4gICAgMTg3OiBcIj1cIixcbiAgICAxODk6IFwiLVwiLFxuICAgIDE5MDogXCIuXCIsXG4gICAgMTkxOiBcIi9cIixcbiAgICAxOTI6IFwiYFwiLFxuICAgIDIxOTogXCJbXCIsXG4gICAgMjIwOiBcIlxcXFxcIixcbiAgICAyMjE6IFwiXVwiLFxuICAgIDIyMjogXCInXCIsXG4gICAgMjI0OiBcIm1ldGFcIlxufTtcbiIsIi8qXHJcbiAqIGxvZ2xldmVsIC0gaHR0cHM6Ly9naXRodWIuY29tL3BpbXRlcnJ5L2xvZ2xldmVsXHJcbiAqXHJcbiAqIENvcHlyaWdodCAoYykgMjAxMyBUaW0gUGVycnlcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxyXG4gKi9cclxuXHJcbjsoZnVuY3Rpb24gKHVuZGVmaW5lZCkge1xyXG4gICAgdmFyIHVuZGVmaW5lZFR5cGUgPSBcInVuZGVmaW5lZFwiO1xyXG5cclxuICAgIChmdW5jdGlvbiAobmFtZSwgZGVmaW5pdGlvbikge1xyXG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGRlZmluaXRpb24oKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIGRlZmluZShkZWZpbml0aW9uKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzW25hbWVdID0gZGVmaW5pdGlvbigpO1xyXG4gICAgICAgIH1cclxuICAgIH0oJ2xvZycsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgc2VsZiA9IHt9O1xyXG4gICAgICAgIHZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gcmVhbE1ldGhvZChtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY29uc29sZSA9PT0gdW5kZWZpbmVkVHlwZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5vb3A7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29uc29sZVttZXRob2ROYW1lXSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoY29uc29sZS5sb2cgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBib3VuZFRvQ29uc29sZShjb25zb2xlLCAnbG9nJyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJvdW5kVG9Db25zb2xlKGNvbnNvbGUsIG1ldGhvZE5hbWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBib3VuZFRvQ29uc29sZShjb25zb2xlLCBtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgICAgIHZhciBtZXRob2QgPSBjb25zb2xlW21ldGhvZE5hbWVdO1xyXG4gICAgICAgICAgICBpZiAobWV0aG9kLmJpbmQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb25CaW5kaW5nV3JhcHBlcihtZXRob2QsIGNvbnNvbGUpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQuY2FsbChjb25zb2xlW21ldGhvZE5hbWVdLCBjb25zb2xlKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEluIElFOCArIE1vZGVybml6ciwgdGhlIGJpbmQgc2hpbSB3aWxsIHJlamVjdCB0aGUgYWJvdmUsIHNvIHdlIGZhbGwgYmFjayB0byB3cmFwcGluZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb25CaW5kaW5nV3JhcHBlcihtZXRob2QsIGNvbnNvbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlW21ldGhvZE5hbWVdLmJpbmQoY29uc29sZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bmN0aW9uQmluZGluZ1dyYXBwZXIoZiwgY29udGV4dCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgICAgICBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHkuYXBwbHkoZiwgW2NvbnRleHQsIGFyZ3VtZW50c10pO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGxvZ01ldGhvZHMgPSBbXHJcbiAgICAgICAgICAgIFwidHJhY2VcIixcclxuICAgICAgICAgICAgXCJkZWJ1Z1wiLFxyXG4gICAgICAgICAgICBcImluZm9cIixcclxuICAgICAgICAgICAgXCJ3YXJuXCIsXHJcbiAgICAgICAgICAgIFwiZXJyb3JcIlxyXG4gICAgICAgIF07XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlcGxhY2VMb2dnaW5nTWV0aG9kcyhtZXRob2RGYWN0b3J5KSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCBsb2dNZXRob2RzLmxlbmd0aDsgaWkrKykge1xyXG4gICAgICAgICAgICAgICAgc2VsZltsb2dNZXRob2RzW2lpXV0gPSBtZXRob2RGYWN0b3J5KGxvZ01ldGhvZHNbaWldKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gY29va2llc0F2YWlsYWJsZSgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlICYmXHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LmRvY3VtZW50ICE9PSB1bmRlZmluZWQgJiZcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuZG9jdW1lbnQuY29va2llICE9PSB1bmRlZmluZWQpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gbG9jYWxTdG9yYWdlQXZhaWxhYmxlKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuICh0eXBlb2Ygd2luZG93ICE9PSB1bmRlZmluZWRUeXBlICYmXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhbFN0b3JhZ2UgIT09IHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gcGVyc2lzdExldmVsSWZQb3NzaWJsZShsZXZlbE51bSkge1xyXG4gICAgICAgICAgICB2YXIgbGV2ZWxOYW1lO1xyXG5cclxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHNlbGYubGV2ZWxzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5sZXZlbHMuaGFzT3duUHJvcGVydHkoa2V5KSAmJiBzZWxmLmxldmVsc1trZXldID09PSBsZXZlbE51bSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxldmVsTmFtZSA9IGtleTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGxvY2FsU3RvcmFnZUF2YWlsYWJsZSgpKSB7XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlWydsb2dsZXZlbCddID0gbGV2ZWxOYW1lO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvb2tpZXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgICAgICAgICAgd2luZG93LmRvY3VtZW50LmNvb2tpZSA9IFwibG9nbGV2ZWw9XCIgKyBsZXZlbE5hbWUgKyBcIjtcIjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIGNvb2tpZVJlZ2V4ID0gL2xvZ2xldmVsPShbXjtdKykvO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBsb2FkUGVyc2lzdGVkTGV2ZWwoKSB7XHJcbiAgICAgICAgICAgIHZhciBzdG9yZWRMZXZlbDtcclxuXHJcbiAgICAgICAgICAgIGlmIChsb2NhbFN0b3JhZ2VBdmFpbGFibGUoKSkge1xyXG4gICAgICAgICAgICAgICAgc3RvcmVkTGV2ZWwgPSB3aW5kb3cubG9jYWxTdG9yYWdlWydsb2dsZXZlbCddO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIXN0b3JlZExldmVsICYmIGNvb2tpZXNBdmFpbGFibGUoKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGNvb2tpZU1hdGNoID0gY29va2llUmVnZXguZXhlYyh3aW5kb3cuZG9jdW1lbnQuY29va2llKSB8fCBbXTtcclxuICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gY29va2llTWF0Y2hbMV07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHNbc3RvcmVkTGV2ZWxdIHx8IHNlbGYubGV2ZWxzLldBUk4pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLypcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIFB1YmxpYyBBUElcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqL1xyXG5cclxuICAgICAgICBzZWxmLmxldmVscyA9IHsgXCJUUkFDRVwiOiAwLCBcIkRFQlVHXCI6IDEsIFwiSU5GT1wiOiAyLCBcIldBUk5cIjogMyxcclxuICAgICAgICAgICAgXCJFUlJPUlwiOiA0LCBcIlNJTEVOVFwiOiA1fTtcclxuXHJcbiAgICAgICAgc2VsZi5zZXRMZXZlbCA9IGZ1bmN0aW9uIChsZXZlbCkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGxldmVsID09PSBcIm51bWJlclwiICYmIGxldmVsID49IDAgJiYgbGV2ZWwgPD0gc2VsZi5sZXZlbHMuU0lMRU5UKSB7XHJcbiAgICAgICAgICAgICAgICBwZXJzaXN0TGV2ZWxJZlBvc3NpYmxlKGxldmVsKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAobGV2ZWwgPT09IHNlbGYubGV2ZWxzLlNJTEVOVCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcGxhY2VMb2dnaW5nTWV0aG9kcyhmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbnNvbGUgPT09IHVuZGVmaW5lZFR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMoZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gdW5kZWZpbmVkVHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwobGV2ZWwpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGZbbWV0aG9kTmFtZV0uYXBwbHkoc2VsZiwgYXJndW1lbnRzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJObyBjb25zb2xlIGF2YWlsYWJsZSBmb3IgbG9nZ2luZ1wiO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMoZnVuY3Rpb24gKG1ldGhvZE5hbWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxldmVsIDw9IHNlbGYubGV2ZWxzW21ldGhvZE5hbWUudG9VcHBlckNhc2UoKV0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByZWFsTWV0aG9kKG1ldGhvZE5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vb3A7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbGV2ZWwgPT09IFwic3RyaW5nXCIgJiYgc2VsZi5sZXZlbHNbbGV2ZWwudG9VcHBlckNhc2UoKV0gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChzZWxmLmxldmVsc1tsZXZlbC50b1VwcGVyQ2FzZSgpXSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBcImxvZy5zZXRMZXZlbCgpIGNhbGxlZCB3aXRoIGludmFsaWQgbGV2ZWw6IFwiICsgbGV2ZWw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBzZWxmLmVuYWJsZUFsbCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICBzZWxmLnNldExldmVsKHNlbGYubGV2ZWxzLlRSQUNFKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBzZWxmLmRpc2FibGVBbGwgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChzZWxmLmxldmVscy5TSUxFTlQpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGxvYWRQZXJzaXN0ZWRMZXZlbCgpO1xyXG4gICAgICAgIHJldHVybiBzZWxmO1xyXG4gICAgfSkpO1xyXG59KSgpO1xyXG4iLCIvLyAgICAgVW5kZXJzY29yZS5qcyAxLjUuMlxuLy8gICAgIGh0dHA6Ly91bmRlcnNjb3JlanMub3JnXG4vLyAgICAgKGMpIDIwMDktMjAxMyBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xuLy8gICAgIFVuZGVyc2NvcmUgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbihmdW5jdGlvbigpIHtcblxuICAvLyBCYXNlbGluZSBzZXR1cFxuICAvLyAtLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEVzdGFibGlzaCB0aGUgcm9vdCBvYmplY3QsIGB3aW5kb3dgIGluIHRoZSBicm93c2VyLCBvciBgZXhwb3J0c2Agb24gdGhlIHNlcnZlci5cbiAgdmFyIHJvb3QgPSB0aGlzO1xuXG4gIC8vIFNhdmUgdGhlIHByZXZpb3VzIHZhbHVlIG9mIHRoZSBgX2AgdmFyaWFibGUuXG4gIHZhciBwcmV2aW91c1VuZGVyc2NvcmUgPSByb290Ll87XG5cbiAgLy8gRXN0YWJsaXNoIHRoZSBvYmplY3QgdGhhdCBnZXRzIHJldHVybmVkIHRvIGJyZWFrIG91dCBvZiBhIGxvb3AgaXRlcmF0aW9uLlxuICB2YXIgYnJlYWtlciA9IHt9O1xuXG4gIC8vIFNhdmUgYnl0ZXMgaW4gdGhlIG1pbmlmaWVkIChidXQgbm90IGd6aXBwZWQpIHZlcnNpb246XG4gIHZhciBBcnJheVByb3RvID0gQXJyYXkucHJvdG90eXBlLCBPYmpQcm90byA9IE9iamVjdC5wcm90b3R5cGUsIEZ1bmNQcm90byA9IEZ1bmN0aW9uLnByb3RvdHlwZTtcblxuICAvLyBDcmVhdGUgcXVpY2sgcmVmZXJlbmNlIHZhcmlhYmxlcyBmb3Igc3BlZWQgYWNjZXNzIHRvIGNvcmUgcHJvdG90eXBlcy5cbiAgdmFyXG4gICAgcHVzaCAgICAgICAgICAgICA9IEFycmF5UHJvdG8ucHVzaCxcbiAgICBzbGljZSAgICAgICAgICAgID0gQXJyYXlQcm90by5zbGljZSxcbiAgICBjb25jYXQgICAgICAgICAgID0gQXJyYXlQcm90by5jb25jYXQsXG4gICAgdG9TdHJpbmcgICAgICAgICA9IE9ialByb3RvLnRvU3RyaW5nLFxuICAgIGhhc093blByb3BlcnR5ICAgPSBPYmpQcm90by5oYXNPd25Qcm9wZXJ0eTtcblxuICAvLyBBbGwgKipFQ01BU2NyaXB0IDUqKiBuYXRpdmUgZnVuY3Rpb24gaW1wbGVtZW50YXRpb25zIHRoYXQgd2UgaG9wZSB0byB1c2VcbiAgLy8gYXJlIGRlY2xhcmVkIGhlcmUuXG4gIHZhclxuICAgIG5hdGl2ZUZvckVhY2ggICAgICA9IEFycmF5UHJvdG8uZm9yRWFjaCxcbiAgICBuYXRpdmVNYXAgICAgICAgICAgPSBBcnJheVByb3RvLm1hcCxcbiAgICBuYXRpdmVSZWR1Y2UgICAgICAgPSBBcnJheVByb3RvLnJlZHVjZSxcbiAgICBuYXRpdmVSZWR1Y2VSaWdodCAgPSBBcnJheVByb3RvLnJlZHVjZVJpZ2h0LFxuICAgIG5hdGl2ZUZpbHRlciAgICAgICA9IEFycmF5UHJvdG8uZmlsdGVyLFxuICAgIG5hdGl2ZUV2ZXJ5ICAgICAgICA9IEFycmF5UHJvdG8uZXZlcnksXG4gICAgbmF0aXZlU29tZSAgICAgICAgID0gQXJyYXlQcm90by5zb21lLFxuICAgIG5hdGl2ZUluZGV4T2YgICAgICA9IEFycmF5UHJvdG8uaW5kZXhPZixcbiAgICBuYXRpdmVMYXN0SW5kZXhPZiAgPSBBcnJheVByb3RvLmxhc3RJbmRleE9mLFxuICAgIG5hdGl2ZUlzQXJyYXkgICAgICA9IEFycmF5LmlzQXJyYXksXG4gICAgbmF0aXZlS2V5cyAgICAgICAgID0gT2JqZWN0LmtleXMsXG4gICAgbmF0aXZlQmluZCAgICAgICAgID0gRnVuY1Byb3RvLmJpbmQ7XG5cbiAgLy8gQ3JlYXRlIGEgc2FmZSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciB1c2UgYmVsb3cuXG4gIHZhciBfID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiBpbnN0YW5jZW9mIF8pIHJldHVybiBvYmo7XG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIF8pKSByZXR1cm4gbmV3IF8ob2JqKTtcbiAgICB0aGlzLl93cmFwcGVkID0gb2JqO1xuICB9O1xuXG4gIC8vIEV4cG9ydCB0aGUgVW5kZXJzY29yZSBvYmplY3QgZm9yICoqTm9kZS5qcyoqLCB3aXRoXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5IGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgaW5cbiAgLy8gdGhlIGJyb3dzZXIsIGFkZCBgX2AgYXMgYSBnbG9iYWwgb2JqZWN0IHZpYSBhIHN0cmluZyBpZGVudGlmaWVyLFxuICAvLyBmb3IgQ2xvc3VyZSBDb21waWxlciBcImFkdmFuY2VkXCIgbW9kZS5cbiAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gXztcbiAgICB9XG4gICAgZXhwb3J0cy5fID0gXztcbiAgfSBlbHNlIHtcbiAgICByb290Ll8gPSBfO1xuICB9XG5cbiAgLy8gQ3VycmVudCB2ZXJzaW9uLlxuICBfLlZFUlNJT04gPSAnMS41LjInO1xuXG4gIC8vIENvbGxlY3Rpb24gRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gVGhlIGNvcm5lcnN0b25lLCBhbiBgZWFjaGAgaW1wbGVtZW50YXRpb24sIGFrYSBgZm9yRWFjaGAuXG4gIC8vIEhhbmRsZXMgb2JqZWN0cyB3aXRoIHRoZSBidWlsdC1pbiBgZm9yRWFjaGAsIGFycmF5cywgYW5kIHJhdyBvYmplY3RzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgZm9yRWFjaGAgaWYgYXZhaWxhYmxlLlxuICB2YXIgZWFjaCA9IF8uZWFjaCA9IF8uZm9yRWFjaCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybjtcbiAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgb2JqLmZvckVhY2goaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIH0gZWxzZSBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBvYmoubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2ldLCBpLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0ga2V5cy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5c1tpXV0sIGtleXNbaV0sIG9iaikgPT09IGJyZWFrZXIpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHRzIG9mIGFwcGx5aW5nIHRoZSBpdGVyYXRvciB0byBlYWNoIGVsZW1lbnQuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBtYXBgIGlmIGF2YWlsYWJsZS5cbiAgXy5tYXAgPSBfLmNvbGxlY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHRzO1xuICAgIGlmIChuYXRpdmVNYXAgJiYgb2JqLm1hcCA9PT0gbmF0aXZlTWFwKSByZXR1cm4gb2JqLm1hcChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmVzdWx0cy5wdXNoKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgdmFyIHJlZHVjZUVycm9yID0gJ1JlZHVjZSBvZiBlbXB0eSBhcnJheSB3aXRoIG5vIGluaXRpYWwgdmFsdWUnO1xuXG4gIC8vICoqUmVkdWNlKiogYnVpbGRzIHVwIGEgc2luZ2xlIHJlc3VsdCBmcm9tIGEgbGlzdCBvZiB2YWx1ZXMsIGFrYSBgaW5qZWN0YCxcbiAgLy8gb3IgYGZvbGRsYC4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZWAgaWYgYXZhaWxhYmxlLlxuICBfLnJlZHVjZSA9IF8uZm9sZGwgPSBfLmluamVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIG1lbW8sIGNvbnRleHQpIHtcbiAgICB2YXIgaW5pdGlhbCA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xuICAgIGlmIChvYmogPT0gbnVsbCkgb2JqID0gW107XG4gICAgaWYgKG5hdGl2ZVJlZHVjZSAmJiBvYmoucmVkdWNlID09PSBuYXRpdmVSZWR1Y2UpIHtcbiAgICAgIGlmIChjb250ZXh0KSBpdGVyYXRvciA9IF8uYmluZChpdGVyYXRvciwgY29udGV4dCk7XG4gICAgICByZXR1cm4gaW5pdGlhbCA/IG9iai5yZWR1Y2UoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZShpdGVyYXRvcik7XG4gICAgfVxuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmICghaW5pdGlhbCkge1xuICAgICAgICBtZW1vID0gdmFsdWU7XG4gICAgICAgIGluaXRpYWwgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWVtbyA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgbWVtbywgdmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFRoZSByaWdodC1hc3NvY2lhdGl2ZSB2ZXJzaW9uIG9mIHJlZHVjZSwgYWxzbyBrbm93biBhcyBgZm9sZHJgLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgcmVkdWNlUmlnaHRgIGlmIGF2YWlsYWJsZS5cbiAgXy5yZWR1Y2VSaWdodCA9IF8uZm9sZHIgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGlmIChuYXRpdmVSZWR1Y2VSaWdodCAmJiBvYmoucmVkdWNlUmlnaHQgPT09IG5hdGl2ZVJlZHVjZVJpZ2h0KSB7XG4gICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgcmV0dXJuIGluaXRpYWwgPyBvYmoucmVkdWNlUmlnaHQoaXRlcmF0b3IsIG1lbW8pIDogb2JqLnJlZHVjZVJpZ2h0KGl0ZXJhdG9yKTtcbiAgICB9XG4gICAgdmFyIGxlbmd0aCA9IG9iai5sZW5ndGg7XG4gICAgaWYgKGxlbmd0aCAhPT0gK2xlbmd0aCkge1xuICAgICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICAgIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIH1cbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpbmRleCA9IGtleXMgPyBrZXlzWy0tbGVuZ3RoXSA6IC0tbGVuZ3RoO1xuICAgICAgaWYgKCFpbml0aWFsKSB7XG4gICAgICAgIG1lbW8gPSBvYmpbaW5kZXhdO1xuICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIG9ialtpbmRleF0sIGluZGV4LCBsaXN0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoIWluaXRpYWwpIHRocm93IG5ldyBUeXBlRXJyb3IocmVkdWNlRXJyb3IpO1xuICAgIHJldHVybiBtZW1vO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgZmlyc3QgdmFsdWUgd2hpY2ggcGFzc2VzIGEgdHJ1dGggdGVzdC4gQWxpYXNlZCBhcyBgZGV0ZWN0YC5cbiAgXy5maW5kID0gXy5kZXRlY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBhbnkob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpIHtcbiAgICAgICAgcmVzdWx0ID0gdmFsdWU7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgdGhhdCBwYXNzIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGZpbHRlcmAgaWYgYXZhaWxhYmxlLlxuICAvLyBBbGlhc2VkIGFzIGBzZWxlY3RgLlxuICBfLmZpbHRlciA9IF8uc2VsZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBpZiAobmF0aXZlRmlsdGVyICYmIG9iai5maWx0ZXIgPT09IG5hdGl2ZUZpbHRlcikgcmV0dXJuIG9iai5maWx0ZXIoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpIHJlc3VsdHMucHVzaCh2YWx1ZSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGFsbCB0aGUgZWxlbWVudHMgZm9yIHdoaWNoIGEgdHJ1dGggdGVzdCBmYWlscy5cbiAgXy5yZWplY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIF8uZmlsdGVyKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4gIWl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KTtcbiAgICB9LCBjb250ZXh0KTtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgd2hldGhlciBhbGwgb2YgdGhlIGVsZW1lbnRzIG1hdGNoIGEgdHJ1dGggdGVzdC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGV2ZXJ5YCBpZiBhdmFpbGFibGUuXG4gIC8vIEFsaWFzZWQgYXMgYGFsbGAuXG4gIF8uZXZlcnkgPSBfLmFsbCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRvciB8fCAoaXRlcmF0b3IgPSBfLmlkZW50aXR5KTtcbiAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiByZXN1bHQ7XG4gICAgaWYgKG5hdGl2ZUV2ZXJ5ICYmIG9iai5ldmVyeSA9PT0gbmF0aXZlRXZlcnkpIHJldHVybiBvYmouZXZlcnkoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmICghKHJlc3VsdCA9IHJlc3VsdCAmJiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpKSByZXR1cm4gYnJlYWtlcjtcbiAgICB9KTtcbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIGF0IGxlYXN0IG9uZSBlbGVtZW50IGluIHRoZSBvYmplY3QgbWF0Y2hlcyBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBzb21lYCBpZiBhdmFpbGFibGUuXG4gIC8vIEFsaWFzZWQgYXMgYGFueWAuXG4gIHZhciBhbnkgPSBfLnNvbWUgPSBfLmFueSA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpdGVyYXRvciB8fCAoaXRlcmF0b3IgPSBfLmlkZW50aXR5KTtcbiAgICB2YXIgcmVzdWx0ID0gZmFsc2U7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChuYXRpdmVTb21lICYmIG9iai5zb21lID09PSBuYXRpdmVTb21lKSByZXR1cm4gb2JqLnNvbWUoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIGlmIChyZXN1bHQgfHwgKHJlc3VsdCA9IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSkpIHJldHVybiBicmVha2VyO1xuICAgIH0pO1xuICAgIHJldHVybiAhIXJlc3VsdDtcbiAgfTtcblxuICAvLyBEZXRlcm1pbmUgaWYgdGhlIGFycmF5IG9yIG9iamVjdCBjb250YWlucyBhIGdpdmVuIHZhbHVlICh1c2luZyBgPT09YCkuXG4gIC8vIEFsaWFzZWQgYXMgYGluY2x1ZGVgLlxuICBfLmNvbnRhaW5zID0gXy5pbmNsdWRlID0gZnVuY3Rpb24ob2JqLCB0YXJnZXQpIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICBpZiAobmF0aXZlSW5kZXhPZiAmJiBvYmouaW5kZXhPZiA9PT0gbmF0aXZlSW5kZXhPZikgcmV0dXJuIG9iai5pbmRleE9mKHRhcmdldCkgIT0gLTE7XG4gICAgcmV0dXJuIGFueShvYmosIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdmFsdWUgPT09IHRhcmdldDtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBJbnZva2UgYSBtZXRob2QgKHdpdGggYXJndW1lbnRzKSBvbiBldmVyeSBpdGVtIGluIGEgY29sbGVjdGlvbi5cbiAgXy5pbnZva2UgPSBmdW5jdGlvbihvYmosIG1ldGhvZCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHZhciBpc0Z1bmMgPSBfLmlzRnVuY3Rpb24obWV0aG9kKTtcbiAgICByZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIChpc0Z1bmMgPyBtZXRob2QgOiB2YWx1ZVttZXRob2RdKS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgbWFwYDogZmV0Y2hpbmcgYSBwcm9wZXJ0eS5cbiAgXy5wbHVjayA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUpeyByZXR1cm4gdmFsdWVba2V5XTsgfSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmlsdGVyYDogc2VsZWN0aW5nIG9ubHkgb2JqZWN0c1xuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLndoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycywgZmlyc3QpIHtcbiAgICBpZiAoXy5pc0VtcHR5KGF0dHJzKSkgcmV0dXJuIGZpcnN0ID8gdm9pZCAwIDogW107XG4gICAgcmV0dXJuIF9bZmlyc3QgPyAnZmluZCcgOiAnZmlsdGVyJ10ob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgZm9yICh2YXIga2V5IGluIGF0dHJzKSB7XG4gICAgICAgIGlmIChhdHRyc1trZXldICE9PSB2YWx1ZVtrZXldKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBDb252ZW5pZW5jZSB2ZXJzaW9uIG9mIGEgY29tbW9uIHVzZSBjYXNlIG9mIGBmaW5kYDogZ2V0dGluZyB0aGUgZmlyc3Qgb2JqZWN0XG4gIC8vIGNvbnRhaW5pbmcgc3BlY2lmaWMgYGtleTp2YWx1ZWAgcGFpcnMuXG4gIF8uZmluZFdoZXJlID0gZnVuY3Rpb24ob2JqLCBhdHRycykge1xuICAgIHJldHVybiBfLndoZXJlKG9iaiwgYXR0cnMsIHRydWUpO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWF4aW11bSBlbGVtZW50IG9yIChlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgLy8gQ2FuJ3Qgb3B0aW1pemUgYXJyYXlzIG9mIGludGVnZXJzIGxvbmdlciB0aGFuIDY1LDUzNSBlbGVtZW50cy5cbiAgLy8gU2VlIFtXZWJLaXQgQnVnIDgwNzk3XShodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9ODA3OTcpXG4gIF8ubWF4ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmICghaXRlcmF0b3IgJiYgXy5pc0FycmF5KG9iaikgJiYgb2JqWzBdID09PSArb2JqWzBdICYmIG9iai5sZW5ndGggPCA2NTUzNSkge1xuICAgICAgcmV0dXJuIE1hdGgubWF4LmFwcGx5KE1hdGgsIG9iaik7XG4gICAgfVxuICAgIGlmICghaXRlcmF0b3IgJiYgXy5pc0VtcHR5KG9iaikpIHJldHVybiAtSW5maW5pdHk7XG4gICAgdmFyIHJlc3VsdCA9IHtjb21wdXRlZCA6IC1JbmZpbml0eSwgdmFsdWU6IC1JbmZpbml0eX07XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgdmFyIGNvbXB1dGVkID0gaXRlcmF0b3IgPyBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkgOiB2YWx1ZTtcbiAgICAgIGNvbXB1dGVkID4gcmVzdWx0LmNvbXB1dGVkICYmIChyZXN1bHQgPSB7dmFsdWUgOiB2YWx1ZSwgY29tcHV0ZWQgOiBjb21wdXRlZH0pO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQudmFsdWU7XG4gIH07XG5cbiAgLy8gUmV0dXJuIHRoZSBtaW5pbXVtIGVsZW1lbnQgKG9yIGVsZW1lbnQtYmFzZWQgY29tcHV0YXRpb24pLlxuICBfLm1pbiA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoIWl0ZXJhdG9yICYmIF8uaXNBcnJheShvYmopICYmIG9ialswXSA9PT0gK29ialswXSAmJiBvYmoubGVuZ3RoIDwgNjU1MzUpIHtcbiAgICAgIHJldHVybiBNYXRoLm1pbi5hcHBseShNYXRoLCBvYmopO1xuICAgIH1cbiAgICBpZiAoIWl0ZXJhdG9yICYmIF8uaXNFbXB0eShvYmopKSByZXR1cm4gSW5maW5pdHk7XG4gICAgdmFyIHJlc3VsdCA9IHtjb21wdXRlZCA6IEluZmluaXR5LCB2YWx1ZTogSW5maW5pdHl9O1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHZhciBjb21wdXRlZCA9IGl0ZXJhdG9yID8gaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpIDogdmFsdWU7XG4gICAgICBjb21wdXRlZCA8IHJlc3VsdC5jb21wdXRlZCAmJiAocmVzdWx0ID0ge3ZhbHVlIDogdmFsdWUsIGNvbXB1dGVkIDogY29tcHV0ZWR9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0LnZhbHVlO1xuICB9O1xuXG4gIC8vIFNodWZmbGUgYW4gYXJyYXksIHVzaW5nIHRoZSBtb2Rlcm4gdmVyc2lvbiBvZiB0aGUgXG4gIC8vIFtGaXNoZXItWWF0ZXMgc2h1ZmZsZV0oaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9GaXNoZXLigJNZYXRlc19zaHVmZmxlKS5cbiAgXy5zaHVmZmxlID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHJhbmQ7XG4gICAgdmFyIGluZGV4ID0gMDtcbiAgICB2YXIgc2h1ZmZsZWQgPSBbXTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJhbmQgPSBfLnJhbmRvbShpbmRleCsrKTtcbiAgICAgIHNodWZmbGVkW2luZGV4IC0gMV0gPSBzaHVmZmxlZFtyYW5kXTtcbiAgICAgIHNodWZmbGVkW3JhbmRdID0gdmFsdWU7XG4gICAgfSk7XG4gICAgcmV0dXJuIHNodWZmbGVkO1xuICB9O1xuXG4gIC8vIFNhbXBsZSAqKm4qKiByYW5kb20gdmFsdWVzIGZyb20gYW4gYXJyYXkuXG4gIC8vIElmICoqbioqIGlzIG5vdCBzcGVjaWZpZWQsIHJldHVybnMgYSBzaW5nbGUgcmFuZG9tIGVsZW1lbnQgZnJvbSB0aGUgYXJyYXkuXG4gIC8vIFRoZSBpbnRlcm5hbCBgZ3VhcmRgIGFyZ3VtZW50IGFsbG93cyBpdCB0byB3b3JrIHdpdGggYG1hcGAuXG4gIF8uc2FtcGxlID0gZnVuY3Rpb24ob2JqLCBuLCBndWFyZCkge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMiB8fCBndWFyZCkge1xuICAgICAgcmV0dXJuIG9ialtfLnJhbmRvbShvYmoubGVuZ3RoIC0gMSldO1xuICAgIH1cbiAgICByZXR1cm4gXy5zaHVmZmxlKG9iaikuc2xpY2UoMCwgTWF0aC5tYXgoMCwgbikpO1xuICB9O1xuXG4gIC8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHRvIGdlbmVyYXRlIGxvb2t1cCBpdGVyYXRvcnMuXG4gIHZhciBsb29rdXBJdGVyYXRvciA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIF8uaXNGdW5jdGlvbih2YWx1ZSkgPyB2YWx1ZSA6IGZ1bmN0aW9uKG9iail7IHJldHVybiBvYmpbdmFsdWVdOyB9O1xuICB9O1xuXG4gIC8vIFNvcnQgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiBwcm9kdWNlZCBieSBhbiBpdGVyYXRvci5cbiAgXy5zb3J0QnkgPSBmdW5jdGlvbihvYmosIHZhbHVlLCBjb250ZXh0KSB7XG4gICAgdmFyIGl0ZXJhdG9yID0gbG9va3VwSXRlcmF0b3IodmFsdWUpO1xuICAgIHJldHVybiBfLnBsdWNrKF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgIGluZGV4OiBpbmRleCxcbiAgICAgICAgY3JpdGVyaWE6IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KVxuICAgICAgfTtcbiAgICB9KS5zb3J0KGZ1bmN0aW9uKGxlZnQsIHJpZ2h0KSB7XG4gICAgICB2YXIgYSA9IGxlZnQuY3JpdGVyaWE7XG4gICAgICB2YXIgYiA9IHJpZ2h0LmNyaXRlcmlhO1xuICAgICAgaWYgKGEgIT09IGIpIHtcbiAgICAgICAgaWYgKGEgPiBiIHx8IGEgPT09IHZvaWQgMCkgcmV0dXJuIDE7XG4gICAgICAgIGlmIChhIDwgYiB8fCBiID09PSB2b2lkIDApIHJldHVybiAtMTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBsZWZ0LmluZGV4IC0gcmlnaHQuaW5kZXg7XG4gICAgfSksICd2YWx1ZScpO1xuICB9O1xuXG4gIC8vIEFuIGludGVybmFsIGZ1bmN0aW9uIHVzZWQgZm9yIGFnZ3JlZ2F0ZSBcImdyb3VwIGJ5XCIgb3BlcmF0aW9ucy5cbiAgdmFyIGdyb3VwID0gZnVuY3Rpb24oYmVoYXZpb3IpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24ob2JqLCB2YWx1ZSwgY29udGV4dCkge1xuICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgdmFyIGl0ZXJhdG9yID0gdmFsdWUgPT0gbnVsbCA/IF8uaWRlbnRpdHkgOiBsb29rdXBJdGVyYXRvcih2YWx1ZSk7XG4gICAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICAgIHZhciBrZXkgPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgb2JqKTtcbiAgICAgICAgYmVoYXZpb3IocmVzdWx0LCBrZXksIHZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEdyb3VwcyB0aGUgb2JqZWN0J3MgdmFsdWVzIGJ5IGEgY3JpdGVyaW9uLiBQYXNzIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGVcbiAgLy8gdG8gZ3JvdXAgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZSBjcml0ZXJpb24uXG4gIF8uZ3JvdXBCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5LCB2YWx1ZSkge1xuICAgIChfLmhhcyhyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSA6IChyZXN1bHRba2V5XSA9IFtdKSkucHVzaCh2YWx1ZSk7XG4gIH0pO1xuXG4gIC8vIEluZGV4ZXMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbiwgc2ltaWxhciB0byBgZ3JvdXBCeWAsIGJ1dCBmb3JcbiAgLy8gd2hlbiB5b3Uga25vdyB0aGF0IHlvdXIgaW5kZXggdmFsdWVzIHdpbGwgYmUgdW5pcXVlLlxuICBfLmluZGV4QnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIGtleSwgdmFsdWUpIHtcbiAgICByZXN1bHRba2V5XSA9IHZhbHVlO1xuICB9KTtcblxuICAvLyBDb3VudHMgaW5zdGFuY2VzIG9mIGFuIG9iamVjdCB0aGF0IGdyb3VwIGJ5IGEgY2VydGFpbiBjcml0ZXJpb24uIFBhc3NcbiAgLy8gZWl0aGVyIGEgc3RyaW5nIGF0dHJpYnV0ZSB0byBjb3VudCBieSwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdGhlXG4gIC8vIGNyaXRlcmlvbi5cbiAgXy5jb3VudEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCBrZXkpIHtcbiAgICBfLmhhcyhyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSsrIDogcmVzdWx0W2tleV0gPSAxO1xuICB9KTtcblxuICAvLyBVc2UgYSBjb21wYXJhdG9yIGZ1bmN0aW9uIHRvIGZpZ3VyZSBvdXQgdGhlIHNtYWxsZXN0IGluZGV4IGF0IHdoaWNoXG4gIC8vIGFuIG9iamVjdCBzaG91bGQgYmUgaW5zZXJ0ZWQgc28gYXMgdG8gbWFpbnRhaW4gb3JkZXIuIFVzZXMgYmluYXJ5IHNlYXJjaC5cbiAgXy5zb3J0ZWRJbmRleCA9IGZ1bmN0aW9uKGFycmF5LCBvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgPSBpdGVyYXRvciA9PSBudWxsID8gXy5pZGVudGl0eSA6IGxvb2t1cEl0ZXJhdG9yKGl0ZXJhdG9yKTtcbiAgICB2YXIgdmFsdWUgPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9iaik7XG4gICAgdmFyIGxvdyA9IDAsIGhpZ2ggPSBhcnJheS5sZW5ndGg7XG4gICAgd2hpbGUgKGxvdyA8IGhpZ2gpIHtcbiAgICAgIHZhciBtaWQgPSAobG93ICsgaGlnaCkgPj4+IDE7XG4gICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIGFycmF5W21pZF0pIDwgdmFsdWUgPyBsb3cgPSBtaWQgKyAxIDogaGlnaCA9IG1pZDtcbiAgICB9XG4gICAgcmV0dXJuIGxvdztcbiAgfTtcblxuICAvLyBTYWZlbHkgY3JlYXRlIGEgcmVhbCwgbGl2ZSBhcnJheSBmcm9tIGFueXRoaW5nIGl0ZXJhYmxlLlxuICBfLnRvQXJyYXkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIW9iaikgcmV0dXJuIFtdO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSkgcmV0dXJuIHNsaWNlLmNhbGwob2JqKTtcbiAgICBpZiAob2JqLmxlbmd0aCA9PT0gK29iai5sZW5ndGgpIHJldHVybiBfLm1hcChvYmosIF8uaWRlbnRpdHkpO1xuICAgIHJldHVybiBfLnZhbHVlcyhvYmopO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIGFuIG9iamVjdC5cbiAgXy5zaXplID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gMDtcbiAgICByZXR1cm4gKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSA/IG9iai5sZW5ndGggOiBfLmtleXMob2JqKS5sZW5ndGg7XG4gIH07XG5cbiAgLy8gQXJyYXkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIEdldCB0aGUgZmlyc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgZmlyc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBBbGlhc2VkIGFzIGBoZWFkYCBhbmQgYHRha2VgLiBUaGUgKipndWFyZCoqIGNoZWNrXG4gIC8vIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5maXJzdCA9IF8uaGVhZCA9IF8udGFrZSA9IGZ1bmN0aW9uKGFycmF5LCBuLCBndWFyZCkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIHJldHVybiAobiA9PSBudWxsKSB8fCBndWFyZCA/IGFycmF5WzBdIDogc2xpY2UuY2FsbChhcnJheSwgMCwgbik7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgbGFzdCBlbnRyeSBvZiB0aGUgYXJyYXkuIEVzcGVjaWFsbHkgdXNlZnVsIG9uXG4gIC8vIHRoZSBhcmd1bWVudHMgb2JqZWN0LiBQYXNzaW5nICoqbioqIHdpbGwgcmV0dXJuIGFsbCB0aGUgdmFsdWVzIGluXG4gIC8vIHRoZSBhcnJheSwgZXhjbHVkaW5nIHRoZSBsYXN0IE4uIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aFxuICAvLyBgXy5tYXBgLlxuICBfLmluaXRpYWwgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgMCwgYXJyYXkubGVuZ3RoIC0gKChuID09IG51bGwpIHx8IGd1YXJkID8gMSA6IG4pKTtcbiAgfTtcblxuICAvLyBHZXQgdGhlIGxhc3QgZWxlbWVudCBvZiBhbiBhcnJheS4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiB0aGUgbGFzdCBOXG4gIC8vIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKiogY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLmxhc3QgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICBpZiAoKG4gPT0gbnVsbCkgfHwgZ3VhcmQpIHtcbiAgICAgIHJldHVybiBhcnJheVthcnJheS5sZW5ndGggLSAxXTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIE1hdGgubWF4KGFycmF5Lmxlbmd0aCAtIG4sIDApKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gUmV0dXJucyBldmVyeXRoaW5nIGJ1dCB0aGUgZmlyc3QgZW50cnkgb2YgdGhlIGFycmF5LiBBbGlhc2VkIGFzIGB0YWlsYCBhbmQgYGRyb3BgLlxuICAvLyBFc3BlY2lhbGx5IHVzZWZ1bCBvbiB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyBhbiAqKm4qKiB3aWxsIHJldHVyblxuICAvLyB0aGUgcmVzdCBOIHZhbHVlcyBpbiB0aGUgYXJyYXkuIFRoZSAqKmd1YXJkKipcbiAgLy8gY2hlY2sgYWxsb3dzIGl0IHRvIHdvcmsgd2l0aCBgXy5tYXBgLlxuICBfLnJlc3QgPSBfLnRhaWwgPSBfLmRyb3AgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICByZXR1cm4gc2xpY2UuY2FsbChhcnJheSwgKG4gPT0gbnVsbCkgfHwgZ3VhcmQgPyAxIDogbik7XG4gIH07XG5cbiAgLy8gVHJpbSBvdXQgYWxsIGZhbHN5IHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICBfLmNvbXBhY3QgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmZpbHRlcihhcnJheSwgXy5pZGVudGl0eSk7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgaW1wbGVtZW50YXRpb24gb2YgYSByZWN1cnNpdmUgYGZsYXR0ZW5gIGZ1bmN0aW9uLlxuICB2YXIgZmxhdHRlbiA9IGZ1bmN0aW9uKGlucHV0LCBzaGFsbG93LCBvdXRwdXQpIHtcbiAgICBpZiAoc2hhbGxvdyAmJiBfLmV2ZXJ5KGlucHV0LCBfLmlzQXJyYXkpKSB7XG4gICAgICByZXR1cm4gY29uY2F0LmFwcGx5KG91dHB1dCwgaW5wdXQpO1xuICAgIH1cbiAgICBlYWNoKGlucHV0LCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKF8uaXNBcnJheSh2YWx1ZSkgfHwgXy5pc0FyZ3VtZW50cyh2YWx1ZSkpIHtcbiAgICAgICAgc2hhbGxvdyA/IHB1c2guYXBwbHkob3V0cHV0LCB2YWx1ZSkgOiBmbGF0dGVuKHZhbHVlLCBzaGFsbG93LCBvdXRwdXQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LnB1c2godmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvdXRwdXQ7XG4gIH07XG5cbiAgLy8gRmxhdHRlbiBvdXQgYW4gYXJyYXksIGVpdGhlciByZWN1cnNpdmVseSAoYnkgZGVmYXVsdCksIG9yIGp1c3Qgb25lIGxldmVsLlxuICBfLmZsYXR0ZW4gPSBmdW5jdGlvbihhcnJheSwgc2hhbGxvdykge1xuICAgIHJldHVybiBmbGF0dGVuKGFycmF5LCBzaGFsbG93LCBbXSk7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgdmVyc2lvbiBvZiB0aGUgYXJyYXkgdGhhdCBkb2VzIG5vdCBjb250YWluIHRoZSBzcGVjaWZpZWQgdmFsdWUocykuXG4gIF8ud2l0aG91dCA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgcmV0dXJuIF8uZGlmZmVyZW5jZShhcnJheSwgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgfTtcblxuICAvLyBQcm9kdWNlIGEgZHVwbGljYXRlLWZyZWUgdmVyc2lvbiBvZiB0aGUgYXJyYXkuIElmIHRoZSBhcnJheSBoYXMgYWxyZWFkeVxuICAvLyBiZWVuIHNvcnRlZCwgeW91IGhhdmUgdGhlIG9wdGlvbiBvZiB1c2luZyBhIGZhc3RlciBhbGdvcml0aG0uXG4gIC8vIEFsaWFzZWQgYXMgYHVuaXF1ZWAuXG4gIF8udW5pcSA9IF8udW5pcXVlID0gZnVuY3Rpb24oYXJyYXksIGlzU29ydGVkLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmIChfLmlzRnVuY3Rpb24oaXNTb3J0ZWQpKSB7XG4gICAgICBjb250ZXh0ID0gaXRlcmF0b3I7XG4gICAgICBpdGVyYXRvciA9IGlzU29ydGVkO1xuICAgICAgaXNTb3J0ZWQgPSBmYWxzZTtcbiAgICB9XG4gICAgdmFyIGluaXRpYWwgPSBpdGVyYXRvciA/IF8ubWFwKGFycmF5LCBpdGVyYXRvciwgY29udGV4dCkgOiBhcnJheTtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIHZhciBzZWVuID0gW107XG4gICAgZWFjaChpbml0aWFsLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgpIHtcbiAgICAgIGlmIChpc1NvcnRlZCA/ICghaW5kZXggfHwgc2VlbltzZWVuLmxlbmd0aCAtIDFdICE9PSB2YWx1ZSkgOiAhXy5jb250YWlucyhzZWVuLCB2YWx1ZSkpIHtcbiAgICAgICAgc2Vlbi5wdXNoKHZhbHVlKTtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGFycmF5W2luZGV4XSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIHRoZSB1bmlvbjogZWFjaCBkaXN0aW5jdCBlbGVtZW50IGZyb20gYWxsIG9mXG4gIC8vIHRoZSBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLnVuaW9uID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIF8udW5pcShfLmZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlKSk7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhbiBhcnJheSB0aGF0IGNvbnRhaW5zIGV2ZXJ5IGl0ZW0gc2hhcmVkIGJldHdlZW4gYWxsIHRoZVxuICAvLyBwYXNzZWQtaW4gYXJyYXlzLlxuICBfLmludGVyc2VjdGlvbiA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3QgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKF8udW5pcShhcnJheSksIGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIHJldHVybiBfLmV2ZXJ5KHJlc3QsIGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgICAgIHJldHVybiBfLmluZGV4T2Yob3RoZXIsIGl0ZW0pID49IDA7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICAvLyBUYWtlIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gb25lIGFycmF5IGFuZCBhIG51bWJlciBvZiBvdGhlciBhcnJheXMuXG4gIC8vIE9ubHkgdGhlIGVsZW1lbnRzIHByZXNlbnQgaW4ganVzdCB0aGUgZmlyc3QgYXJyYXkgd2lsbCByZW1haW4uXG4gIF8uZGlmZmVyZW5jZSA9IGZ1bmN0aW9uKGFycmF5KSB7XG4gICAgdmFyIHJlc3QgPSBjb25jYXQuYXBwbHkoQXJyYXlQcm90bywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICByZXR1cm4gXy5maWx0ZXIoYXJyYXksIGZ1bmN0aW9uKHZhbHVlKXsgcmV0dXJuICFfLmNvbnRhaW5zKHJlc3QsIHZhbHVlKTsgfSk7XG4gIH07XG5cbiAgLy8gWmlwIHRvZ2V0aGVyIG11bHRpcGxlIGxpc3RzIGludG8gYSBzaW5nbGUgYXJyYXkgLS0gZWxlbWVudHMgdGhhdCBzaGFyZVxuICAvLyBhbiBpbmRleCBnbyB0b2dldGhlci5cbiAgXy56aXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbGVuZ3RoID0gXy5tYXgoXy5wbHVjayhhcmd1bWVudHMsIFwibGVuZ3RoXCIpLmNvbmNhdCgwKSk7XG4gICAgdmFyIHJlc3VsdHMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRzW2ldID0gXy5wbHVjayhhcmd1bWVudHMsICcnICsgaSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIENvbnZlcnRzIGxpc3RzIGludG8gb2JqZWN0cy4gUGFzcyBlaXRoZXIgYSBzaW5nbGUgYXJyYXkgb2YgYFtrZXksIHZhbHVlXWBcbiAgLy8gcGFpcnMsIG9yIHR3byBwYXJhbGxlbCBhcnJheXMgb2YgdGhlIHNhbWUgbGVuZ3RoIC0tIG9uZSBvZiBrZXlzLCBhbmQgb25lIG9mXG4gIC8vIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlcy5cbiAgXy5vYmplY3QgPSBmdW5jdGlvbihsaXN0LCB2YWx1ZXMpIHtcbiAgICBpZiAobGlzdCA9PSBudWxsKSByZXR1cm4ge307XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBsaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAodmFsdWVzKSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldXSA9IHZhbHVlc1tpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdFtsaXN0W2ldWzBdXSA9IGxpc3RbaV1bMV07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gSWYgdGhlIGJyb3dzZXIgZG9lc24ndCBzdXBwbHkgdXMgd2l0aCBpbmRleE9mIChJJ20gbG9va2luZyBhdCB5b3UsICoqTVNJRSoqKSxcbiAgLy8gd2UgbmVlZCB0aGlzIGZ1bmN0aW9uLiBSZXR1cm4gdGhlIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mIGFuXG4gIC8vIGl0ZW0gaW4gYW4gYXJyYXksIG9yIC0xIGlmIHRoZSBpdGVtIGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgYXJyYXkuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBpbmRleE9mYCBpZiBhdmFpbGFibGUuXG4gIC8vIElmIHRoZSBhcnJheSBpcyBsYXJnZSBhbmQgYWxyZWFkeSBpbiBzb3J0IG9yZGVyLCBwYXNzIGB0cnVlYFxuICAvLyBmb3IgKippc1NvcnRlZCoqIHRvIHVzZSBiaW5hcnkgc2VhcmNoLlxuICBfLmluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgaXNTb3J0ZWQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBpID0gMCwgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuICAgIGlmIChpc1NvcnRlZCkge1xuICAgICAgaWYgKHR5cGVvZiBpc1NvcnRlZCA9PSAnbnVtYmVyJykge1xuICAgICAgICBpID0gKGlzU29ydGVkIDwgMCA/IE1hdGgubWF4KDAsIGxlbmd0aCArIGlzU29ydGVkKSA6IGlzU29ydGVkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkgPSBfLnNvcnRlZEluZGV4KGFycmF5LCBpdGVtKTtcbiAgICAgICAgcmV0dXJuIGFycmF5W2ldID09PSBpdGVtID8gaSA6IC0xO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobmF0aXZlSW5kZXhPZiAmJiBhcnJheS5pbmRleE9mID09PSBuYXRpdmVJbmRleE9mKSByZXR1cm4gYXJyYXkuaW5kZXhPZihpdGVtLCBpc1NvcnRlZCk7XG4gICAgZm9yICg7IGkgPCBsZW5ndGg7IGkrKykgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGxhc3RJbmRleE9mYCBpZiBhdmFpbGFibGUuXG4gIF8ubGFzdEluZGV4T2YgPSBmdW5jdGlvbihhcnJheSwgaXRlbSwgZnJvbSkge1xuICAgIGlmIChhcnJheSA9PSBudWxsKSByZXR1cm4gLTE7XG4gICAgdmFyIGhhc0luZGV4ID0gZnJvbSAhPSBudWxsO1xuICAgIGlmIChuYXRpdmVMYXN0SW5kZXhPZiAmJiBhcnJheS5sYXN0SW5kZXhPZiA9PT0gbmF0aXZlTGFzdEluZGV4T2YpIHtcbiAgICAgIHJldHVybiBoYXNJbmRleCA/IGFycmF5Lmxhc3RJbmRleE9mKGl0ZW0sIGZyb20pIDogYXJyYXkubGFzdEluZGV4T2YoaXRlbSk7XG4gICAgfVxuICAgIHZhciBpID0gKGhhc0luZGV4ID8gZnJvbSA6IGFycmF5Lmxlbmd0aCk7XG4gICAgd2hpbGUgKGktLSkgaWYgKGFycmF5W2ldID09PSBpdGVtKSByZXR1cm4gaTtcbiAgICByZXR1cm4gLTE7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYW4gaW50ZWdlciBBcnJheSBjb250YWluaW5nIGFuIGFyaXRobWV0aWMgcHJvZ3Jlc3Npb24uIEEgcG9ydCBvZlxuICAvLyB0aGUgbmF0aXZlIFB5dGhvbiBgcmFuZ2UoKWAgZnVuY3Rpb24uIFNlZVxuICAvLyBbdGhlIFB5dGhvbiBkb2N1bWVudGF0aW9uXShodHRwOi8vZG9jcy5weXRob24ub3JnL2xpYnJhcnkvZnVuY3Rpb25zLmh0bWwjcmFuZ2UpLlxuICBfLnJhbmdlID0gZnVuY3Rpb24oc3RhcnQsIHN0b3AsIHN0ZXApIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8PSAxKSB7XG4gICAgICBzdG9wID0gc3RhcnQgfHwgMDtcbiAgICAgIHN0YXJ0ID0gMDtcbiAgICB9XG4gICAgc3RlcCA9IGFyZ3VtZW50c1syXSB8fCAxO1xuXG4gICAgdmFyIGxlbmd0aCA9IE1hdGgubWF4KE1hdGguY2VpbCgoc3RvcCAtIHN0YXJ0KSAvIHN0ZXApLCAwKTtcbiAgICB2YXIgaWR4ID0gMDtcbiAgICB2YXIgcmFuZ2UgPSBuZXcgQXJyYXkobGVuZ3RoKTtcblxuICAgIHdoaWxlKGlkeCA8IGxlbmd0aCkge1xuICAgICAgcmFuZ2VbaWR4KytdID0gc3RhcnQ7XG4gICAgICBzdGFydCArPSBzdGVwO1xuICAgIH1cblxuICAgIHJldHVybiByYW5nZTtcbiAgfTtcblxuICAvLyBGdW5jdGlvbiAoYWhlbSkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldXNhYmxlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciBwcm90b3R5cGUgc2V0dGluZy5cbiAgdmFyIGN0b3IgPSBmdW5jdGlvbigpe307XG5cbiAgLy8gQ3JlYXRlIGEgZnVuY3Rpb24gYm91bmQgdG8gYSBnaXZlbiBvYmplY3QgKGFzc2lnbmluZyBgdGhpc2AsIGFuZCBhcmd1bWVudHMsXG4gIC8vIG9wdGlvbmFsbHkpLiBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgRnVuY3Rpb24uYmluZGAgaWZcbiAgLy8gYXZhaWxhYmxlLlxuICBfLmJpbmQgPSBmdW5jdGlvbihmdW5jLCBjb250ZXh0KSB7XG4gICAgdmFyIGFyZ3MsIGJvdW5kO1xuICAgIGlmIChuYXRpdmVCaW5kICYmIGZ1bmMuYmluZCA9PT0gbmF0aXZlQmluZCkgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBpZiAoIV8uaXNGdW5jdGlvbihmdW5jKSkgdGhyb3cgbmV3IFR5cGVFcnJvcjtcbiAgICBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBib3VuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSkgcmV0dXJuIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICBjdG9yLnByb3RvdHlwZSA9IGZ1bmMucHJvdG90eXBlO1xuICAgICAgdmFyIHNlbGYgPSBuZXcgY3RvcjtcbiAgICAgIGN0b3IucHJvdG90eXBlID0gbnVsbDtcbiAgICAgIHZhciByZXN1bHQgPSBmdW5jLmFwcGx5KHNlbGYsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgaWYgKE9iamVjdChyZXN1bHQpID09PSByZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFBhcnRpYWxseSBhcHBseSBhIGZ1bmN0aW9uIGJ5IGNyZWF0aW5nIGEgdmVyc2lvbiB0aGF0IGhhcyBoYWQgc29tZSBvZiBpdHNcbiAgLy8gYXJndW1lbnRzIHByZS1maWxsZWQsIHdpdGhvdXQgY2hhbmdpbmcgaXRzIGR5bmFtaWMgYHRoaXNgIGNvbnRleHQuXG4gIF8ucGFydGlhbCA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIEJpbmQgYWxsIG9mIGFuIG9iamVjdCdzIG1ldGhvZHMgdG8gdGhhdCBvYmplY3QuIFVzZWZ1bCBmb3IgZW5zdXJpbmcgdGhhdFxuICAvLyBhbGwgY2FsbGJhY2tzIGRlZmluZWQgb24gYW4gb2JqZWN0IGJlbG9uZyB0byBpdC5cbiAgXy5iaW5kQWxsID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGZ1bmNzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChmdW5jcy5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihcImJpbmRBbGwgbXVzdCBiZSBwYXNzZWQgZnVuY3Rpb24gbmFtZXNcIik7XG4gICAgZWFjaChmdW5jcywgZnVuY3Rpb24oZikgeyBvYmpbZl0gPSBfLmJpbmQob2JqW2ZdLCBvYmopOyB9KTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIE1lbW9pemUgYW4gZXhwZW5zaXZlIGZ1bmN0aW9uIGJ5IHN0b3JpbmcgaXRzIHJlc3VsdHMuXG4gIF8ubWVtb2l6ZSA9IGZ1bmN0aW9uKGZ1bmMsIGhhc2hlcikge1xuICAgIHZhciBtZW1vID0ge307XG4gICAgaGFzaGVyIHx8IChoYXNoZXIgPSBfLmlkZW50aXR5KTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIga2V5ID0gaGFzaGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gXy5oYXMobWVtbywga2V5KSA/IG1lbW9ba2V5XSA6IChtZW1vW2tleV0gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykpO1xuICAgIH07XG4gIH07XG5cbiAgLy8gRGVsYXlzIGEgZnVuY3Rpb24gZm9yIHRoZSBnaXZlbiBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLCBhbmQgdGhlbiBjYWxsc1xuICAvLyBpdCB3aXRoIHRoZSBhcmd1bWVudHMgc3VwcGxpZWQuXG4gIF8uZGVsYXkgPSBmdW5jdGlvbihmdW5jLCB3YWl0KSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKXsgcmV0dXJuIGZ1bmMuYXBwbHkobnVsbCwgYXJncyk7IH0sIHdhaXQpO1xuICB9O1xuXG4gIC8vIERlZmVycyBhIGZ1bmN0aW9uLCBzY2hlZHVsaW5nIGl0IHRvIHJ1biBhZnRlciB0aGUgY3VycmVudCBjYWxsIHN0YWNrIGhhc1xuICAvLyBjbGVhcmVkLlxuICBfLmRlZmVyID0gZnVuY3Rpb24oZnVuYykge1xuICAgIHJldHVybiBfLmRlbGF5LmFwcGx5KF8sIFtmdW5jLCAxXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSk7XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCB0aGF0LCB3aGVuIGludm9rZWQsIHdpbGwgb25seSBiZSB0cmlnZ2VyZWQgYXQgbW9zdCBvbmNlXG4gIC8vIGR1cmluZyBhIGdpdmVuIHdpbmRvdyBvZiB0aW1lLiBOb3JtYWxseSwgdGhlIHRocm90dGxlZCBmdW5jdGlvbiB3aWxsIHJ1blxuICAvLyBhcyBtdWNoIGFzIGl0IGNhbiwgd2l0aG91dCBldmVyIGdvaW5nIG1vcmUgdGhhbiBvbmNlIHBlciBgd2FpdGAgZHVyYXRpb247XG4gIC8vIGJ1dCBpZiB5b3UnZCBsaWtlIHRvIGRpc2FibGUgdGhlIGV4ZWN1dGlvbiBvbiB0aGUgbGVhZGluZyBlZGdlLCBwYXNzXG4gIC8vIGB7bGVhZGluZzogZmFsc2V9YC4gVG8gZGlzYWJsZSBleGVjdXRpb24gb24gdGhlIHRyYWlsaW5nIGVkZ2UsIGRpdHRvLlxuICBfLnRocm90dGxlID0gZnVuY3Rpb24oZnVuYywgd2FpdCwgb3B0aW9ucykge1xuICAgIHZhciBjb250ZXh0LCBhcmdzLCByZXN1bHQ7XG4gICAgdmFyIHRpbWVvdXQgPSBudWxsO1xuICAgIHZhciBwcmV2aW91cyA9IDA7XG4gICAgb3B0aW9ucyB8fCAob3B0aW9ucyA9IHt9KTtcbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHByZXZpb3VzID0gb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSA/IDAgOiBuZXcgRGF0ZTtcbiAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB9O1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBub3cgPSBuZXcgRGF0ZTtcbiAgICAgIGlmICghcHJldmlvdXMgJiYgb3B0aW9ucy5sZWFkaW5nID09PSBmYWxzZSkgcHJldmlvdXMgPSBub3c7XG4gICAgICB2YXIgcmVtYWluaW5nID0gd2FpdCAtIChub3cgLSBwcmV2aW91cyk7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBpZiAocmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgcHJldmlvdXMgPSBub3c7XG4gICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICB9IGVsc2UgaWYgKCF0aW1lb3V0ICYmIG9wdGlvbnMudHJhaWxpbmcgIT09IGZhbHNlKSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCByZW1haW5pbmcpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgYXMgbG9uZyBhcyBpdCBjb250aW51ZXMgdG8gYmUgaW52b2tlZCwgd2lsbCBub3RcbiAgLy8gYmUgdHJpZ2dlcmVkLiBUaGUgZnVuY3Rpb24gd2lsbCBiZSBjYWxsZWQgYWZ0ZXIgaXQgc3RvcHMgYmVpbmcgY2FsbGVkIGZvclxuICAvLyBOIG1pbGxpc2Vjb25kcy4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0cmlnZ2VyIHRoZSBmdW5jdGlvbiBvbiB0aGVcbiAgLy8gbGVhZGluZyBlZGdlLCBpbnN0ZWFkIG9mIHRoZSB0cmFpbGluZy5cbiAgXy5kZWJvdW5jZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIGltbWVkaWF0ZSkge1xuICAgIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXAsIHJlc3VsdDtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpO1xuICAgICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBsYXN0ID0gKG5ldyBEYXRlKCkpIC0gdGltZXN0YW1wO1xuICAgICAgICBpZiAobGFzdCA8IHdhaXQpIHtcbiAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgIGlmICghaW1tZWRpYXRlKSByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIGNhbGxOb3cgPSBpbW1lZGlhdGUgJiYgIXRpbWVvdXQ7XG4gICAgICBpZiAoIXRpbWVvdXQpIHtcbiAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgICAgfVxuICAgICAgaWYgKGNhbGxOb3cpIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBleGVjdXRlZCBhdCBtb3N0IG9uZSB0aW1lLCBubyBtYXR0ZXIgaG93XG4gIC8vIG9mdGVuIHlvdSBjYWxsIGl0LiBVc2VmdWwgZm9yIGxhenkgaW5pdGlhbGl6YXRpb24uXG4gIF8ub25jZSA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICB2YXIgcmFuID0gZmFsc2UsIG1lbW87XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKHJhbikgcmV0dXJuIG1lbW87XG4gICAgICByYW4gPSB0cnVlO1xuICAgICAgbWVtbyA9IGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIGZ1bmMgPSBudWxsO1xuICAgICAgcmV0dXJuIG1lbW87XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIHRoZSBmaXJzdCBmdW5jdGlvbiBwYXNzZWQgYXMgYW4gYXJndW1lbnQgdG8gdGhlIHNlY29uZCxcbiAgLy8gYWxsb3dpbmcgeW91IHRvIGFkanVzdCBhcmd1bWVudHMsIHJ1biBjb2RlIGJlZm9yZSBhbmQgYWZ0ZXIsIGFuZFxuICAvLyBjb25kaXRpb25hbGx5IGV4ZWN1dGUgdGhlIG9yaWdpbmFsIGZ1bmN0aW9uLlxuICBfLndyYXAgPSBmdW5jdGlvbihmdW5jLCB3cmFwcGVyKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBbZnVuY107XG4gICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICByZXR1cm4gd3JhcHBlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGlzIHRoZSBjb21wb3NpdGlvbiBvZiBhIGxpc3Qgb2YgZnVuY3Rpb25zLCBlYWNoXG4gIC8vIGNvbnN1bWluZyB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmdW5jdGlvbiB0aGF0IGZvbGxvd3MuXG4gIF8uY29tcG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cztcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgIGZvciAodmFyIGkgPSBmdW5jcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICBhcmdzID0gW2Z1bmNzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBhcmdzWzBdO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIGFmdGVyIGJlaW5nIGNhbGxlZCBOIHRpbWVzLlxuICBfLmFmdGVyID0gZnVuY3Rpb24odGltZXMsIGZ1bmMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS10aW1lcyA8IDEpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9O1xuICB9O1xuXG4gIC8vIE9iamVjdCBGdW5jdGlvbnNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJldHJpZXZlIHRoZSBuYW1lcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgT2JqZWN0LmtleXNgXG4gIF8ua2V5cyA9IG5hdGl2ZUtleXMgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiAhPT0gT2JqZWN0KG9iaikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgb2JqZWN0Jyk7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbiAgfTtcblxuICAvLyBSZXRyaWV2ZSB0aGUgdmFsdWVzIG9mIGFuIG9iamVjdCdzIHByb3BlcnRpZXMuXG4gIF8udmFsdWVzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGtleXMgPSBfLmtleXMob2JqKTtcbiAgICB2YXIgbGVuZ3RoID0ga2V5cy5sZW5ndGg7XG4gICAgdmFyIHZhbHVlcyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhbHVlc1tpXSA9IG9ialtrZXlzW2ldXTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfTtcblxuICAvLyBDb252ZXJ0IGFuIG9iamVjdCBpbnRvIGEgbGlzdCBvZiBgW2tleSwgdmFsdWVdYCBwYWlycy5cbiAgXy5wYWlycyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciBwYWlycyA9IG5ldyBBcnJheShsZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHBhaXJzW2ldID0gW2tleXNbaV0sIG9ialtrZXlzW2ldXV07XG4gICAgfVxuICAgIHJldHVybiBwYWlycztcbiAgfTtcblxuICAvLyBJbnZlcnQgdGhlIGtleXMgYW5kIHZhbHVlcyBvZiBhbiBvYmplY3QuIFRoZSB2YWx1ZXMgbXVzdCBiZSBzZXJpYWxpemFibGUuXG4gIF8uaW52ZXJ0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIHJlc3VsdFtvYmpba2V5c1tpXV1dID0ga2V5c1tpXTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBzb3J0ZWQgbGlzdCBvZiB0aGUgZnVuY3Rpb24gbmFtZXMgYXZhaWxhYmxlIG9uIHRoZSBvYmplY3QuXG4gIC8vIEFsaWFzZWQgYXMgYG1ldGhvZHNgXG4gIF8uZnVuY3Rpb25zID0gXy5tZXRob2RzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIG5hbWVzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKF8uaXNGdW5jdGlvbihvYmpba2V5XSkpIG5hbWVzLnB1c2goa2V5KTtcbiAgICB9XG4gICAgcmV0dXJuIG5hbWVzLnNvcnQoKTtcbiAgfTtcblxuICAvLyBFeHRlbmQgYSBnaXZlbiBvYmplY3Qgd2l0aCBhbGwgdGhlIHByb3BlcnRpZXMgaW4gcGFzc2VkLWluIG9iamVjdChzKS5cbiAgXy5leHRlbmQgPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSBjb3B5IG9mIHRoZSBvYmplY3Qgb25seSBjb250YWluaW5nIHRoZSB3aGl0ZWxpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLnBpY2sgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgY29weSA9IHt9O1xuICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgZWFjaChrZXlzLCBmdW5jdGlvbihrZXkpIHtcbiAgICAgIGlmIChrZXkgaW4gb2JqKSBjb3B5W2tleV0gPSBvYmpba2V5XTtcbiAgICB9KTtcbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IHdpdGhvdXQgdGhlIGJsYWNrbGlzdGVkIHByb3BlcnRpZXMuXG4gIF8ub21pdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBjb3B5ID0ge307XG4gICAgdmFyIGtleXMgPSBjb25jYXQuYXBwbHkoQXJyYXlQcm90bywgc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICBpZiAoIV8uY29udGFpbnMoa2V5cywga2V5KSkgY29weVtrZXldID0gb2JqW2tleV07XG4gICAgfVxuICAgIHJldHVybiBjb3B5O1xuICB9O1xuXG4gIC8vIEZpbGwgaW4gYSBnaXZlbiBvYmplY3Qgd2l0aCBkZWZhdWx0IHByb3BlcnRpZXMuXG4gIF8uZGVmYXVsdHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSwgZnVuY3Rpb24oc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlKSB7XG4gICAgICAgIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgICAgICAgaWYgKG9ialtwcm9wXSA9PT0gdm9pZCAwKSBvYmpbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb2JqO1xuICB9O1xuXG4gIC8vIENyZWF0ZSBhIChzaGFsbG93LWNsb25lZCkgZHVwbGljYXRlIG9mIGFuIG9iamVjdC5cbiAgXy5jbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmICghXy5pc09iamVjdChvYmopKSByZXR1cm4gb2JqO1xuICAgIHJldHVybiBfLmlzQXJyYXkob2JqKSA/IG9iai5zbGljZSgpIDogXy5leHRlbmQoe30sIG9iaik7XG4gIH07XG5cbiAgLy8gSW52b2tlcyBpbnRlcmNlcHRvciB3aXRoIHRoZSBvYmosIGFuZCB0aGVuIHJldHVybnMgb2JqLlxuICAvLyBUaGUgcHJpbWFyeSBwdXJwb3NlIG9mIHRoaXMgbWV0aG9kIGlzIHRvIFwidGFwIGludG9cIiBhIG1ldGhvZCBjaGFpbiwgaW5cbiAgLy8gb3JkZXIgdG8gcGVyZm9ybSBvcGVyYXRpb25zIG9uIGludGVybWVkaWF0ZSByZXN1bHRzIHdpdGhpbiB0aGUgY2hhaW4uXG4gIF8udGFwID0gZnVuY3Rpb24ob2JqLCBpbnRlcmNlcHRvcikge1xuICAgIGludGVyY2VwdG9yKG9iaik7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBJbnRlcm5hbCByZWN1cnNpdmUgY29tcGFyaXNvbiBmdW5jdGlvbiBmb3IgYGlzRXF1YWxgLlxuICB2YXIgZXEgPSBmdW5jdGlvbihhLCBiLCBhU3RhY2ssIGJTdGFjaykge1xuICAgIC8vIElkZW50aWNhbCBvYmplY3RzIGFyZSBlcXVhbC4gYDAgPT09IC0wYCwgYnV0IHRoZXkgYXJlbid0IGlkZW50aWNhbC5cbiAgICAvLyBTZWUgdGhlIFtIYXJtb255IGBlZ2FsYCBwcm9wb3NhbF0oaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9aGFybW9ueTplZ2FsKS5cbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIGEgIT09IDAgfHwgMSAvIGEgPT0gMSAvIGI7XG4gICAgLy8gQSBzdHJpY3QgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkgYmVjYXVzZSBgbnVsbCA9PSB1bmRlZmluZWRgLlxuICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSByZXR1cm4gYSA9PT0gYjtcbiAgICAvLyBVbndyYXAgYW55IHdyYXBwZWQgb2JqZWN0cy5cbiAgICBpZiAoYSBpbnN0YW5jZW9mIF8pIGEgPSBhLl93cmFwcGVkO1xuICAgIGlmIChiIGluc3RhbmNlb2YgXykgYiA9IGIuX3dyYXBwZWQ7XG4gICAgLy8gQ29tcGFyZSBgW1tDbGFzc11dYCBuYW1lcy5cbiAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbChhKTtcbiAgICBpZiAoY2xhc3NOYW1lICE9IHRvU3RyaW5nLmNhbGwoYikpIHJldHVybiBmYWxzZTtcbiAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xuICAgICAgLy8gU3RyaW5ncywgbnVtYmVycywgZGF0ZXMsIGFuZCBib29sZWFucyBhcmUgY29tcGFyZWQgYnkgdmFsdWUuXG4gICAgICBjYXNlICdbb2JqZWN0IFN0cmluZ10nOlxuICAgICAgICAvLyBQcmltaXRpdmVzIGFuZCB0aGVpciBjb3JyZXNwb25kaW5nIG9iamVjdCB3cmFwcGVycyBhcmUgZXF1aXZhbGVudDsgdGh1cywgYFwiNVwiYCBpc1xuICAgICAgICAvLyBlcXVpdmFsZW50IHRvIGBuZXcgU3RyaW5nKFwiNVwiKWAuXG4gICAgICAgIHJldHVybiBhID09IFN0cmluZyhiKTtcbiAgICAgIGNhc2UgJ1tvYmplY3QgTnVtYmVyXSc6XG4gICAgICAgIC8vIGBOYU5gcyBhcmUgZXF1aXZhbGVudCwgYnV0IG5vbi1yZWZsZXhpdmUuIEFuIGBlZ2FsYCBjb21wYXJpc29uIGlzIHBlcmZvcm1lZCBmb3JcbiAgICAgICAgLy8gb3RoZXIgbnVtZXJpYyB2YWx1ZXMuXG4gICAgICAgIHJldHVybiBhICE9ICthID8gYiAhPSArYiA6IChhID09IDAgPyAxIC8gYSA9PSAxIC8gYiA6IGEgPT0gK2IpO1xuICAgICAgY2FzZSAnW29iamVjdCBEYXRlXSc6XG4gICAgICBjYXNlICdbb2JqZWN0IEJvb2xlYW5dJzpcbiAgICAgICAgLy8gQ29lcmNlIGRhdGVzIGFuZCBib29sZWFucyB0byBudW1lcmljIHByaW1pdGl2ZSB2YWx1ZXMuIERhdGVzIGFyZSBjb21wYXJlZCBieSB0aGVpclxuICAgICAgICAvLyBtaWxsaXNlY29uZCByZXByZXNlbnRhdGlvbnMuIE5vdGUgdGhhdCBpbnZhbGlkIGRhdGVzIHdpdGggbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zXG4gICAgICAgIC8vIG9mIGBOYU5gIGFyZSBub3QgZXF1aXZhbGVudC5cbiAgICAgICAgcmV0dXJuICthID09ICtiO1xuICAgICAgLy8gUmVnRXhwcyBhcmUgY29tcGFyZWQgYnkgdGhlaXIgc291cmNlIHBhdHRlcm5zIGFuZCBmbGFncy5cbiAgICAgIGNhc2UgJ1tvYmplY3QgUmVnRXhwXSc6XG4gICAgICAgIHJldHVybiBhLnNvdXJjZSA9PSBiLnNvdXJjZSAmJlxuICAgICAgICAgICAgICAgYS5nbG9iYWwgPT0gYi5nbG9iYWwgJiZcbiAgICAgICAgICAgICAgIGEubXVsdGlsaW5lID09IGIubXVsdGlsaW5lICYmXG4gICAgICAgICAgICAgICBhLmlnbm9yZUNhc2UgPT0gYi5pZ25vcmVDYXNlO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGEgIT0gJ29iamVjdCcgfHwgdHlwZW9mIGIgIT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICAvLyBBc3N1bWUgZXF1YWxpdHkgZm9yIGN5Y2xpYyBzdHJ1Y3R1cmVzLiBUaGUgYWxnb3JpdGhtIGZvciBkZXRlY3RpbmcgY3ljbGljXG4gICAgLy8gc3RydWN0dXJlcyBpcyBhZGFwdGVkIGZyb20gRVMgNS4xIHNlY3Rpb24gMTUuMTIuMywgYWJzdHJhY3Qgb3BlcmF0aW9uIGBKT2AuXG4gICAgdmFyIGxlbmd0aCA9IGFTdGFjay5sZW5ndGg7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICAvLyBMaW5lYXIgc2VhcmNoLiBQZXJmb3JtYW5jZSBpcyBpbnZlcnNlbHkgcHJvcG9ydGlvbmFsIHRvIHRoZSBudW1iZXIgb2ZcbiAgICAgIC8vIHVuaXF1ZSBuZXN0ZWQgc3RydWN0dXJlcy5cbiAgICAgIGlmIChhU3RhY2tbbGVuZ3RoXSA9PSBhKSByZXR1cm4gYlN0YWNrW2xlbmd0aF0gPT0gYjtcbiAgICB9XG4gICAgLy8gT2JqZWN0cyB3aXRoIGRpZmZlcmVudCBjb25zdHJ1Y3RvcnMgYXJlIG5vdCBlcXVpdmFsZW50LCBidXQgYE9iamVjdGBzXG4gICAgLy8gZnJvbSBkaWZmZXJlbnQgZnJhbWVzIGFyZS5cbiAgICB2YXIgYUN0b3IgPSBhLmNvbnN0cnVjdG9yLCBiQ3RvciA9IGIuY29uc3RydWN0b3I7XG4gICAgaWYgKGFDdG9yICE9PSBiQ3RvciAmJiAhKF8uaXNGdW5jdGlvbihhQ3RvcikgJiYgKGFDdG9yIGluc3RhbmNlb2YgYUN0b3IpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uaXNGdW5jdGlvbihiQ3RvcikgJiYgKGJDdG9yIGluc3RhbmNlb2YgYkN0b3IpKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICAvLyBBZGQgdGhlIGZpcnN0IG9iamVjdCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHMuXG4gICAgYVN0YWNrLnB1c2goYSk7XG4gICAgYlN0YWNrLnB1c2goYik7XG4gICAgdmFyIHNpemUgPSAwLCByZXN1bHQgPSB0cnVlO1xuICAgIC8vIFJlY3Vyc2l2ZWx5IGNvbXBhcmUgb2JqZWN0cyBhbmQgYXJyYXlzLlxuICAgIGlmIChjbGFzc05hbWUgPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgLy8gQ29tcGFyZSBhcnJheSBsZW5ndGhzIHRvIGRldGVybWluZSBpZiBhIGRlZXAgY29tcGFyaXNvbiBpcyBuZWNlc3NhcnkuXG4gICAgICBzaXplID0gYS5sZW5ndGg7XG4gICAgICByZXN1bHQgPSBzaXplID09IGIubGVuZ3RoO1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAvLyBEZWVwIGNvbXBhcmUgdGhlIGNvbnRlbnRzLCBpZ25vcmluZyBub24tbnVtZXJpYyBwcm9wZXJ0aWVzLlxuICAgICAgICB3aGlsZSAoc2l6ZS0tKSB7XG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gZXEoYVtzaXplXSwgYltzaXplXSwgYVN0YWNrLCBiU3RhY2spKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRGVlcCBjb21wYXJlIG9iamVjdHMuXG4gICAgICBmb3IgKHZhciBrZXkgaW4gYSkge1xuICAgICAgICBpZiAoXy5oYXMoYSwga2V5KSkge1xuICAgICAgICAgIC8vIENvdW50IHRoZSBleHBlY3RlZCBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgICAgICBzaXplKys7XG4gICAgICAgICAgLy8gRGVlcCBjb21wYXJlIGVhY2ggbWVtYmVyLlxuICAgICAgICAgIGlmICghKHJlc3VsdCA9IF8uaGFzKGIsIGtleSkgJiYgZXEoYVtrZXldLCBiW2tleV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBFbnN1cmUgdGhhdCBib3RoIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBudW1iZXIgb2YgcHJvcGVydGllcy5cbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgZm9yIChrZXkgaW4gYikge1xuICAgICAgICAgIGlmIChfLmhhcyhiLCBrZXkpICYmICEoc2l6ZS0tKSkgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0ID0gIXNpemU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIFJlbW92ZSB0aGUgZmlyc3Qgb2JqZWN0IGZyb20gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wb3AoKTtcbiAgICBiU3RhY2sucG9wKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcblxuICAvLyBQZXJmb3JtIGEgZGVlcCBjb21wYXJpc29uIHRvIGNoZWNrIGlmIHR3byBvYmplY3RzIGFyZSBlcXVhbC5cbiAgXy5pc0VxdWFsID0gZnVuY3Rpb24oYSwgYikge1xuICAgIHJldHVybiBlcShhLCBiLCBbXSwgW10pO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gYXJyYXksIHN0cmluZywgb3Igb2JqZWN0IGVtcHR5P1xuICAvLyBBbiBcImVtcHR5XCIgb2JqZWN0IGhhcyBubyBlbnVtZXJhYmxlIG93bi1wcm9wZXJ0aWVzLlxuICBfLmlzRW1wdHkgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAob2JqID09IG51bGwpIHJldHVybiB0cnVlO1xuICAgIGlmIChfLmlzQXJyYXkob2JqKSB8fCBfLmlzU3RyaW5nKG9iaikpIHJldHVybiBvYmoubGVuZ3RoID09PSAwO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIGlmIChfLmhhcyhvYmosIGtleSkpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGEgRE9NIGVsZW1lbnQ/XG4gIF8uaXNFbGVtZW50ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuICEhKG9iaiAmJiBvYmoubm9kZVR5cGUgPT09IDEpO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYW4gYXJyYXk/XG4gIC8vIERlbGVnYXRlcyB0byBFQ01BNSdzIG5hdGl2ZSBBcnJheS5pc0FycmF5XG4gIF8uaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBBcnJheV0nO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgYW4gb2JqZWN0P1xuICBfLmlzT2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gT2JqZWN0KG9iaik7XG4gIH07XG5cbiAgLy8gQWRkIHNvbWUgaXNUeXBlIG1ldGhvZHM6IGlzQXJndW1lbnRzLCBpc0Z1bmN0aW9uLCBpc1N0cmluZywgaXNOdW1iZXIsIGlzRGF0ZSwgaXNSZWdFeHAuXG4gIGVhY2goWydBcmd1bWVudHMnLCAnRnVuY3Rpb24nLCAnU3RyaW5nJywgJ051bWJlcicsICdEYXRlJywgJ1JlZ0V4cCddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgX1snaXMnICsgbmFtZV0gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgJyArIG5hbWUgKyAnXSc7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gRGVmaW5lIGEgZmFsbGJhY2sgdmVyc2lvbiBvZiB0aGUgbWV0aG9kIGluIGJyb3dzZXJzIChhaGVtLCBJRSksIHdoZXJlXG4gIC8vIHRoZXJlIGlzbid0IGFueSBpbnNwZWN0YWJsZSBcIkFyZ3VtZW50c1wiIHR5cGUuXG4gIGlmICghXy5pc0FyZ3VtZW50cyhhcmd1bWVudHMpKSB7XG4gICAgXy5pc0FyZ3VtZW50cyA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuICEhKG9iaiAmJiBfLmhhcyhvYmosICdjYWxsZWUnKSk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIE9wdGltaXplIGBpc0Z1bmN0aW9uYCBpZiBhcHByb3ByaWF0ZS5cbiAgaWYgKHR5cGVvZiAoLy4vKSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIF8uaXNGdW5jdGlvbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbic7XG4gICAgfTtcbiAgfVxuXG4gIC8vIElzIGEgZ2l2ZW4gb2JqZWN0IGEgZmluaXRlIG51bWJlcj9cbiAgXy5pc0Zpbml0ZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBpc0Zpbml0ZShvYmopICYmICFpc05hTihwYXJzZUZsb2F0KG9iaikpO1xuICB9O1xuXG4gIC8vIElzIHRoZSBnaXZlbiB2YWx1ZSBgTmFOYD8gKE5hTiBpcyB0aGUgb25seSBudW1iZXIgd2hpY2ggZG9lcyBub3QgZXF1YWwgaXRzZWxmKS5cbiAgXy5pc05hTiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBfLmlzTnVtYmVyKG9iaikgJiYgb2JqICE9ICtvYmo7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIGJvb2xlYW4/XG4gIF8uaXNCb29sZWFuID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdHJ1ZSB8fCBvYmogPT09IGZhbHNlIHx8IHRvU3RyaW5nLmNhbGwob2JqKSA9PSAnW29iamVjdCBCb29sZWFuXSc7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBlcXVhbCB0byBudWxsP1xuICBfLmlzTnVsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IG51bGw7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YXJpYWJsZSB1bmRlZmluZWQ/XG4gIF8uaXNVbmRlZmluZWQgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSB2b2lkIDA7XG4gIH07XG5cbiAgLy8gU2hvcnRjdXQgZnVuY3Rpb24gZm9yIGNoZWNraW5nIGlmIGFuIG9iamVjdCBoYXMgYSBnaXZlbiBwcm9wZXJ0eSBkaXJlY3RseVxuICAvLyBvbiBpdHNlbGYgKGluIG90aGVyIHdvcmRzLCBub3Qgb24gYSBwcm90b3R5cGUpLlxuICBfLmhhcyA9IGZ1bmN0aW9uKG9iaiwga2V5KSB7XG4gICAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xuICB9O1xuXG4gIC8vIFV0aWxpdHkgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gUnVuIFVuZGVyc2NvcmUuanMgaW4gKm5vQ29uZmxpY3QqIG1vZGUsIHJldHVybmluZyB0aGUgYF9gIHZhcmlhYmxlIHRvIGl0c1xuICAvLyBwcmV2aW91cyBvd25lci4gUmV0dXJucyBhIHJlZmVyZW5jZSB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubm9Db25mbGljdCA9IGZ1bmN0aW9uKCkge1xuICAgIHJvb3QuXyA9IHByZXZpb3VzVW5kZXJzY29yZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvLyBLZWVwIHRoZSBpZGVudGl0eSBmdW5jdGlvbiBhcm91bmQgZm9yIGRlZmF1bHQgaXRlcmF0b3JzLlxuICBfLmlkZW50aXR5ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG5cbiAgLy8gUnVuIGEgZnVuY3Rpb24gKipuKiogdGltZXMuXG4gIF8udGltZXMgPSBmdW5jdGlvbihuLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciBhY2N1bSA9IEFycmF5KE1hdGgubWF4KDAsIG4pKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG47IGkrKykgYWNjdW1baV0gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIGkpO1xuICAgIHJldHVybiBhY2N1bTtcbiAgfTtcblxuICAvLyBSZXR1cm4gYSByYW5kb20gaW50ZWdlciBiZXR3ZWVuIG1pbiBhbmQgbWF4IChpbmNsdXNpdmUpLlxuICBfLnJhbmRvbSA9IGZ1bmN0aW9uKG1pbiwgbWF4KSB7XG4gICAgaWYgKG1heCA9PSBudWxsKSB7XG4gICAgICBtYXggPSBtaW47XG4gICAgICBtaW4gPSAwO1xuICAgIH1cbiAgICByZXR1cm4gbWluICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKTtcbiAgfTtcblxuICAvLyBMaXN0IG9mIEhUTUwgZW50aXRpZXMgZm9yIGVzY2FwaW5nLlxuICB2YXIgZW50aXR5TWFwID0ge1xuICAgIGVzY2FwZToge1xuICAgICAgJyYnOiAnJmFtcDsnLFxuICAgICAgJzwnOiAnJmx0OycsXG4gICAgICAnPic6ICcmZ3Q7JyxcbiAgICAgICdcIic6ICcmcXVvdDsnLFxuICAgICAgXCInXCI6ICcmI3gyNzsnXG4gICAgfVxuICB9O1xuICBlbnRpdHlNYXAudW5lc2NhcGUgPSBfLmludmVydChlbnRpdHlNYXAuZXNjYXBlKTtcblxuICAvLyBSZWdleGVzIGNvbnRhaW5pbmcgdGhlIGtleXMgYW5kIHZhbHVlcyBsaXN0ZWQgaW1tZWRpYXRlbHkgYWJvdmUuXG4gIHZhciBlbnRpdHlSZWdleGVzID0ge1xuICAgIGVzY2FwZTogICBuZXcgUmVnRXhwKCdbJyArIF8ua2V5cyhlbnRpdHlNYXAuZXNjYXBlKS5qb2luKCcnKSArICddJywgJ2cnKSxcbiAgICB1bmVzY2FwZTogbmV3IFJlZ0V4cCgnKCcgKyBfLmtleXMoZW50aXR5TWFwLnVuZXNjYXBlKS5qb2luKCd8JykgKyAnKScsICdnJylcbiAgfTtcblxuICAvLyBGdW5jdGlvbnMgZm9yIGVzY2FwaW5nIGFuZCB1bmVzY2FwaW5nIHN0cmluZ3MgdG8vZnJvbSBIVE1MIGludGVycG9sYXRpb24uXG4gIF8uZWFjaChbJ2VzY2FwZScsICd1bmVzY2FwZSddLCBmdW5jdGlvbihtZXRob2QpIHtcbiAgICBfW21ldGhvZF0gPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgIGlmIChzdHJpbmcgPT0gbnVsbCkgcmV0dXJuICcnO1xuICAgICAgcmV0dXJuICgnJyArIHN0cmluZykucmVwbGFjZShlbnRpdHlSZWdleGVzW21ldGhvZF0sIGZ1bmN0aW9uKG1hdGNoKSB7XG4gICAgICAgIHJldHVybiBlbnRpdHlNYXBbbWV0aG9kXVttYXRjaF07XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICAvLyBJZiB0aGUgdmFsdWUgb2YgdGhlIG5hbWVkIGBwcm9wZXJ0eWAgaXMgYSBmdW5jdGlvbiB0aGVuIGludm9rZSBpdCB3aXRoIHRoZVxuICAvLyBgb2JqZWN0YCBhcyBjb250ZXh0OyBvdGhlcndpc2UsIHJldHVybiBpdC5cbiAgXy5yZXN1bHQgPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7XG4gICAgaWYgKG9iamVjdCA9PSBudWxsKSByZXR1cm4gdm9pZCAwO1xuICAgIHZhciB2YWx1ZSA9IG9iamVjdFtwcm9wZXJ0eV07XG4gICAgcmV0dXJuIF8uaXNGdW5jdGlvbih2YWx1ZSkgPyB2YWx1ZS5jYWxsKG9iamVjdCkgOiB2YWx1ZTtcbiAgfTtcblxuICAvLyBBZGQgeW91ciBvd24gY3VzdG9tIGZ1bmN0aW9ucyB0byB0aGUgVW5kZXJzY29yZSBvYmplY3QuXG4gIF8ubWl4aW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICBlYWNoKF8uZnVuY3Rpb25zKG9iaiksIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHZhciBmdW5jID0gX1tuYW1lXSA9IG9ialtuYW1lXTtcbiAgICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gW3RoaXMuX3dyYXBwZWRdO1xuICAgICAgICBwdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBmdW5jLmFwcGx5KF8sIGFyZ3MpKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gR2VuZXJhdGUgYSB1bmlxdWUgaW50ZWdlciBpZCAodW5pcXVlIHdpdGhpbiB0aGUgZW50aXJlIGNsaWVudCBzZXNzaW9uKS5cbiAgLy8gVXNlZnVsIGZvciB0ZW1wb3JhcnkgRE9NIGlkcy5cbiAgdmFyIGlkQ291bnRlciA9IDA7XG4gIF8udW5pcXVlSWQgPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICB2YXIgaWQgPSArK2lkQ291bnRlciArICcnO1xuICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICB9O1xuXG4gIC8vIEJ5IGRlZmF1bHQsIFVuZGVyc2NvcmUgdXNlcyBFUkItc3R5bGUgdGVtcGxhdGUgZGVsaW1pdGVycywgY2hhbmdlIHRoZVxuICAvLyBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlIGRlbGltaXRlcnMuXG4gIF8udGVtcGxhdGVTZXR0aW5ncyA9IHtcbiAgICBldmFsdWF0ZSAgICA6IC88JShbXFxzXFxTXSs/KSU+L2csXG4gICAgaW50ZXJwb2xhdGUgOiAvPCU9KFtcXHNcXFNdKz8pJT4vZyxcbiAgICBlc2NhcGUgICAgICA6IC88JS0oW1xcc1xcU10rPyklPi9nXG4gIH07XG5cbiAgLy8gV2hlbiBjdXN0b21pemluZyBgdGVtcGxhdGVTZXR0aW5nc2AsIGlmIHlvdSBkb24ndCB3YW50IHRvIGRlZmluZSBhblxuICAvLyBpbnRlcnBvbGF0aW9uLCBldmFsdWF0aW9uIG9yIGVzY2FwaW5nIHJlZ2V4LCB3ZSBuZWVkIG9uZSB0aGF0IGlzXG4gIC8vIGd1YXJhbnRlZWQgbm90IHRvIG1hdGNoLlxuICB2YXIgbm9NYXRjaCA9IC8oLileLztcblxuICAvLyBDZXJ0YWluIGNoYXJhY3RlcnMgbmVlZCB0byBiZSBlc2NhcGVkIHNvIHRoYXQgdGhleSBjYW4gYmUgcHV0IGludG8gYVxuICAvLyBzdHJpbmcgbGl0ZXJhbC5cbiAgdmFyIGVzY2FwZXMgPSB7XG4gICAgXCInXCI6ICAgICAgXCInXCIsXG4gICAgJ1xcXFwnOiAgICAgJ1xcXFwnLFxuICAgICdcXHInOiAgICAgJ3InLFxuICAgICdcXG4nOiAgICAgJ24nLFxuICAgICdcXHQnOiAgICAgJ3QnLFxuICAgICdcXHUyMDI4JzogJ3UyMDI4JyxcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcbiAgfTtcblxuICB2YXIgZXNjYXBlciA9IC9cXFxcfCd8XFxyfFxcbnxcXHR8XFx1MjAyOHxcXHUyMDI5L2c7XG5cbiAgLy8gSmF2YVNjcmlwdCBtaWNyby10ZW1wbGF0aW5nLCBzaW1pbGFyIHRvIEpvaG4gUmVzaWcncyBpbXBsZW1lbnRhdGlvbi5cbiAgLy8gVW5kZXJzY29yZSB0ZW1wbGF0aW5nIGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlcyB3aGl0ZXNwYWNlLFxuICAvLyBhbmQgY29ycmVjdGx5IGVzY2FwZXMgcXVvdGVzIHdpdGhpbiBpbnRlcnBvbGF0ZWQgY29kZS5cbiAgXy50ZW1wbGF0ZSA9IGZ1bmN0aW9uKHRleHQsIGRhdGEsIHNldHRpbmdzKSB7XG4gICAgdmFyIHJlbmRlcjtcbiAgICBzZXR0aW5ncyA9IF8uZGVmYXVsdHMoe30sIHNldHRpbmdzLCBfLnRlbXBsYXRlU2V0dGluZ3MpO1xuXG4gICAgLy8gQ29tYmluZSBkZWxpbWl0ZXJzIGludG8gb25lIHJlZ3VsYXIgZXhwcmVzc2lvbiB2aWEgYWx0ZXJuYXRpb24uXG4gICAgdmFyIG1hdGNoZXIgPSBuZXcgUmVnRXhwKFtcbiAgICAgIChzZXR0aW5ncy5lc2NhcGUgfHwgbm9NYXRjaCkuc291cmNlLFxuICAgICAgKHNldHRpbmdzLmludGVycG9sYXRlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5ldmFsdWF0ZSB8fCBub01hdGNoKS5zb3VyY2VcbiAgICBdLmpvaW4oJ3wnKSArICd8JCcsICdnJyk7XG5cbiAgICAvLyBDb21waWxlIHRoZSB0ZW1wbGF0ZSBzb3VyY2UsIGVzY2FwaW5nIHN0cmluZyBsaXRlcmFscyBhcHByb3ByaWF0ZWx5LlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNvdXJjZSA9IFwiX19wKz0nXCI7XG4gICAgdGV4dC5yZXBsYWNlKG1hdGNoZXIsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGUsIGludGVycG9sYXRlLCBldmFsdWF0ZSwgb2Zmc2V0KSB7XG4gICAgICBzb3VyY2UgKz0gdGV4dC5zbGljZShpbmRleCwgb2Zmc2V0KVxuICAgICAgICAucmVwbGFjZShlc2NhcGVyLCBmdW5jdGlvbihtYXRjaCkgeyByZXR1cm4gJ1xcXFwnICsgZXNjYXBlc1ttYXRjaF07IH0pO1xuXG4gICAgICBpZiAoZXNjYXBlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIicrXFxuKChfX3Q9KFwiICsgZXNjYXBlICsgXCIpKT09bnVsbD8nJzpfLmVzY2FwZShfX3QpKStcXG4nXCI7XG4gICAgICB9XG4gICAgICBpZiAoaW50ZXJwb2xhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJytcXG4oKF9fdD0oXCIgKyBpbnRlcnBvbGF0ZSArIFwiKSk9PW51bGw/Jyc6X190KStcXG4nXCI7XG4gICAgICB9XG4gICAgICBpZiAoZXZhbHVhdGUpIHtcbiAgICAgICAgc291cmNlICs9IFwiJztcXG5cIiArIGV2YWx1YXRlICsgXCJcXG5fX3ArPSdcIjtcbiAgICAgIH1cbiAgICAgIGluZGV4ID0gb2Zmc2V0ICsgbWF0Y2gubGVuZ3RoO1xuICAgICAgcmV0dXJuIG1hdGNoO1xuICAgIH0pO1xuICAgIHNvdXJjZSArPSBcIic7XFxuXCI7XG5cbiAgICAvLyBJZiBhIHZhcmlhYmxlIGlzIG5vdCBzcGVjaWZpZWQsIHBsYWNlIGRhdGEgdmFsdWVzIGluIGxvY2FsIHNjb3BlLlxuICAgIGlmICghc2V0dGluZ3MudmFyaWFibGUpIHNvdXJjZSA9ICd3aXRoKG9ianx8e30pe1xcbicgKyBzb3VyY2UgKyAnfVxcbic7XG5cbiAgICBzb3VyY2UgPSBcInZhciBfX3QsX19wPScnLF9faj1BcnJheS5wcm90b3R5cGUuam9pbixcIiArXG4gICAgICBcInByaW50PWZ1bmN0aW9uKCl7X19wKz1fX2ouY2FsbChhcmd1bWVudHMsJycpO307XFxuXCIgK1xuICAgICAgc291cmNlICsgXCJyZXR1cm4gX19wO1xcblwiO1xuXG4gICAgdHJ5IHtcbiAgICAgIHJlbmRlciA9IG5ldyBGdW5jdGlvbihzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJywgJ18nLCBzb3VyY2UpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGUuc291cmNlID0gc291cmNlO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YSkgcmV0dXJuIHJlbmRlcihkYXRhLCBfKTtcbiAgICB2YXIgdGVtcGxhdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgICByZXR1cm4gcmVuZGVyLmNhbGwodGhpcywgZGF0YSwgXyk7XG4gICAgfTtcblxuICAgIC8vIFByb3ZpZGUgdGhlIGNvbXBpbGVkIGZ1bmN0aW9uIHNvdXJjZSBhcyBhIGNvbnZlbmllbmNlIGZvciBwcmVjb21waWxhdGlvbi5cbiAgICB0ZW1wbGF0ZS5zb3VyY2UgPSAnZnVuY3Rpb24oJyArIChzZXR0aW5ncy52YXJpYWJsZSB8fCAnb2JqJykgKyAnKXtcXG4nICsgc291cmNlICsgJ30nO1xuXG4gICAgcmV0dXJuIHRlbXBsYXRlO1xuICB9O1xuXG4gIC8vIEFkZCBhIFwiY2hhaW5cIiBmdW5jdGlvbiwgd2hpY2ggd2lsbCBkZWxlZ2F0ZSB0byB0aGUgd3JhcHBlci5cbiAgXy5jaGFpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBfKG9iaikuY2hhaW4oKTtcbiAgfTtcblxuICAvLyBPT1BcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG4gIC8vIElmIFVuZGVyc2NvcmUgaXMgY2FsbGVkIGFzIGEgZnVuY3Rpb24sIGl0IHJldHVybnMgYSB3cmFwcGVkIG9iamVjdCB0aGF0XG4gIC8vIGNhbiBiZSB1c2VkIE9PLXN0eWxlLiBUaGlzIHdyYXBwZXIgaG9sZHMgYWx0ZXJlZCB2ZXJzaW9ucyBvZiBhbGwgdGhlXG4gIC8vIHVuZGVyc2NvcmUgZnVuY3Rpb25zLiBXcmFwcGVkIG9iamVjdHMgbWF5IGJlIGNoYWluZWQuXG5cbiAgLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvbnRpbnVlIGNoYWluaW5nIGludGVybWVkaWF0ZSByZXN1bHRzLlxuICB2YXIgcmVzdWx0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NoYWluID8gXyhvYmopLmNoYWluKCkgOiBvYmo7XG4gIH07XG5cbiAgLy8gQWRkIGFsbCBvZiB0aGUgVW5kZXJzY29yZSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIgb2JqZWN0LlxuICBfLm1peGluKF8pO1xuXG4gIC8vIEFkZCBhbGwgbXV0YXRvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIGVhY2goWydwb3AnLCAncHVzaCcsICdyZXZlcnNlJywgJ3NoaWZ0JywgJ3NvcnQnLCAnc3BsaWNlJywgJ3Vuc2hpZnQnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgb2JqID0gdGhpcy5fd3JhcHBlZDtcbiAgICAgIG1ldGhvZC5hcHBseShvYmosIGFyZ3VtZW50cyk7XG4gICAgICBpZiAoKG5hbWUgPT0gJ3NoaWZ0JyB8fCBuYW1lID09ICdzcGxpY2UnKSAmJiBvYmoubGVuZ3RoID09PSAwKSBkZWxldGUgb2JqWzBdO1xuICAgICAgcmV0dXJuIHJlc3VsdC5jYWxsKHRoaXMsIG9iaik7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gQWRkIGFsbCBhY2Nlc3NvciBBcnJheSBmdW5jdGlvbnMgdG8gdGhlIHdyYXBwZXIuXG4gIGVhY2goWydjb25jYXQnLCAnam9pbicsICdzbGljZSddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIG1ldGhvZCA9IEFycmF5UHJvdG9bbmFtZV07XG4gICAgXy5wcm90b3R5cGVbbmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBtZXRob2QuYXBwbHkodGhpcy5fd3JhcHBlZCwgYXJndW1lbnRzKSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgXy5leHRlbmQoXy5wcm90b3R5cGUsIHtcblxuICAgIC8vIFN0YXJ0IGNoYWluaW5nIGEgd3JhcHBlZCBVbmRlcnNjb3JlIG9iamVjdC5cbiAgICBjaGFpbjogZnVuY3Rpb24oKSB7XG4gICAgICB0aGlzLl9jaGFpbiA9IHRydWU7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLy8gRXh0cmFjdHMgdGhlIHJlc3VsdCBmcm9tIGEgd3JhcHBlZCBhbmQgY2hhaW5lZCBvYmplY3QuXG4gICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3dyYXBwZWQ7XG4gICAgfVxuXG4gIH0pO1xuXG59KS5jYWxsKHRoaXMpO1xuIiwidmFyIGxvZyA9IHJlcXVpcmUoXCJsb2dsZXZlbFwiKSxcbiAgICBfICAgPSByZXF1aXJlKFwidW5kZXJzY29yZVwiKTtcblxuLyoqKiBDYWNoZSAqKiovXG52YXIgc3RhdGVQcmVmaXggPSBcInN0YXRlLVwiLFxuICAgIHN0YXRlUmVnZXggID0gbmV3IFJlZ0V4cChcIl5cIitzdGF0ZVByZWZpeCwgXCJcIiksXG4gICAgbm9vcCA9IGZ1bmN0aW9uKCkge30sXG4gICAgc3RhdGVDbGFzc0ZpbHRlciA9IGZ1bmN0aW9uKGMpIHtcbiAgICAgICAgcmV0dXJuIGMubWF0Y2goc3RhdGVSZWdleCk7XG4gICAgfSxcbiAgICBnZXRTdGF0ZUNsYXNzUmVnZXggPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWdFeHAoXCJeXCIgKyBzdGF0ZVByZWZpeCArIGtleSArIFwiLVwiLCBcIlwiKTtcbiAgICB9O1xuXG4vKioqIFRoZSBDbGFzcyAqKiovXG52YXIgU3RhdGUgPSBmdW5jdGlvbih2aWV3LCBkZWZhdWx0cykge1xuICAgIHRoaXMudmlldyAgICAgICA9IHZpZXc7XG4gICAgdGhpcy5kYXRhICAgICAgID0ge307XG4gICAgdGhpcy5iaW5kaW5ncyAgID0ge307XG4gICAgdGhpcy5saXN0ZW5lcnMgID0ge307XG5cbiAgICB0aGlzLl9zZXREZWZhdWx0cyhkZWZhdWx0cyk7XG59O1xuXG5TdGF0ZS5wcm90b3R5cGUgPSB7XG5cbiAgICAvKioqIEdldHRlcnMgJiBTZXR0ZXJzICoqKi9cbiAgICBzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgICAgLy9WYWxpZGF0ZVxuICAgICAgICBpZigha2V5Lm1hdGNoKC9eW2EtekEtWjAtOVxcLl0rJC8pKSB7XG4gICAgICAgICAgICBsb2cuZXJyb3IoXCJTdGF0ZSBuYW1lICdcIiArIGtleSArIFwiJyBpcyBub3QgYWxwaGFudW1lcmljLlwiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vU2V0XG4gICAgICAgICAgICBpZih0aGlzLmdldChrZXkpICE9IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhW2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXIoa2V5LCB2YWx1ZSk7XG5cbiAgICAgICAgICAgICAgICBpZih2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gZmFsc2UgfHwgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyAmJiB2YWx1ZS5tYXRjaCgvXlthLXpBLVowLTldKyQvKSkpIHtcblxuICAgICAgICAgICAgICAgICAgICB2YXIgY2xhc3NlcyA9IHRoaXMudmlldy5fZ2V0Q2xhc3NlcygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVnZXggICA9IGdldFN0YXRlQ2xhc3NSZWdleChrZXkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaSAgICAgICA9IGNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5lZCA9IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3U3RhdGUgPSBzdGF0ZVByZWZpeCArIGtleSArIFwiLVwiICsgdmFsdWU7XG5cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihjbGFzc2VzW2ldLm1hdGNoKHJlZ2V4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKG5ld1N0YXRlID09IGNsYXNzZXNbaV0pICByZXR1cm4gdGhpczsgLy9Eb24ndCBkbyBhbnl0aGluZyBpZiB0aGVyZSBpcyBubyBjaGFuZ2UgKGVmZmljaWVudCEhISlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3Nlc1tpXSA9IG5ld1N0YXRlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5lZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZighZGVmaW5lZCkgY2xhc3Nlcy5wdXNoKG5ld1N0YXRlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy52aWV3Ll9zZXRDbGFzc2VzKGNsYXNzZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YVtrZXldO1xuICAgIH0sXG4gICAgcmVtb3ZlOiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgaWYodGhpcy5nZXQoa2V5KSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuZGF0YVtrZXldO1xuICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGtleSwgbnVsbCk7XG5cbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gdGhpcy52aWV3Ll9nZXRDbGFzc2VzKCksXG4gICAgICAgICAgICAgICAgbGVuICAgICA9IGNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHJlZ2V4ICAgPSBnZXRTdGF0ZUNsYXNzUmVnZXgoa2V5KTtcblxuICAgICAgICAgICAgY2xhc3NlcyA9IF8ucmVqZWN0KGNsYXNzZXMsIGZ1bmN0aW9uKGMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYy5tYXRjaChyZWdleCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYoY2xhc3Nlcy5sZW5ndGggIT0gbGVuKSB0aGlzLnZpZXcud3JhcHBlci5jbGFzc05hbWUgPSBjbGFzc2VzLmpvaW4oJyAnKTsgLy9Eb24ndCBkbyBhbnl0aGluZyBpZiB0aGVyZSBpcyBubyBjaGFuZ2UgKGVmZmljaWVudCEhISlcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKioqIEV2ZW50IEJpbmRpbmdzICoqKi9cbiAgICBiaW5kOiBmdW5jdGlvbihrZXksIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3Nba2V5XSA9IGNhbGxiYWNrO1xuICAgICAgICByZXR1cm4gY2FsbGJhY2s7XG4gICAgfSxcbiAgICB1bmJpbmQ6IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICBkZWxldGUgdGhpcy5iaW5kaW5nc1trZXldO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZSA9PT0gdW5kZWZpbmVkID8gdGhpcy5nZXQoa2V5KSA6IHZhbHVlO1xuICAgICAgICAodGhpcy5iaW5kaW5nc1trZXldIHx8IG5vb3ApKHZhbHVlKTtcblxuICAgICAgICAvL1RlbGwgYWxsIG9mIHRoZSBsaXN0ZW5pbmcgY2hpbGRyZW5cbiAgICAgICAgdmFyICRjaGlsZHJlbiA9IHRoaXMudmlldy4kd3JhcHBlci5maW5kKCcuJyArIHRoaXMuX2xpc3RlbkNzc1ByZWZpeCArIHRoaXMudmlldy50eXBlICsgJy0nICsga2V5KSxcbiAgICAgICAgICAgIGkgPSAkY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgIHdoaWxlKGktLSkge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gJGNoaWxkcmVuW2ldW3N1YnZpZXcuX2RvbVByb3BlcnR5TmFtZV07XG4gICAgICAgICAgICBjaGlsZC5zdGF0ZS5faGVhcih0aGlzLnZpZXcudHlwZSwga2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG5cbiAgICAvKioqIENvbW11bmljYXRvcnkgR2V0L1NldC9CaW5kICoqKi9cbiAgICAvL1RoZXNlIG1ldGhvZHMgY29tbXVuaWNhdGUgd2l0aCB0aGUgY2xvc2VzdCBwYXJlbnQgb2YgdGhlIGdpdmVuIHR5cGVcbiAgICBhc2tQYXJlbnQ6IGZ1bmN0aW9uKHR5cGUsIGtleSkge1xuICAgICAgICB2YXIgcGFyZW50ID0gdGhpcy52aWV3LiR3cmFwcGVyLmNsb3Nlc3QoJy4nK3RoaXMudmlldy5fdmlld0Nzc1ByZWZpeCArIHR5cGUpWzBdO1xuXG4gICAgICAgIGlmKHBhcmVudCkgIHJldHVybiBwYXJlbnRbc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lXS5zdGF0ZS5nZXQoa2V5KTtcbiAgICAgICAgZWxzZSAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9LFxuICAgIHRlbGxQYXJlbnQ6IGZ1bmN0aW9uKHR5cGUsIGtleSwgdmFsdWUpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IHRoaXMudmlldy4kd3JhcHBlci5jbG9zZXN0KCcuJyt0aGlzLnZpZXcuX3ZpZXdDc3NQcmVmaXggKyB0eXBlKVswXTtcblxuICAgICAgICBpZihwYXJlbnQpIHBhcmVudFtzdWJ2aWV3Ll9kb21Qcm9wZXJ0eU5hbWVdLnN0YXRlLnNldChrZXksIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBfbGlzdGVuQ3NzUHJlZml4OiBcImxpc3Rlbi1cIixcbiAgICBsaXN0ZW46IGZ1bmN0aW9uKHR5cGUsIGtleSwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIGNsYXNzZXMgPSB0aGlzLnZpZXcuX2dldENsYXNzZXMoKTtcbiAgICAgICAgY2xhc3Nlcy5wdXNoKHRoaXMuX2xpc3RlbkNzc1ByZWZpeCt0eXBlK1wiLVwiK2tleSk7XG4gICAgICAgIHRoaXMudmlldy5fc2V0Q2xhc3NlcyhjbGFzc2VzKTtcblxuICAgICAgICB0aGlzLmxpc3RlbmVyc1t0eXBlICsgJy0nICsga2V5XSA9IGNhbGxiYWNrO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIF9oZWFyOiBmdW5jdGlvbih0eXBlLCBrZXksIHZhbHVlKSB7XG4gICAgICAgICh0aGlzLmxpc3RlbmVyc1t0eXBlICsgJy0nICsga2V5XSB8fCBub29wKSh2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cblxuICAgIC8qKiogVXBkYXRlcyBTdGF0ZSBGcm9tIERPTSBDbGFzc2VzICoqKi9cbiAgICBfc2V0RGVmYXVsdHM6IGZ1bmN0aW9uKGRlZmF1bHRzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLmRlZmF1bHRzICAgPSBkZWZhdWx0cyB8fCB0aGlzLmRlZmF1bHRzO1xuICAgICAgICB0aGlzLmRhdGEgICAgICAgPSB7fTtcblxuICAgICAgICBfLmVhY2goXG4gICAgICAgICAgICBfLmV4dGVuZCh0aGlzLmRlZmF1bHRzLCB0aGlzLl9nZXRTdGF0ZUNsYXNzZXMoKSksXG4gICAgICAgICAgICBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKiogU3RhdGUgQ2xhc3MgbWV0aG9kcyAqKiovXG4gICAgX2dldFN0YXRlQ2xhc3NlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjbGFzc2VzID0gdGhpcy52aWV3Ll9nZXRDbGFzc2VzKCksXG4gICAgICAgICAgICBpID0gY2xhc3Nlcy5sZW5ndGgsXG4gICAgICAgICAgICBkYXRhID0ge307XG5cbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICB2YXIgYyA9IGNsYXNzZXNbaV07XG5cbiAgICAgICAgICAgIGlmKGMubWF0Y2goc3RhdGVSZWdleCkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFydHMgPSBjLnNwbGl0KCctJyk7XG4gICAgICAgICAgICAgICAgaWYocGFydHMubGVuZ3RoID09IDMpIHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YVtwYXJ0c1sxXV0gPSBwYXJ0c1syXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlO1xuXG4iLCJ2YXIgXyAgICA9IHJlcXVpcmUoJ3VuZGVyc2NvcmUnKSxcbiAgICBsb2cgID0gcmVxdWlyZShcImxvZ2xldmVsXCIpO1xuXG52YXIgVmlldyA9IGZ1bmN0aW9uKCkge307XG5cblZpZXcucHJvdG90eXBlID0ge1xuICAgIGlzVmlldzogdHJ1ZSxcblxuICAgIC8qKiogRGVmYXVsdCBBdHRyaWJ1dGVzIChzaG91bGQgYmUgb3ZlcndyaXR0ZW4pICoqKi9cbiAgICB0YWdOYW1lOiAgICBcImRpdlwiLFxuICAgIGNsYXNzTmFtZTogIFwiXCIsXG4gICAgdGVtcGxhdGU6ICAgXCJcIixcblxuICAgIC8vU3RhdGUgZGF0YSBnZXRzIG1hcHBlZCB0byBjbGFzc2VzXG4gICAgc3RhdGU6ICAgICAge30sXG5cbiAgICAvL0RhdGEgZ29lcyBpbnRvIHRoZSB0ZW1wbGF0ZXMgYW5kIG1heSBhbHNvIGJlIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGFuIG9iamVjdFxuICAgIGRhdGE6ICAgICAgIHt9LFxuXG4gICAgLy9TdWJ2aWV3cyBhcmUgYSBzZXQgb2Ygc3Vidmlld3MgdGhhdCB3aWxsIGJlIGZlZCBpbnRvIHRoZSB0ZW1wbGF0aW5nIGVuZ2luZVxuICAgIHN1YnZpZXdzOiAgIHt9LFxuXG4gICAgLyoqKiBJbml0aWFsaXphdGlvbiBGdW5jdGlvbnMgKHNob3VsZCBiZSBjb25maWd1cmVkIGJ1dCB3aWxsIGJlIG1hbmlwdWxhdGVkIHdoZW4gZGVmaW5pbmcgdGhlIHN1YnZpZXcpICoqKi9cbiAgICBjb25maWc6IGZ1bmN0aW9uKGNvbmZpZykgeyAvL1J1bnMgYmVmb3JlIHJlbmRlclxuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmNvbmZpZ0Z1bmN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jb25maWdGdW5jdGlvbnNbaV0uYXBwbHkodGhpcywgW2NvbmZpZ10pO1xuICAgICAgICB9XG4gICAgfSwgXG4gICAgY29uZmlnRnVuY3Rpb25zOiBbXSxcbiAgICBpbml0OiBmdW5jdGlvbihjb25maWcpIHsgLy9SdW5zIGFmdGVyIHJlbmRlclxuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmluaXRGdW5jdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdEZ1bmN0aW9uc1tpXS5hcHBseSh0aGlzLCBbY29uZmlnXSk7XG4gICAgICAgIH1cbiAgICB9LCBcbiAgICBpbml0RnVuY3Rpb25zOiBbXSxcbiAgICBjbGVhbjogZnVuY3Rpb24oKSB7IC8vUnVucyBvbiByZW1vdmVcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5jbGVhbkZ1bmN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jbGVhbkZ1bmN0aW9uc1tpXS5hcHBseSh0aGlzLCBbXSk7XG4gICAgICAgIH1cbiAgICB9LCBcbiAgICBjbGVhbkZ1bmN0aW9uczogW10sXG5cbiAgICAvKioqIFJlbmRlcmluZyAqKiovXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgaHRtbCA9ICcnLFxuICAgICAgICAgICAgcG9zdExvYWQgPSBmYWxzZTtcblxuICAgICAgICAvL05vIFRlbXBsYXRpbmcgRW5naW5lXG4gICAgICAgIGlmKHR5cGVvZiB0aGlzLnRlbXBsYXRlID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBodG1sID0gdGhpcy50ZW1wbGF0ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gXy5leHRlbmQodGhpcy5zdGF0ZS5kYXRhLCB0eXBlb2YgdGhpcy5kYXRhID09ICdmdW5jdGlvbicgPyB0aGlzLmRhdGEoKSA6IHRoaXMuZGF0YSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vRGVmaW5lIHRoZSBzdWJ2aWV3IHZhcmlhYmxlXG4gICAgICAgICAgICBkYXRhLnN1YnZpZXcgPSB7fTtcbiAgICAgICAgICAgICQuZWFjaCh0aGlzLnN1YnZpZXdzLCBmdW5jdGlvbihuYW1lLCBzdWJ2aWV3KSB7XG4gICAgICAgICAgICAgICAgaWYoc3Vidmlldy5pc1ZpZXdQb29sKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuc3Vidmlld1tuYW1lXSA9IHN1YnZpZXcudGVtcGxhdGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwb3N0TG9hZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuc3Vidmlld1tuYW1lXSA9IFwiPHNjcmlwdCBjbGFzcz0ncG9zdC1sb2FkLXZpZXcnIHR5cGU9J3RleHQvaHRtbCcgZGF0YS1uYW1lPSdcIituYW1lK1wiJz48L3NjcmlwdD5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy9SdW4gdGhlIHRlbXBsYXRpbmcgZW5naW5lXG4gICAgICAgICAgICBpZihfLmlzRnVuY3Rpb24odGhpcy50ZW1wbGF0ZSkpIHtcbiAgICAgICAgICAgICAgICAvL0VKU1xuICAgICAgICAgICAgICAgIGlmKHR5cGVvZiB0aGlzLnRlbXBsYXRlLnJlbmRlciA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIGh0bWwgPSB0aGlzLnRlbXBsYXRlLnJlbmRlcihkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy9IYW5kbGViYXJzICYgVW5kZXJzY29yZSAmIEphZGVcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaHRtbCA9IHRoaXMudGVtcGxhdGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiVGVtcGxhdGluZyBlbmdpbmUgbm90IHJlY29nbml6ZWQuXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5odG1sKGh0bWwpO1xuXG4gICAgICAgIC8vUG9zdCBMb2FkIFZpZXdzXG4gICAgICAgIGlmKHBvc3RMb2FkKSB7XG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmZpbmQoJy5wb3N0LWxvYWQtdmlldycpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcbiAgICAgICAgICAgICAgICAkdGhpc1xuICAgICAgICAgICAgICAgICAgICAuYWZ0ZXIoc2VsZi5zdWJ2aWV3c1skdGhpcy5hdHRyKCdkYXRhLW5hbWUnKV0uJHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgICAgIC5yZW1vdmUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBodG1sOiBmdW5jdGlvbihodG1sKSB7XG4gICAgICAgIC8vUmVtb3ZlICYgY2xlYW4gc3Vidmlld3MgaW4gdGhlIHdyYXBwZXIgXG4gICAgICAgIHRoaXMuJHdyYXBwZXIuZmluZCgnLnZpZXcnKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc3Vidmlldyh0aGlzKS5yZW1vdmUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy53cmFwcGVyLmlubmVySFRNTCA9IGh0bWw7XG5cbiAgICAgICAgLy9Mb2FkIHN1YnZpZXdzIGluIHRoZSB3cmFwcGVyXG4gICAgICAgIHN1YnZpZXcubG9hZCh0aGlzLiR3cmFwcGVyKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIHJlbW92ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vRGV0YWNoXG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLndyYXBwZXIucGFyZW50Tm9kZTtcbiAgICAgICAgaWYocGFyZW50KSB7XG4gICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy53cmFwcGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQ2xlYW5cbiAgICAgICAgdGhpcy5zdGF0ZS5zZXREZWZhdWx0cygpO1xuICAgICAgICB0aGlzLmNsZWFuKCk7XG5cbiAgICAgICAgdGhpcy5wb29sLl9yZWxlYXNlKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKioqIFN0YXRlIEFQSSAqKiovXG4gICAgLypzZXQ6IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0KGtleSk7XG4gICAgfSxcbiAgICBiaW5kOiBmdW5jdGlvbihrZXksIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuc3RhdGUuYmluZChrZXksIGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrO1xuICAgIH0sXG4gICAgdW5iaW5kOiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS51bmJpbmQoa2V5KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUudHJpZ2dlcihrZXksIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSwqL1xuICAgIHRlbGxQYXJlbnQ6IGZ1bmN0aW9uKHR5cGUsIGtleSwgdmFsdWUpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS50ZWxsUGFyZW50KHR5cGUsIGtleSwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGFza1BhcmVudDogZnVuY3Rpb24odHlwZSwga2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLnN0YXRlLmFza1BhcmVudCh0eXBlLCBrZXkpO1xuICAgIH0sXG4gICAgbGlzdGVuOiBmdW5jdGlvbih0eXBlLCBrZXksIHZhbHVlKSB7XG4gICAgICAgIHRoaXMuc3RhdGUubGlzdGVuKHR5cGUsIGtleSwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqKiBDbGFzc2VzICoqKi9cbiAgICBfdmlld0Nzc1ByZWZpeDogJ3ZpZXctJyxcbiAgICBfZ2V0Q2xhc3NlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndyYXBwZXIuY2xhc3NOYW1lLnNwbGl0KC9cXHMrLyk7XG4gICAgfSxcbiAgICBfc2V0Q2xhc3NlczogZnVuY3Rpb24oY2xhc3Nlcykge1xuICAgICAgICB2YXIgbmV3Q2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJyk7XG4gICAgICAgIGlmKHRoaXMud3JhcHBlci5jbGFzc05hbWUgIT0gbmV3Q2xhc3NOYW1lKSB0aGlzLndyYXBwZXIuY2xhc3NOYW1lID0gbmV3Q2xhc3NOYW1lO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgX2FkZERlZmF1bHRDbGFzc2VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNsYXNzZXMgPSB0aGlzLl9nZXRDbGFzc2VzKCk7XG4gICAgICAgIGNsYXNzZXMucHVzaCh0aGlzLl92aWV3Q3NzUHJlZml4ICsgdGhpcy50eXBlKTtcblxuICAgICAgICB2YXIgc3VwZXJDbGFzcyA9IHRoaXMuc3VwZXI7XG4gICAgICAgIHdoaWxlKHRydWUpIHtcbiAgICAgICAgICAgIGlmKHN1cGVyQ2xhc3MudHlwZSkge1xuICAgICAgICAgICAgICAgIGNsYXNzZXMucHVzaCh0aGlzLl92aWV3Q3NzUHJlZml4ICsgc3VwZXJDbGFzcy50eXBlKTtcbiAgICAgICAgICAgICAgICBzdXBlckNsYXNzID0gc3VwZXJDbGFzcy5zdXBlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9BZGQgRGVmYXVsdCBWaWV3IENsYXNzXG4gICAgICAgIGNsYXNzZXMucHVzaCgndmlldycpO1xuXG4gICAgICAgIC8vQWRkIGNsYXNzTmFtZVxuICAgICAgICBjbGFzc2VzID0gY2xhc3Nlcy5jb25jYXQodGhpcy5jbGFzc05hbWUuc3BsaXQoJyAnKSk7XG5cbiAgICAgICAgdGhpcy5fc2V0Q2xhc3NlcyhfLnVuaXEoY2xhc3NlcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVmlldztcblxuXG5cbiIsInZhciBTdGF0ZSA9IHJlcXVpcmUoXCIuL1N0YXRlXCIpLFxuICAgICQgICAgID0gcmVxdWlyZShcInVub3BpbmlvbmF0ZVwiKS5zZWxlY3RvcjtcblxudmFyIFZpZXdQb29sID0gZnVuY3Rpb24oVmlldykge1xuICAgIC8vQ29uZmlndXJhdGlvblxuICAgIHRoaXMuVmlldyAgID0gVmlldztcbiAgICB0aGlzLnR5cGUgICA9IFZpZXcucHJvdG90eXBlLnR5cGU7XG4gICAgdGhpcy5zdXBlciAgPSBWaWV3LnByb3RvdHlwZS5zdXBlcjtcbiAgICB0aGlzLnRlbXBsYXRlID0gXCI8XCIrdGhpcy5WaWV3LnByb3RvdHlwZS50YWdOYW1lK1wiIGNsYXNzPSdcIit0aGlzLlZpZXcucHJvdG90eXBlLl92aWV3Q3NzUHJlZml4ICsgdGhpcy5WaWV3LnByb3RvdHlwZS50eXBlK1wiIFwiK3RoaXMuVmlldy5wcm90b3R5cGUuY2xhc3NOYW1lK1wiJz48L1wiK3RoaXMuVmlldy5wcm90b3R5cGUudGFnTmFtZStcIj5cIjtcblxuICAgIC8vVmlldyBDb25maWd1cmF0aW9uXG4gICAgdGhpcy5WaWV3LnByb3RvdHlwZS5wb29sID0gdGhpcztcblxuICAgIC8vUG9vbFxuICAgIHRoaXMucG9vbCA9IFtdO1xufTtcblxuVmlld1Bvb2wucHJvdG90eXBlID0ge1xuICAgIGlzVmlld1Bvb2w6IHRydWUsXG4gICAgc3Bhd246IGZ1bmN0aW9uKGVsLCBjb25maWcpIHtcbiAgICAgICAgLy9qUXVlcnkgbm9ybWFsaXphdGlvblxuICAgICAgICB2YXIgJGVsID0gZWwgPyAoZWwuanF1ZXJ5ID8gZWwgOiAkKGVsKSk6IG51bGw7XG4gICAgICAgIGVsID0gZWwgJiYgZWwuanF1ZXJ5ID8gZWxbMF0gOiBlbDtcblxuICAgICAgICAvL0FyZ3VtZW50IHN1cmdlcnlcbiAgICAgICAgaWYoZWwgJiYgZWwudmlldykge1xuICAgICAgICAgICAgcmV0dXJuIGVsLnZpZXc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25maWcgPSBjb25maWcgfHwgKCQuaXNQbGFpbk9iamVjdChlbCkgPyBlbCA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vR2V0IHRoZSBET00gbm9kZVxuICAgICAgICAgICAgaWYoIWVsIHx8ICFlbC5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgIGlmKHRoaXMucG9vbC5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucG9vbC5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLlZpZXcucHJvdG90eXBlLnRhZ05hbWUpO1xuICAgICAgICAgICAgICAgICAgICAkZWwgPSAkKGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciB2aWV3ID0gbmV3IHRoaXMuVmlldygpO1xuICAgICAgICAgICAgZWxbc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lXSA9IHZpZXc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZpZXcud3JhcHBlciAgPSBlbDtcbiAgICAgICAgICAgIHZpZXcuJHdyYXBwZXIgPSAkZWw7XG4gICAgICAgICAgICB2aWV3Ll9hZGREZWZhdWx0Q2xhc3NlcygpO1xuXG4gICAgICAgICAgICAvL0FkZCB2aWV3IFN0YXRlXG4gICAgICAgICAgICB2aWV3LnN0YXRlID0gbmV3IFN0YXRlKHZpZXcsIHZpZXcuc3RhdGUpO1xuXG4gICAgICAgICAgICAvL1JlbmRlciAoZG9uJ3QgY2hhaW4gc2luY2UgaW50cm9kdWNlcyBvcHBvcnR1bml0eSBmb3IgdXNlciBlcnJvcilcbiAgICAgICAgICAgIHZpZXcuY29uZmlnKGNvbmZpZyk7IFxuICAgICAgICAgICAgdmlldy5yZW5kZXIoKTtcbiAgICAgICAgICAgIHZpZXcuaW5pdChjb25maWcpO1xuXG4gICAgICAgICAgICByZXR1cm4gdmlldztcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZXh0ZW5kOiBmdW5jdGlvbihuYW1lLCBjb25maWcpIHtcbiAgICAgICAgcmV0dXJuIHN1YnZpZXcobmFtZSwgdGhpcywgY29uZmlnKTtcbiAgICB9LFxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnBvb2wgPSBudWxsO1xuICAgICAgICBkZWxldGUgc3Vidmlldy52aWV3c1t0aGlzLnR5cGVdO1xuICAgIH0sXG5cbiAgICBfcmVsZWFzZTogZnVuY3Rpb24odmlldykge1xuICAgICAgICB0aGlzLnBvb2wucHVzaCh2aWV3KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBWaWV3UG9vbDtcbiIsInZhciBfICAgICAgICAgICAgICAgPSByZXF1aXJlKFwidW5kZXJzY29yZVwiKSxcbiAgICBsb2cgICAgICAgICAgICAgPSByZXF1aXJlKFwibG9nbGV2ZWxcIiksXG4gICAgJCAgICAgICAgICAgICAgID0gcmVxdWlyZShcInVub3BpbmlvbmF0ZVwiKS5zZWxlY3RvcixcbiAgICBWaWV3UG9vbCAgICAgICAgPSByZXF1aXJlKFwiLi9WaWV3UG9vbFwiKSxcbiAgICBWaWV3VGVtcGxhdGUgICAgPSByZXF1aXJlKFwiLi9WaWV3XCIpLFxuICAgIHZpZXdUeXBlUmVnZXggICA9IG5ldyBSZWdFeHAoJ14nICsgVmlld1RlbXBsYXRlLnByb3RvdHlwZS5fdmlld0Nzc1ByZWZpeCk7XG5cbnZhciBzdWJ2aWV3ID0gZnVuY3Rpb24obmFtZSwgcHJvdG9WaWV3UG9vbCwgY29uZmlnKSB7XG4gICAgdmFyIFZpZXdQcm90b3R5cGU7XG5cbiAgICAvL1JldHVybiBWaWV3IG9iamVjdCBmcm9tIERPTSBlbGVtZW50XG4gICAgaWYobmFtZS5ub2RlVHlwZSB8fCBuYW1lLmpxdWVyeSkge1xuICAgICAgICByZXR1cm4gKG5hbWUuanF1ZXJ5ID8gbmFtZVswXSA6IG5hbWUpW3N1YnZpZXcuX2RvbVByb3BlcnR5TmFtZV0gfHwgbnVsbDtcbiAgICB9XG4gICAgLy9EZWZpbmUgYSBzdWJ2aWV3XG4gICAgZWxzZSB7XG4gICAgICAgIC8vQXJndW1lbnQgc3VyZ2VyeVxuICAgICAgICBpZihwcm90b1ZpZXdQb29sICYmIHByb3RvVmlld1Bvb2wuaXNWaWV3UG9vbCkge1xuICAgICAgICAgICAgVmlld1Byb3RvdHlwZSA9IHByb3RvVmlld1Bvb2wuVmlldztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZyAgICAgICAgICA9IHByb3RvVmlld1Bvb2w7XG4gICAgICAgICAgICBWaWV3UHJvdG90eXBlICAgPSBWaWV3VGVtcGxhdGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25maWcgPSBjb25maWcgfHwge307XG5cbiAgICAgICAgLy9WYWxpZGF0ZSBOYW1lXG4gICAgICAgIGlmKHN1YnZpZXcuX3ZhbGlkYXRlTmFtZShuYW1lKSkge1xuXG4gICAgICAgICAgICAvL0NyZWF0ZSB0aGUgbmV3IFZpZXdcbiAgICAgICAgICAgIHZhciBWaWV3ID0gZnVuY3Rpb24oKSB7fSxcbiAgICAgICAgICAgICAgICBzdXBlckNsYXNzID0gbmV3IFZpZXdQcm90b3R5cGUoKTtcblxuICAgICAgICAgICAgLy9FeHRlbmQgdGhlIGV4aXN0aW5nIGluaXQsIGNvbmZpZyAmIGNsZWFuIGZ1bmN0aW9ucyByYXRoZXIgdGhhbiBvdmVyd3JpdGluZyB0aGVtXG4gICAgICAgICAgICBfLmVhY2goWydpbml0JywgJ2NvbmZpZycsICdjbGVhbiddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnW25hbWUrJ0Z1bmN0aW9ucyddID0gc3VwZXJDbGFzc1tuYW1lKydGdW5jdGlvbnMnXS5zbGljZSgwKTsgLy9DbG9uZSBzdXBlckNsYXNzIGluaXRcbiAgICAgICAgICAgICAgICBpZihjb25maWdbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnW25hbWUrJ0Z1bmN0aW9ucyddLnB1c2goY29uZmlnW25hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGNvbmZpZ1tuYW1lXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUgICAgICAgPSBfLmV4dGVuZChzdXBlckNsYXNzLCBjb25maWcpO1xuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUudHlwZSAgPSBuYW1lO1xuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUuc3VwZXIgPSBWaWV3UHJvdG90eXBlLnByb3RvdHlwZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy9TYXZlIHRoZSBOZXcgVmlld1xuICAgICAgICAgICAgdmFyIHZpZXdQb29sID0gbmV3IFZpZXdQb29sKFZpZXcpO1xuICAgICAgICAgICAgc3Vidmlldy52aWV3c1tuYW1lXSA9IHZpZXdQb29sO1xuXG4gICAgICAgICAgICByZXR1cm4gdmlld1Bvb2w7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnN1YnZpZXcudmlld3MgPSB7fTtcblxuLy9PYnNjdXJlIERPTSBwcm9wZXJ0eSBuYW1lIGZvciBzdWJ2aWV3IHdyYXBwZXJzXG5zdWJ2aWV3Ll9kb21Qcm9wZXJ0eU5hbWUgPSBcInN1YnZpZXcxMjM0NVwiO1xuXG4vKioqIEFQSSAqKiovXG5zdWJ2aWV3LmxvYWQgPSBmdW5jdGlvbihzY29wZSkge1xuICAgIHZhciAkc2NvcGUgPSBzY29wZSA/ICQoc2NvcGUpIDogJCgnYm9keScpLFxuICAgICAgICAkdmlld3MgPSAkc2NvcGUuZmluZChcIltjbGFzc149J3ZpZXctJ11cIiksXG4gICAgICAgIGZpbmRlciA9IGZ1bmN0aW9uKGMpIHtcbiAgICAgICAgICAgIHJldHVybiBjLm1hdGNoKHZpZXdUeXBlUmVnZXgpO1xuICAgICAgICB9O1xuXG4gICAgZm9yKHZhciBpPTA7IGk8JHZpZXdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBlbCA9ICR2aWV3c1tpXSxcbiAgICAgICAgICAgIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoL1xccysvKTtcblxuICAgICAgICB0eXBlID0gIF8uZmluZChjbGFzc2VzLCBmaW5kZXIpLnJlcGxhY2Uodmlld1R5cGVSZWdleCwgJycpO1xuXG4gICAgICAgIGlmKHR5cGUgJiYgdGhpcy52aWV3c1t0eXBlXSkge1xuICAgICAgICAgICAgdGhpcy52aWV3c1t0eXBlXS5zcGF3bigkdmlld3NbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwic3VidmlldyAnXCIrdHlwZStcIicgaXMgbm90IGRlZmluZWQuXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5zdWJ2aWV3Lmxvb2t1cCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZih0eXBlb2YgbmFtZSA9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdGhpcy52aWV3c1tuYW1lXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmKG5hbWUuaXNWaWV3UG9vbCkge1xuICAgICAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihuYW1lLmlzVmlldykge1xuICAgICAgICAgICAgcmV0dXJuIG5hbWUucG9vbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zdWJ2aWV3Ll92YWxpZGF0ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYoIW5hbWUubWF0Y2goL15bYS16QS1aMC05XSskLykpIHtcbiAgICAgICAgbG9nLmVycm9yKFwic3VidmlldyBuYW1lICdcIiArIG5hbWUgKyBcIicgaXMgbm90IGFscGhhbnVtZXJpYy5cIik7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZihzdWJ2aWV3LnZpZXdzW25hbWVdKSB7XG4gICAgICAgIGxvZy5lcnJvcihcInN1YnZpZXcgJ1wiICsgbmFtZSArIFwiJyBpcyBhbHJlYWR5IGRlZmluZWQuXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG4vKioqIEV4cG9ydCAqKiovXG53aW5kb3cuc3VidmlldyA9IG1vZHVsZS5leHBvcnRzID0gc3VidmlldztcblxuLyoqKiBTdGFydHVwIEFjdGlvbnMgKioqL1xuJChmdW5jdGlvbigpIHtcbiAgICBpZighc3Vidmlldy5ub0luaXQpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJIRVJFXCIpO1xuICAgICAgICBzdWJ2aWV3LmxvYWQoKTtcbiAgICB9XG59KTtcblxuXG4iLCJ2YXIgc3VidmlldyAgICAgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgTGluZSAgICAgICAgPSByZXF1aXJlKCcuL0xpbmUuanMnKSxcbiAgICBjdXJzb3IgICAgICA9IHJlcXVpcmUoJy4vY3Vyc29yJyksXG4gICAgTGluZSAgICAgICAgPSByZXF1aXJlKCcuL0xpbmUnKSxcbiAgICBFbnZpcm9ubWVudCA9IHJlcXVpcmUoJy4uLy4uL21vZGVscy9FbnZpcm9ubWVudCcpO1xuXG5yZXF1aXJlKCcuL0Jsb2NrLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdCbG9jaycsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudCA9IG5ldyBFbnZpcm9ubWVudCgpO1xuICAgICAgICB0aGlzLmVtcHR5KCk7XG4gICAgfSxcbiAgICBlbXB0eTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaHRtbCgnJyk7XG4gICAgICAgIHZhciBsaW5lID0gTGluZS5zcGF3bigpO1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZChsaW5lLiR3cmFwcGVyKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGZvY3VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgc3Vidmlldyh0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCkubGFzdCgpKS5mb2N1cygpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIHJ1bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vQ2xlYXIgdGhlIGVudmlyb25tZW50XG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnQuY2xlYXIoKTtcblxuICAgICAgICAvL1J1biBldmVyeSBsaW5lXG4gICAgICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuJHdyYXBwZXIuY2hpbGRyZW4oKTtcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8Y2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHN1YnZpZXcoY2hpbGRyZW5baV0pLnJ1bigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1CbG9ja3tiYWNrZ3JvdW5kOiNmZmY7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjJweDstbW96LWJvcmRlci1yYWRpdXM6MnB4O2JvcmRlci1yYWRpdXM6MnB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIEJsb2NrID0gcmVxdWlyZSgnLi9CbG9jaycpO1xucmVxdWlyZSgnLi9FZGl0b3IubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJsb2NrLmV4dGVuZCgnRWRpdG9yJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmZvY3VzKCk7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1FZGl0b3J7b3ZlcmZsb3c6aGlkZGVufVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgY3Vyc29yICA9IHJlcXVpcmUoJy4vY3Vyc29yJyksXG4gICAgY2xpY2sgICA9IHJlcXVpcmUoJ29uY2xpY2snKTtcblxucmVxdWlyZSgnLi9GaWVsZC5sZXNzJyk7XG5cbiQoZG9jdW1lbnQpLm9uKCdtb3VzZWRvd24gdG91Y2hzdGFydCcsICcudmlldy1GaWVsZCcsIGZ1bmN0aW9uKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHN1YnZpZXcodGhpcykuZm9jdXMoKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ0ZpZWxkJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuXG4gICAgfSxcbiAgICBkdW1wOiBmdW5jdGlvbigpIHtcblxuICAgIH0sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZChjdXJzb3IuJHdyYXBwZXIpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIHJ1bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzdGFjayA9IFtdLFxuICAgICAgICAgICAgdG9rZW47XG5cbiAgICAgICAgLy9CdWlsZCBTdGFja1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCk7XG4gICAgICAgIGZvcih2YXIgaT0wOyBpPGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHN1YnZpZXcoY2hpbGRyZW5baV0pO1xuXG4gICAgICAgICAgICBpZih0b2tlbi5pc0Z1bmN0aW9uIHx8IHRva2VuLmlzQ29udHJvbCkge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4ucnVuKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0b2tlbi5pc09wZXJhdG9yKSB7XG4gICAgICAgICAgICAgICAgc3RhY2sucHVzaCh0b2tlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmKHRva2VuLmlzTGl0ZXJhbCkge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4udmFsKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0b2tlbi50eXBlICE9ICdDdXJzb3InKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlRva2VuIG5vdCByZWNvZ25pemVkXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9SZWR1Y2Ugb3BlcmF0b3JzXG4gICAgICAgIHZhciBtYXhQcmVjZWRlbmNlID0gNSArIDE7XG4gICAgICAgIHdoaWxlKG1heFByZWNlZGVuY2UtLSAmJiBzdGFjay5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBmb3IoaT0wOyBpPHN0YWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdG9rZW4gPSBzdGFja1tpXTtcblxuICAgICAgICAgICAgICAgIC8vTnVsbCB0b2tlbnMgc2hvdWxkIGJlIGRpc2NhcmRlZFxuICAgICAgICAgICAgICAgIC8vVGhleSBhcmUgcmV0dXJuZWQgd2hlbiBhIHN0YXRlbWVudCBjYW5jZWxzIGl0cyBzZWxmIG91dCBsaWtlIE5PVCBOT1Qgb3IgLS00XG4gICAgICAgICAgICAgICAgaWYodG9rZW4gJiYgdG9rZW4uaXNOdWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0YWNrLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgaS0tO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKHRva2VuLmlzT3BlcmF0b3IgJiYgKHR5cGVvZiB0b2tlbi5wcmVjZWRlbmNlID09ICdmdW5jdGlvbicgPyB0b2tlbi5wcmVjZWRlbmNlKHN0YWNrLCBpKSA6IHRva2VuLnByZWNlZGVuY2UpID09IG1heFByZWNlZGVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgLy9PcGVyYXRvcnMgbGlrZSBOT1QgdGhhdCBvbmx5IG9wZXJhdGUgb24gdGhlIHRva2VuIGFmdGVyXG4gICAgICAgICAgICAgICAgICAgIGlmKHRva2VuLmlzU2luZ2xlT3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YWNrLnNwbGljZShpLCAyLCB0b2tlbi5ydW4oc3RhY2tbaSArIDFdKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpLS07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy9TdGFuZGFyZCBvcGVyYXRvcnMgdGhhdCBvcGVyYXRlIG9uIHRva2VuIGJlZm9yZSBhbmQgYWZ0ZXJcbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJldiA9IHN0YWNrW2kgLSAxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0ID0gc3RhY2tbaSArIDFdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZihpID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4uZXJyb3IoJ05vIGxlZnQtc2lkZSBmb3IgJyArIHRva2VuLnRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKGkgPT0gc3RhY2subGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuLmVycm9yKCdObyByaWdodC1zaWRlIGZvciAnICsgdG9rZW4udGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYocHJldi5pc09wZXJhdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4uZXJyb3IoJ0ludmFsaWQgcmlnaHQtc2lkZSBmb3IgJyArIHRva2VuLnRlbXBsYXRlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYobmV4dC5pc09wZXJhdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4uZXJyb3IoJ0ludmFsaWQgbGVmdC1zaWRlIGZvciAnICsgdG9rZW4udGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2suc3BsaWNlKGkgLSAxLCAzLCB0b2tlbi5ydW4ocHJldiwgbmV4dCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGktLTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vVGhlIHN0YWNrIHNob3VsZCByZWR1Y2UgdG8gZXhhY3RseSBvbmUgbGl0ZXJhbFxuICAgICAgICBpZihzdGFjay5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoXCJTeW50YXggRXJyb3JcIik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc3RhY2tbMF07XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGVycm9yOiBmdW5jdGlvbihtc2cpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiXCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgRmllbGQgPSByZXF1aXJlKCcuL0ZpZWxkJyk7XG5cbnJlcXVpcmUoJy4vTGluZS5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmllbGQuZXh0ZW5kKCdMaW5lJywge1xuICAgIFxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1FZGl0b3J7Y291bnRlci1yZXNldDpsaW5lTnVtYmVyfS52aWV3LUxpbmV7cG9zaXRpb246cmVsYXRpdmU7bWluLWhlaWdodDoxLjJlbTtwYWRkaW5nLWxlZnQ6MzBweDstbW96LWJveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LWJveC1zaXppbmc6Ym9yZGVyLWJveDtib3gtc2l6aW5nOmJvcmRlci1ib3h9LnZpZXctTGluZTpiZWZvcmV7Zm9udC1mYW1pbHk6Q29uc29sYXMsbW9uYWNvLG1vbm9zcGFjZTtjb3VudGVyLWluY3JlbWVudDpsaW5lTnVtYmVyO2NvbnRlbnQ6Y291bnRlcihsaW5lTnVtYmVyKTtwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTAwJTt3aWR0aDozNHB4O2xlZnQ6LTRweDtwYWRkaW5nLWxlZnQ6OHB4O3BhZGRpbmctdG9wOi4xZW07YmFja2dyb3VuZDojRjFGMEYwO2JvcmRlci1yaWdodDoxcHggc29saWQgI0NDQztjb2xvcjojNTU1Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpO1xuXG5yZXF1aXJlKCcuL2N1cnNvci5sZXNzJyk7XG5cbnZhciBDdXJzb3IgPSBzdWJ2aWV3KCdDdXJzb3InLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkKGRvY3VtZW50KS5vbignZm9jdXMnLCAnaW5wdXQsIGRpdicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi4kd3JhcHBlci5oaWRlKCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgcGFzdGU6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgLy9NYWtlIHN1cmUgdGhlIGN1cnNvciBpcyBzaG93blxuICAgICAgICB0aGlzLiR3cmFwcGVyLnNob3coKTtcbiAgICAgICAgJCgnOmZvY3VzJykuYmx1cigpO1xuXG4gICAgICAgIC8vR2V0IHRoZSB0eXBlXG4gICAgICAgIHZhciBUeXBlID0gc3Vidmlldy5sb29rdXAodHlwZSk7XG5cbiAgICAgICAgaWYoIVR5cGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJUeXBlICdcIit0eXBlK1wiJyBkb2VzIG5vdCBleGlzdFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vVmFsaWRhdGUgUG9zaXRpb25cbiAgICAgICAgaWYoVHlwZS5WaWV3LnByb3RvdHlwZS52YWxpZGF0ZVBvc2l0aW9uKHRoaXMpKSB7XG5cbiAgICAgICAgICAgIC8vUGFzdGUgdGhlIGZ1bmN0aW9uXG4gICAgICAgICAgICB2YXIgY29tbWFuZCA9IFR5cGUuc3Bhd24oKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5iZWZvcmUoY29tbWFuZC4kd3JhcHBlcik7XG4gICAgICAgICAgICBjb21tYW5kLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZXJyb3I6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdDdXJzb3I6ICcrbXNnKTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDdXJzb3Iuc3Bhd24oKTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIkAtd2Via2l0LWtleWZyYW1lcyBmbGFzaHswJSwxMDAle29wYWNpdHk6MX01MCV7b3BhY2l0eTowfX0udmlldy1jdXJzb3J7cG9zaXRpb246cmVsYXRpdmU7ZGlzcGxheTppbmxpbmUtYmxvY2s7d2lkdGg6MnB4O2hlaWdodDoxLjFlbTttYXJnaW46LS4wNWVtIC0xcHg7dG9wOi4wNWVtO2JhY2tncm91bmQ6IzEyNzlGQzstd2Via2l0LWFuaW1hdGlvbjpmbGFzaCAxcyBpbmZpbml0ZX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGtleSAgICAgPSByZXF1aXJlKCdvbmtleScpO1xuXG5yZXF1aXJlKCcuL1Rlcm1pbmFsLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KFwiVGVybWluYWxcIiwge1xuICAgIHByaW50OiBmdW5jdGlvbihzdHJpbmcpIHtcbiAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQoXCI8ZGl2IGNsYXNzPSdUZXJtaW5hbC1saW5lJz5cIitzdHJpbmcrXCI8L2Rpdj5cIik7XG4gICAgfSxcbiAgICBwcm9tcHQ6IGZ1bmN0aW9uKHN0cmluZywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyICRpbnB1dCA9ICQoXCI8aW5wdXQgdHlwZT0ndGV4dCcgY2xhc3M9J1Rlcm1pbmFsLXByb21wdC1pbnB1dCcgLz5cIik7XG5cbiAgICAgICAgJChcIjxkaXYgY2xhc3M9J1Rlcm1pbmFsLXByb21wdCc+XCIrc3RyaW5nK1wiOiA8L2Rpdj5cIilcbiAgICAgICAgICAgIC5hcHBlbmQoJGlucHV0KVxuICAgICAgICAgICAgLmFwcGVuZFRvKHRoaXMuJHdyYXBwZXIpO1xuICAgICAgICBcbiAgICAgICAga2V5KCRpbnB1dCkuZG93bih7XG4gICAgICAgICAgICAnZW50ZXInOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygkaW5wdXQudmFsKCkpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGNsZWFyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5odG1sKCcnKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufSk7XG4iLCJ2YXIgRmllbGQgPSByZXF1aXJlKCcuLi9FZGl0b3IvRmllbGQnKTtcbnJlcXVpcmUoJy4vQXJndW1lbnQubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpZWxkLmV4dGVuZCgnQXJndW1lbnQnLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIHRoaXMubmFtZSA9IGNvbmZpZy5uYW1lIHx8IFwiXCI7XG4gICAgICAgIHRoaXMudHlwZSA9IGNvbmZpZy50eXBlIHx8IG51bGw7XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogXCJcXHUyMDBCXCIsXG4gICAgdGFnTmFtZTogJ3NwYW4nXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUFyZ3VtZW50e2JhY2tncm91bmQ6I2ZmZjttaW4td2lkdGg6MTVweDttaW4taGVpZ2h0OjEuMmVtO21hcmdpbjowIDJweDtwYWRkaW5nOi4xZW0gMnB4Oy13ZWJraXQtYm9yZGVyLXJhZGl1czoycHg7LW1vei1ib3JkZXItcmFkaXVzOjJweDtib3JkZXItcmFkaXVzOjJweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBDb250cm9sICA9IHJlcXVpcmUoJy4uL0NvbnRyb2wnKSxcbiAgICBBcmd1bWVudCA9IHJlcXVpcmUoJy4uLy4uL0FyZ3VtZW50JyksXG4gICAgQmxvY2sgICAgPSByZXF1aXJlKCcuLi8uLi8uLi9FZGl0b3IvQmxvY2snKTtcblxucmVxdWlyZSgnLi9Db25kaXRpb25hbC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29udHJvbC5leHRlbmQoJ0NvbmRpdGlvbmFsJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvL0RlZmluZSBzdGF0ZSB2YXJpYWJsZXNcbiAgICAgICAgdGhpcy5jb25kaXRpb25zID0gW107XG4gICAgICAgIHRoaXMuZWxzZUNvbmRpdGlvbiA9IG51bGw7XG5cbiAgICAgICAgLy9BZGQgaW5pdGlhbCBjb25kaXRpb25hbFxuICAgICAgICB0aGlzLmFkZENvbmRpdGlvbignaWYnKTtcbiAgICB9LFxuICAgIG1ldGE6IHtcbiAgICAgICAgZGlzcGxheTogJ2lmJ1xuICAgIH0sXG4gICAgYWRkQ29uZGl0aW9uOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgIHZhciBjb25kaXRpb24gPSB7XG4gICAgICAgICAgICBibG9jazogQmxvY2suc3Bhd24oKVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vQnVpbGQgQ29uZGl0aW9uXG4gICAgICAgIGlmKHR5cGUgPT0gXCJlbHNlXCIpIHtcbiAgICAgICAgICAgIHRoaXMuZWxzZUNvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbi5hcmcgPSBBcmd1bWVudC5zcGF3bih7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJDb25kaXRpb25hbFwiXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb25kaXRpb25zLnB1c2goY29uZGl0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9BcHBlbmQgdG8gV3JhcHBlclxuICAgICAgICB2YXIgJGNvbmRpdGlvbiA9ICQoXCI8ZGl2IGNsYXNzPSdjb25kaXRpb25hbC1ibG9jayc+PC9kaXY+XCIpO1xuXG4gICAgICAgICRjb25kaXRpb24uYXBwZW5kKFxuICAgICAgICAgICAgdHlwZSA9PSBcImVsc2VcIiA/IFwiZWxzZTpcIiA6XG4gICAgICAgICAgICB0eXBlID09IFwiZWxzZSBpZlwiID8gXCJlbHNlIGlmIFwiIDpcbiAgICAgICAgICAgIHR5cGUgPT0gXCJpZlwiID8gXCJpZiBcIiA6IFwiXCJcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmKHR5cGUgIT0gXCJlbHNlXCIpIHtcbiAgICAgICAgICAgICRjb25kaXRpb25cbiAgICAgICAgICAgICAgICAuYXBwZW5kKGNvbmRpdGlvbi5hcmcuJHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgLmFwcGVuZChcIiB0aGVuOlwiKTtcbiAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICRjb25kaXRpb24uYXBwZW5kKGNvbmRpdGlvbi5ibG9jay4kd3JhcHBlcik7XG5cbiAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQoJGNvbmRpdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjb25kaXRpb24gPSB0aGlzLmNvbmRpdGlvbnNbaV07XG5cbiAgICAgICAgICAgIGlmKGNvbmRpdGlvbi5hcmcucnVuKCkpIHtcbiAgICAgICAgICAgICAgICBjb25kaXRpb24uYmxvY2sucnVuKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5lbHNlQ29uZGl0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVsc2VDb25kaXRpb24uYmxvY2sucnVuKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgfSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uc1swXS5hcmcuZm9jdXMoKTtcbiAgICB9XG59KTtcbiIsInJlcXVpcmUoJy4vQ29udHJvbC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi4vVG9rZW4nKS5leHRlbmQoJ0NvbnRyb2wnLCB7XG4gICAgaXNDb250cm9sOiB0cnVlLFxuICAgIFxuICAgIC8qKiogU2hvdWxkIEJlIE92ZXJ3cml0dGVuICoqKi9cbiAgICBydW46ICAgIGZ1bmN0aW9uKCkge30sXG4gICAgZm9jdXM6ICBmdW5jdGlvbigpIHt9LFxuXG4gICAgLyoqKiBGdW5jdGlvbnMgKioqL1xuICAgIHZhbGlkYXRlUG9zaXRpb246IGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICBpZihzdWJ2aWV3KGN1cnNvci4kd3JhcHBlci5wYXJlbnQoKSkudHlwZSA9PSAnTGluZScpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY3Vyc29yLmVycm9yKHRoaXMudHlwZSArICcgbXVzdCBnbyBvbiBpdHMgb3duIGxpbmUuJyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUNvbnRyb2x7YmFja2dyb3VuZDpvcmFuZ2U7cGFkZGluZzoycHh9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKFwiLi9Db25kaXRpb25hbC9Db25kaXRpb25hbFwiKVxuXTsiLCJ2YXIgQXJndW1lbnQgPSByZXF1aXJlKCcuLi9Bcmd1bWVudCcpLFxuICAgIGN1cnNvciAgID0gcmVxdWlyZSgnLi4vLi4vRWRpdG9yL2N1cnNvcicpO1xuXG5yZXF1aXJlKCcuL0Z1bmN0aW9uLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9Ub2tlbicpLmV4dGVuZCgnRnVuY3Rpb24nLCB7XG4gICAgaXNGdW5jdGlvbjogdHJ1ZSxcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQodGhpcy5uYW1lK1wiKFwiKTtcblxuICAgICAgICAvL1BhcnNlIEFyZ3VtZW50c1xuICAgICAgICB2YXIgaSA9IHRoaXMuYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICB2YXIgYXJnID0gQXJndW1lbnQuc3Bhd24odGhpcy5hcmd1bWVudHNbaV0pO1xuICAgICAgICAgICAgdGhpcy5hcmd1bWVudHNbaV0gPSBhcmc7XG5cbiAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKGFyZy4kd3JhcHBlcik7XG4gICAgICAgICAgICBpZihpID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKFwiLCBcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKFwiKVwiKTtcbiAgICB9LFxuXG4gICAgLyoqKiBTaG91bGQgQmUgT3ZlcndyaXR0ZW4gKioqL1xuICAgIG5hbWU6ICcnLFxuICAgIC8vUnVucyB3aGVuIHRoZSBmdW5jdGlvbiBpcyBjYWxsZWRcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICBcbiAgICB9LFxuICAgIGFyZ3VtZW50OiBmdW5jdGlvbihpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFyZ3VtZW50c1tpXS5ydW4oKTtcbiAgICB9LFxuICAgIGFyZ3VtZW50czogW10sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZih0aGlzLmFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmFyZ3VtZW50c1swXS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5hZnRlcihjdXJzb3IpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1GdW5jdGlvbntkaXNwbGF5OmlubGluZS1ibG9jazstd2Via2l0LWJvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm9yZGVyLXJhZGl1czozcHg7Ym9yZGVyLXJhZGl1czozcHg7YmFja2dyb3VuZDojMTA3NUY2O21hcmdpbjoycHg7cGFkZGluZzozcHggNXB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIEZ1bmMgPSByZXF1aXJlKCcuLi9GdW5jdGlvbicpO1xuXG5yZXF1aXJlKCcuL1BhcmVudGhlc2VzLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBGdW5jLmV4dGVuZCgnUGFyZW50aGVzZXMnLCB7XG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnKCApJ1xuICAgIH0sXG4gICAgcnVuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJndW1lbnQoMCk7XG4gICAgfSxcbiAgICBhcmd1bWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJFeHByZXNzaW9uXCJcbiAgICAgICAgfVxuICAgIF1cbn0pOyIsInZhciB0ZXJtaW5hbCA9IHJlcXVpcmUoJy4uLy4uLy4uL3Rlcm1pbmFsJyksXG4gICAgRnVuYyAgICA9IHJlcXVpcmUoJy4uL0Z1bmN0aW9uJyk7XG5cbnJlcXVpcmUoJy4vUHJpbnQubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZ1bmMuZXh0ZW5kKCdwcmludCcsIHtcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0ZXJtaW5hbC5wcmludCh0aGlzLmFyZ3VtZW50KDApKTtcbiAgICB9LFxuICAgIGFyZ3VtZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgICAgICAgbmFtZTogXCJNZXNzYWdlXCJcbiAgICAgICAgfVxuICAgIF0sXG4gICAgbmFtZTogJ3ByaW50JyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICdwcmludCggKSdcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LVBhcmVudGhlc2Vze2NvbG9yOiM3NDc0NzQ7YmFja2dyb3VuZDojRkZGOUI2fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZSgnLi9QcmludC9QcmludCcpLFxuICAgIHJlcXVpcmUoJy4vUGFyZW50aGVzZXMvUGFyZW50aGVzZXMnKVxuXTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUZhbHNlLC52aWV3LVRydWV7Y29sb3I6I2ZmZjtiYWNrZ3JvdW5kOiNEMzJDRDN9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgTGl0ZXJhbCA9IHJlcXVpcmUoJy4uL0xpdGVyYWwnKTtcbnJlcXVpcmUoJy4vQm9vbGVhbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ2ZhbHNlJywge1xuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICdmYWxzZSdcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcImZhbHNlXCIsXG4gICAgdmFsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5yZXF1aXJlKCcuL0Jvb2xlYW4ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVyYWwuZXh0ZW5kKCd0cnVlJywge1xuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICd0cnVlJ1xuICAgIH0sXG4gICAgdGVtcGxhdGU6IFwidHJ1ZVwiLFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn0pO1xuIiwicmVxdWlyZSgnLi9MaXRlcmFsLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9Ub2tlbicpLmV4dGVuZCgnTGl0ZXJhbCcsIHtcbiAgICBpc0xpdGVyYWw6IHRydWUsXG4gICAgdmFsOiBmdW5jdGlvbigpIHt9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUxpdGVyYWx7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjJweDstbW96LWJvcmRlci1yYWRpdXM6MnB4O2JvcmRlci1yYWRpdXM6MnB4O3BhZGRpbmc6MCA0cHg7bWFyZ2luOjAgMXB4O2Rpc3BsYXk6aW5saW5lLWJsb2NrfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5yZXF1aXJlKCcuL051bWJlci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ051bWJlcicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kaW5wdXQgPSB0aGlzLiR3cmFwcGVyLmZpbmQoJy5udW1iZXItaW5wdXQnKTtcbiAgICB9LFxuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICcxMjMnXG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogXCI8aW5wdXQgdHlwZT0nbnVtYmVyJyBjbGFzcz0nbnVtYmVyLWlucHV0Jy8+XCIsXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5mb2N1cygpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5odG1sKCcnKTtcbiAgICB9LFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXMuJGlucHV0LnZhbCgpKTtcbiAgICB9XG59KTtcbiIsInZhciBMaXRlcmFsID0gcmVxdWlyZSgnLi4vTGl0ZXJhbCcpO1xucmVxdWlyZSgnLi9TdHJpbmcubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVyYWwuZXh0ZW5kKCdTdHJpbmcnLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJGlucHV0ID0gdGhpcy4kd3JhcHBlci5maW5kKCcuc3RyaW5nLWlucHV0Jyk7XG4gICAgfSxcbiAgICB0YWdOYW1lOiAnc3BhbicsXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnXCJhYmNcIidcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcIiZsZHF1bzs8c3BhbiBjb250ZW50ZWRpdGFibGU9J3RydWUnIGNsYXNzPSdzdHJpbmctaW5wdXQnPjwvc3Bhbj4mcmRxdW87XCIsXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5mb2N1cygpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5odG1sKCcnKTtcbiAgICB9LFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRpbnB1dC50ZXh0KCk7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1TdHJpbmd7Y29sb3I6IzAwMDtiYWNrZ3JvdW5kOiNGRkZGQTE7cGFkZGluZzowO2Rpc3BsYXk6aW5saW5lfS5zdHJpbmctaW5wdXQ6Zm9jdXN7b3V0bGluZTowfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZSgnLi9TdHJpbmcvU3RyaW5nJyksXG4gICAgcmVxdWlyZSgnLi9OdW1iZXIvTnVtYmVyJyksXG4gICAgcmVxdWlyZSgnLi9Cb29sZWFucy9UcnVlJyksXG4gICAgcmVxdWlyZSgnLi9Cb29sZWFucy9GYWxzZScpXG5dO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Jvb2xlYW4nKS5leHRlbmQoJ0FORCcsIHtcbiAgICB0ZW1wbGF0ZTogXCJBTkRcIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0ICYmIHNlY29uZDtcbiAgICB9XG59KTtcbiIsInZhciBPcGVyYXRvciA9IHJlcXVpcmUoJy4uL09wZXJhdG9yJyk7XG5yZXF1aXJlKCcuL0Jvb2xlYW4ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9wZXJhdG9yLmV4dGVuZCgnQm9vbGVhbicsIHtcbiAgICBwcmVjZWRlbmNlOiAwXG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1Cb29sZWFue2JhY2tncm91bmQ6I0Y1MzkzOTtmb250LXN0eWxlOml0YWxpY31cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Cb29sZWFuJykuZXh0ZW5kKCdOT1QnLCB7XG4gICAgaXNTaW5nbGVPcGVyYXRvcjogICB0cnVlLFxuICAgIHRlbXBsYXRlOiAgICAgICAgICAgXCJOT1RcIixcbiAgICBwcmVjZWRlbmNlOiAgICAgICAgIDUsXG4gICAgcnVuOiBmdW5jdGlvbihleHApIHtcbiAgICAgICAgaWYoZXhwLnR5cGUgPT0gJ05PVCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgaXNOdWxsOiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICFleHA7XG4gICAgICAgIH1cbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Cb29sZWFuJykuZXh0ZW5kKCdPUicsIHtcbiAgICB0ZW1wbGF0ZTogXCJPUlwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgfHwgc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Jvb2xlYW4nKS5leHRlbmQoJ1hPUicsIHtcbiAgICB0ZW1wbGF0ZTogXCJYT1JcIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuICFmaXJzdCAhPSAhc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZSgnLi9BTkQnKSxcbiAgICByZXF1aXJlKCcuL09SJyksXG4gICAgcmVxdWlyZSgnLi9YT1InKSxcbiAgICByZXF1aXJlKCcuL05PVCcpXG5dO1xuIiwidmFyIE9wZXJhdG9yID0gcmVxdWlyZSgnLi4vT3BlcmF0b3InKTtcbnJlcXVpcmUoJy4vQ29tcGFyYXRvci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gT3BlcmF0b3IuZXh0ZW5kKCdDb21wYXJhdG9yJywge1xuICAgIHByZWNlZGVuY2U6IDFcbn0pOyIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUNvbXBhcmF0b3J7YmFja2dyb3VuZDojMzVDMDYyfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0NvbXBhcmF0b3InKS5leHRlbmQoJ0VxdWFscycsIHtcbiAgICB0ZW1wbGF0ZTogXCI9XCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCA9PSBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQ29tcGFyYXRvcicpLmV4dGVuZCgnR3JlYXRlclRoYW4nLCB7XG4gICAgdGVtcGxhdGU6IFwiPlwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgPiBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQ29tcGFyYXRvcicpLmV4dGVuZCgnR3JlYXRlclRoYW5FcXVhbHMnLCB7XG4gICAgdGVtcGxhdGU6IFwiJmdlO1wiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgPj0gc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0NvbXBhcmF0b3InKS5leHRlbmQoJ0xlc3NUaGFuJywge1xuICAgIHRlbXBsYXRlOiBcIjxcIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0IDwgc2Vjb25kO1xuICAgIH1cbn0pOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9yJykuZXh0ZW5kKCdMZXNzVGhhbkVxdWFscycsIHtcbiAgICB0ZW1wbGF0ZTogXCImbGU7XCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCA8PSBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKCcuL0dyZWF0ZXJUaGFuJyksXG4gICAgcmVxdWlyZSgnLi9HcmVhdGVyVGhhbkVxdWFscycpLFxuICAgIHJlcXVpcmUoJy4vRXF1YWxzJyksXG4gICAgcmVxdWlyZSgnLi9MZXNzVGhhbkVxdWFscycpLFxuICAgIHJlcXVpcmUoJy4vTGVzc1RoYW4nKVxuXTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vTWF0aCcpLmV4dGVuZCgnRGl2aWRlJywge1xuICAgIHRlbXBsYXRlOiBcIiZmcmFzbDtcIixcbiAgICBwcmVjZWRlbmNlOiAzLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3Qvc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ0V4cCcsIHtcbiAgICB0ZW1wbGF0ZTogXCJeXCIsXG4gICAgcHJlY2VkZW5jZTogNCxcbiAgICBydW46IE1hdGgucG93XG59KTsiLCJ2YXIgT3BlcmF0b3IgPSByZXF1aXJlKCcuLi9PcGVyYXRvcicpO1xucmVxdWlyZSgnLi9NYXRoLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBPcGVyYXRvci5leHRlbmQoJ01hdGgnLCB7XG4gICAgXG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1NYXRoe2JhY2tncm91bmQ6I0Y1MzkzOX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9NYXRoJykuZXh0ZW5kKCdNaW51cycsIHtcbiAgICB0ZW1wbGF0ZTogXCItXCIsXG4gICAgcHJlY2VkZW5jZTogZnVuY3Rpb24oc3RhY2ssIGkpIHtcbiAgICAgICAgaWYoaSA9PT0gMCB8fCBzdGFja1tpIC0gMV0uaXNPcGVyYXRvcikge1xuICAgICAgICAgICAgdGhpcy5pc1NpbmdsZU9wZXJhdG9yID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybiA1O1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuXG4gICAgICAgIC8vTmVnYXRpb24gT3BlcmF0b3JcbiAgICAgICAgaWYodHlwZW9mIHNlY29uZCA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYoZmlyc3QudHlwZSA9PSAnTWludXMnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgaXNOdWxsOiB0cnVlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAtZmlyc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL01pbnVzIE9wZXJhdG9yXG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZpcnN0IC0gc2Vjb25kO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pc1NpbmdsZU9wZXJhdG9yID0gZmFsc2U7XG4gICAgfSxcbiAgICBjbGVhbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaXNTaW5nbGVPcGVyYXRvciA9IGZhbHNlO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ011bHRpcGx5Jywge1xuICAgIHRlbXBsYXRlOiBcIiZ0aW1lcztcIixcbiAgICBwcmVjZWRlbmNlOiAzLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3Qqc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ1BsdXMnLCB7XG4gICAgdGVtcGxhdGU6IFwiK1wiLFxuICAgIHByZWNlZGVuY2U6IDIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCArIHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHJlcXVpcmUoJy4vRXhwJyksXG4gICAgcmVxdWlyZSgnLi9EaXZpZGUnKSxcbiAgICByZXF1aXJlKCcuL011bHRpcGx5JyksXG4gICAgcmVxdWlyZSgnLi9NaW51cycpLFxuICAgIHJlcXVpcmUoJy4vUGx1cycpXG5dO1xuIiwicmVxdWlyZSgnLi9PcGVyYXRvci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi4vVG9rZW4nKS5leHRlbmQoJ09wZXJhdG9yJywge1xuICAgIGlzT3BlcmF0b3I6IHRydWUsXG4gICAgdGFnTmFtZTogJ3NwYW4nXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LU9wZXJhdG9yey13ZWJraXQtYm9yZGVyLXJhZGl1czozcHg7LW1vei1ib3JkZXItcmFkaXVzOjNweDtib3JkZXItcmFkaXVzOjNweDtwYWRkaW5nOjAgNHB4O21hcmdpbjowIDFweDtkaXNwbGF5OmlubGluZS1ibG9ja31cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9ycy9pbmRleCcpLmNvbmNhdChcbiAgICByZXF1aXJlKCcuL01hdGgvaW5kZXgnKSxcbiAgICByZXF1aXJlKCcuL0Jvb2xlYW4vaW5kZXgnKVxuKTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBjdXJzb3IgID0gcmVxdWlyZSgnLi4vRWRpdG9yL2N1cnNvcicpO1xuXG5yZXF1aXJlKCcuL1Rva2VuLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdUb2tlbicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHt9LFxuICAgIG1ldGE6IHt9LFxuICAgIGZvY3VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kd3JhcHBlci5hZnRlcihjdXJzb3IpO1xuICAgIH0sXG4gICAgZXJyb3I6IGZ1bmN0aW9uKG1zZykge1xuICAgICAgICBjb25zb2xlLmVycm9yKG1zZyk7XG4gICAgfSxcbiAgICB2YWxpZGF0ZVBvc2l0aW9uOiBmdW5jdGlvbihjdXJzb3IpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1Ub2tlbntjb2xvcjojRkZGfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Z1bmN0aW9ucy9pbmRleCcpLmNvbmNhdChcbiAgICByZXF1aXJlKCcuL0xpdGVyYWxzL2luZGV4JyksXG4gICAgcmVxdWlyZSgnLi9PcGVyYXRvcnMvaW5kZXgnKSxcbiAgICByZXF1aXJlKCcuL0NvbnRyb2wvaW5kZXgnKVxuKTsiLCJ2YXIgdGVtcGxhdGVyID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKS5kZWZhdWx0LnRlbXBsYXRlO21vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVyKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICBcblxuXG4gIHJldHVybiBcIjxidXR0b24gY2xhc3M9J1Rvb2xiYXItcnVuJz4mIzk2NTg7PC9idXR0b24+XCI7XG4gIH0pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGNsaWNrICAgPSByZXF1aXJlKCdvbmNsaWNrJyksXG4gICAgZWRpdG9yICA9IHJlcXVpcmUoJy4uL2VkaXRvcicpLFxuICAgIHRlcm1pbmFsID0gcmVxdWlyZSgnLi4vdGVybWluYWwnKTtcblxucmVxdWlyZSgnLi9Ub29sYmFyLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KFwiVG9vbGJhclwiLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGNsaWNrKHtcbiAgICAgICAgICAgICcuVG9vbGJhci1ydW4nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICB0ZXJtaW5hbC5jbGVhcigpO1xuICAgICAgICAgICAgICAgIGVkaXRvci5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9Ub29sYmFyLmhhbmRsZWJhcnMnKVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1Ub29sYmFye2JhY2tncm91bmQ6I0YxRjBGMDtib3JkZXItYm90dG9tOnNvbGlkIDFweCAjQ0NDOy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveH0uVG9vbGJhci1ydW57ZmxvYXQ6cmlnaHR9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgdGVtcGxhdGVyID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKS5kZWZhdWx0LnRlbXBsYXRlO21vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVyKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgc3RhY2sxLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbiwgc2VsZj10aGlzO1xuXG5mdW5jdGlvbiBwcm9ncmFtMShkZXB0aDAsZGF0YSkge1xuICBcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyO1xuICBidWZmZXIgKz0gXCJcXG4gICAgPGRpdiBjbGFzcz0nVHJheS1CdXR0b24nIGRhdGEtdHlwZT0nXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLnR5cGUpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAudHlwZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCInPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5uYW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLm5hbWUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCI8L2Rpdj5cXG5cIjtcbiAgcmV0dXJuIGJ1ZmZlcjtcbiAgfVxuXG4gIHN0YWNrMSA9IGhlbHBlcnMuZWFjaC5jYWxsKGRlcHRoMCwgKGRlcHRoMCAmJiBkZXB0aDAuYnV0dG9ucyksIHtoYXNoOnt9LGludmVyc2U6c2VsZi5ub29wLGZuOnNlbGYucHJvZ3JhbSgxLCBwcm9ncmFtMSwgZGF0YSksZGF0YTpkYXRhfSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgcmV0dXJuIHN0YWNrMTsgfVxuICBlbHNlIHsgcmV0dXJuICcnOyB9XG4gIH0pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGJ1dHRvbnMgPSByZXF1aXJlKCcuLi9Ub2tlbnMvaW5kZXguanMnKSxcbiAgICBkcmFnICAgID0gcmVxdWlyZSgnb25kcmFnJyksXG4gICAgY2xpY2sgICA9IHJlcXVpcmUoJ29uY2xpY2snKSxcbiAgICBjdXJzb3IgID0gcmVxdWlyZSgnLi4vRWRpdG9yL2N1cnNvcicpO1xuXG5yZXF1aXJlKCcuL1RyYXkubGVzcycpO1xuXG4vKioqIFNldHVwIERyYWdnaW5nICoqKi9cblxuZHJhZygnLlRyYXktQnV0dG9uJywge1xuICAgIGhlbHBlcjogXCJjbG9uZVwiLFxuICAgIHN0YXJ0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgXG4gICAgfSxcbiAgICBtb3ZlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgXG4gICAgfSxcbiAgICBzdG9wOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHR5cGUgPSB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJyk7XG4gICAgfVxufSk7XG5cbmNsaWNrKCcuVHJheS1CdXR0b24nLCBmdW5jdGlvbihlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIFxuICAgIHZhciB0eXBlID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScpO1xuICAgIGN1cnNvci5wYXN0ZSh0eXBlKTtcbn0pO1xuXG4vKioqIERlZmluZSB0aGUgU3VidmlldyAqKiovXG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnVHJheScsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgXG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZShcIi4vVHJheS5oYW5kbGViYXJzXCIpLFxuICAgIGRhdGE6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZGF0YSA9IFtdO1xuXG4gICAgICAgIHZhciBpID0gYnV0dG9ucy5sZW5ndGg7XG4gICAgICAgIHdoaWxlKGktLSkge1xuICAgICAgICAgICAgdmFyIEJ1dHRvbiA9IGJ1dHRvbnNbaV07XG5cbiAgICAgICAgICAgIGRhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgbmFtZTogQnV0dG9uLlZpZXcucHJvdG90eXBlLm1ldGEuZGlzcGxheSB8fCBCdXR0b24uVmlldy5wcm90b3R5cGUudGVtcGxhdGUsXG4gICAgICAgICAgICAgICAgdHlwZTogQnV0dG9uLnR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGJ1dHRvbnM6IGRhdGFcbiAgICAgICAgfTtcbiAgICB9XG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1UcmF5e2JhY2tncm91bmQ6I0YxRjBGMDtwYWRkaW5nOjVweDstbW96LWJveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LWJveC1zaXppbmc6Ym9yZGVyLWJveDtib3gtc2l6aW5nOmJvcmRlci1ib3h9LlRyYXktQnV0dG9ue2Rpc3BsYXk6aW5saW5lLWJsb2NrO3BhZGRpbmc6MnB4IDVweDttYXJnaW46MnB4IDA7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjNweDstbW96LWJvcmRlci1yYWRpdXM6M3B4O2JvcmRlci1yYWRpdXM6M3B4O2JhY2tncm91bmQ6IzEwNzVGNjtjb2xvcjojZmZmO2N1cnNvcjpwb2ludGVyfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0VkaXRvci9FZGl0b3InKS5zcGF3bigpO1xuIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIjtcblxuXG4gIGJ1ZmZlciArPSBcIjxkaXYgY2xhc3M9J3BhbmVsIHBhbmVsLWVkaXQnPlxcbiAgICBcIjtcbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLlRvb2xiYXIpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCJcXG4gICAgXCI7XG4gIHN0YWNrMSA9ICgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zdWJ2aWV3KSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS5lZGl0b3IpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCJcXG4gICAgXCI7XG4gIHN0YWNrMSA9ICgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zdWJ2aWV3KSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS5UcmF5KSksdHlwZW9mIHN0YWNrMSA9PT0gZnVuY3Rpb25UeXBlID8gc3RhY2sxLmFwcGx5KGRlcHRoMCkgOiBzdGFjazEpO1xuICBpZihzdGFjazEgfHwgc3RhY2sxID09PSAwKSB7IGJ1ZmZlciArPSBzdGFjazE7IH1cbiAgYnVmZmVyICs9IFwiXFxuPC9kaXY+XFxuXFxuPGRpdiBjbGFzcz0ncGFuZWwgcGFuZWwtcnVuJz5cXG4gICAgXCI7XG4gIHN0YWNrMSA9ICgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zdWJ2aWV3KSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS50ZXJtaW5hbCkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyBidWZmZXIgKz0gc3RhY2sxOyB9XG4gIGJ1ZmZlciArPSBcIlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKTtcbnJlcXVpcmUoJy4vbWFpbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnbWFpbicsIHtcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9tYWluLmhhbmRsZWJhcnMnKSxcbiAgICBzdWJ2aWV3czoge1xuICAgICAgICBUb29sYmFyOiAgICByZXF1aXJlKCcuL1Rvb2xiYXIvVG9vbGJhcicpLFxuICAgICAgICBlZGl0b3I6ICAgICByZXF1aXJlKCcuL2VkaXRvcicpLFxuICAgICAgICBUcmF5OiAgICAgICByZXF1aXJlKCcuL1RyYXkvVHJheScpLFxuICAgICAgICB0ZXJtaW5hbDogICAgcmVxdWlyZSgnLi90ZXJtaW5hbCcpXG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIucGFuZWx7ZGlzcGxheTppbmxpbmUtYmxvY2s7cG9zaXRpb246cmVsYXRpdmU7d2lkdGg6MzAwcHg7aGVpZ2h0OjQwMHB4O3ZlcnRpY2FsLWFsaWduOnRvcDtib3JkZXI6MXB4IHNvbGlkICNEQkRCREJ9LnZpZXctVG9vbGJhcntwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MzBweDt3aWR0aDoxMDAlfS52aWV3LUVkaXRvcntwb3NpdGlvbjphYnNvbHV0ZTtib3R0b206MTUwcHg7dG9wOjMwcHg7d2lkdGg6MTAwJX0udmlldy1UcmF5e3Bvc2l0aW9uOmFic29sdXRlO2hlaWdodDoxNTBweDtib3R0b206MDt3aWR0aDoxMDAlfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL1Rlcm1pbmFsL1Rlcm1pbmFsJykuc3Bhd24oKTtcbiJdfQ==
