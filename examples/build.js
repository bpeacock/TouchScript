(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require("../views/main.js");


},{"../views/main.js":131}],2:[function(require,module,exports){
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
},{"./handlebars/base":3,"./handlebars/exception":4,"./handlebars/runtime":5,"./handlebars/safe-string":6,"./handlebars/utils":7}],3:[function(require,module,exports){
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
},{"./exception":4,"./utils":7}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
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
},{"./base":3,"./exception":4,"./utils":7}],6:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],7:[function(require,module,exports){
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
},{"./safe-string":6}],8:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime');

},{"./dist/cjs/handlebars.runtime":2}],9:[function(require,module,exports){
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
},{}],10:[function(require,module,exports){
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


},{"unopinionate":9}],11:[function(require,module,exports){
module.exports=require(9)
},{}],12:[function(require,module,exports){
var $ = require('unopinionate').selector,
    $document = $(document);

var Drag = function(selector, config) {
    
};

Drag.prototype = {

};

module.exports = Drag;

},{"unopinionate":11}],13:[function(require,module,exports){
var $ = require('unopinionate').selector;

var Drop = function(selector, config) {

};

Drop.prototype = {

};

module.exports = Drop;
},{"unopinionate":11}],14:[function(require,module,exports){
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

},{"./Drag":12,"./Drop":13}],15:[function(require,module,exports){
module.exports=require(9)
},{}],16:[function(require,module,exports){
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


},{"./specialKeys":18,"unopinionate":15}],17:[function(require,module,exports){
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

},{"./Event.js":16}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){

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


},{"loglevel":20,"underscore":21}],23:[function(require,module,exports){
var _           = require('underscore'),
    log         = require('loglevel');

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
        this.listeners = {};

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

    /*** Event API ***/
    trigger: function(name, args) {
        var self = this;
        args = args || [];
        
        //Broadcast in all directions
        var directions = {
            up:     'find',
            down:   'parents',
            across: 'siblings'
        };

        _.find(directions, function(jqFunc, dir) {
            var selector = '.listener-'+name+'-'+dir;
            
            //Select $wrappers with the right listener class in the right direction
            var $els = self.$wrapper[jqFunc](selector + ', ' + selector+'-'+self.type);

            for(var i=0; i<$els.length; i++) {
                //Get the actual subview
                var recipient = subview($els[i]);

                //Check for a subview type specific callback
                var typedCallback = recipient.listeners[self.type + ":" + name + ":" + dir];
                if(typedCallback && typedCallback.apply(self, [args]) === false) {
                    return true; //Breaks if callback returns false
                }

                //Check for a general event callback
                var untypedCallback = recipient.listeners[name + ":" + dir];
                if(untypedCallback && untypedCallback.apply(self, [args]) === false) {
                    return true; //Breaks if callback returns false
                }
            }
        });
    },
    listen: function(event, callback, direction) {
        //Parse the event format "[view type]:[event name]"
        eventParts = event.split(':');
        
        var eventName = eventParts.length > 1 ? eventParts[1] : eventParts[0],
            viewType  = eventParts.length > 1 ? eventParts[0] : null;

        //Add the listener class
        this.$wrapper.addClass('listener-'+eventName+'-'+direction+(viewType ? '-'+viewType : ''));

        //Save the callback
        this.listeners[event+":"+direction] = callback;

        return this;
    },

    listenUp: function(event, callback) {
        var self = this;

        if(typeof event == 'string') {
            this.listen(event, callback, 'up');
        }
        else {
            _.each(event, function(callback, event) {
                self.listen(event, callback, 'up');
            });
        }
        
        return this;
    },
    listenDown: function(event, callback) {
        var self = this;

        if(typeof event == 'string') {
            this.listen(event, callback, 'down');
        }
        else {
            _.each(event, function(callback, event) {
                self.listen(event, callback, 'down');
            });
        }

        return this;
    },
    listenAcross: function(event, callback) {
        var self = this;

        if(typeof event == 'string') {
            this.listen(event, callback, 'across');
        }
        else {
            _.each(event, function(callback, event) {
                self.listen(event, callback, 'across');
            });
        }

        return this;
    },

    /*** Traversing ***/
    parent: function(type) {
        var $el = this.$wrapper.closest('.' + (type ? this._viewCssPrefix + type : 'view'));
        
        if($el && $el.length > 0) {
            return $el[0][subview._domPropertyName];
        }
        else {
            return null;
        }
    },
    next: function(type) {

    },
    prev: function(type) {

    },
    children: function(type) {

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


},{"loglevel":20,"underscore":21}],24:[function(require,module,exports){
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

},{"./State":22,"unopinionate":26}],25:[function(require,module,exports){
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
    if(!name.match(/^[a-zA-Z0-9\-_]+$/)) {
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
        subview.load();
    }
});


},{"./View":23,"./ViewPool":24,"loglevel":20,"underscore":21,"unopinionate":26}],26:[function(require,module,exports){
module.exports=require(9)
},{}],27:[function(require,module,exports){
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
},{"handlebars/runtime":8}],28:[function(require,module,exports){
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

},{"./Editor.handlebars":27,"./Editor.less":29,"./Toolbar/Toolbar":31,"./Tray/Tray":34,"./code":36,"subview":25}],29:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Toolbar{position:absolute;height:50px;width:100%}.view-Code{position:absolute;bottom:150px;top:50px;width:100%}.view-Tray{position:absolute;height:150px;bottom:0;width:100%}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],30:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Editor-Toolbar-open'>Open</button>\n\n<button class='Editor-Toolbar-run'>&#9658;</button>";
  });
},{"handlebars/runtime":8}],31:[function(require,module,exports){
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
                    self.trigger('run', function() {
                        code.run();
                    });
                }, 0);
            },
            '.Editor-Toolbar-open': function() {
                self.trigger('open');
            }
        });
    },
    template: require('./Toolbar.handlebars')
});

},{"../../Run/terminal":51,"../../UI/Toolbar/Toolbar":126,"../code":36,"./Toolbar.handlebars":30,"./Toolbar.less":32,"onclick":10}],32:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".Editor-Toolbar-run{float:right}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],33:[function(require,module,exports){
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
},{"handlebars/runtime":8}],34:[function(require,module,exports){
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
                name: Button.View.prototype.meta.display || Button.View.prototype.template,
                type: Button.type
            });
        }

        return {
            buttons: data
        };
    }
});
},{"../../UI/Code/Tokens/index":121,"../../UI/Code/cursor":122,"./Tray.handlebars":33,"./Tray.less":35,"onclick":10,"ondrag":14,"subview":25}],35:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Tray{background:#F1F0F0;padding:5px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.Tray-Button{display:inline-block;padding:2px 5px;margin:2px 0;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;background:#1075F6;color:#fff;cursor:pointer}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],36:[function(require,module,exports){
var code = require('../UI/Code/Code').spawn();

code.configure({
    terminal: require('../Run/terminal'),
    onError: function() {
        this.trigger('edit');
    }
});

module.exports = code;

},{"../Run/terminal":51,"../UI/Code/Code":52}],37:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var stack1, functionType="function";


  stack1 = ((stack1 = ((stack1 = (depth0 && depth0.subview)),stack1 == null || stack1 === false ? stack1 : stack1.Toolbar)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1);
  if(stack1 || stack1 === 0) { return stack1; }
  else { return ''; }
  });
},{"handlebars/runtime":8}],38:[function(require,module,exports){
var subview = require('subview');

require('./Files.less');

module.exports = subview('Files', {
    template: require('./Files.handlebars'),
    subviews: {
        Toolbar: require('./Toolbar/Toolbar')
    }
});

},{"./Files.handlebars":37,"./Files.less":39,"./Toolbar/Toolbar":41,"subview":25}],39:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],40:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Files-Toolbar-new'>New</button>\n\n<button class='Files-Toolbar-delete'>Delete</button>";
  });
},{"handlebars/runtime":8}],41:[function(require,module,exports){
var Toolbar  = require('../../UI/Toolbar/Toolbar'),
    click    = require('onclick');

require('./Toolbar.less');

module.exports = Toolbar.extend('Files-Toolbar', {
    init: function() {
        var self = this;

        click({
            '.Files-Toolbar-new': function() {
                self.trigger('edit');
            },
            '.Files-Toolbar-delete': function() {
                
            }
        });
    },
    template: require('./Toolbar.handlebars')
});

},{"../../UI/Toolbar/Toolbar":126,"./Toolbar.handlebars":40,"./Toolbar.less":42,"onclick":10}],42:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".Files-Toolbar-delete{float:right}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],43:[function(require,module,exports){
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
},{"handlebars/runtime":8}],44:[function(require,module,exports){
var subview = require('subview');

require('./Run.less');

module.exports = subview('Run', {
    template: require('./Run.handlebars'),
    subviews: {
        Toolbar:  require('./Toolbar/Toolbar'),
        terminal: require('./terminal')
    }
});

},{"./Run.handlebars":43,"./Run.less":45,"./Toolbar/Toolbar":49,"./terminal":51,"subview":25}],45:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Run-Terminal{position:absolute;top:50px;bottom:0;width:100%}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],46:[function(require,module,exports){
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

},{"./Terminal.less":47,"onkey":17,"subview":25}],47:[function(require,module,exports){
module.exports=require(39)
},{}],48:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<button class='Run-Toolbar-exit'>Exit</button>\n";
  });
},{"handlebars/runtime":8}],49:[function(require,module,exports){
var Toolbar  = require('../../UI/Toolbar/Toolbar'),
    click    = require('onclick');

require('./Toolbar.less');

module.exports = Toolbar.extend('Run-Toolbar', {
    init: function() {
        var self = this;

        click({
            '.Run-Toolbar-exit': function() {
                self.trigger('edit');
            }
        });
    },
    template: require('./Toolbar.handlebars')
});

},{"../../UI/Toolbar/Toolbar":126,"./Toolbar.handlebars":48,"./Toolbar.less":50,"onclick":10}],50:[function(require,module,exports){
module.exports=require(39)
},{}],51:[function(require,module,exports){
module.exports = require('./Terminal/Terminal').spawn();

},{"./Terminal/Terminal":46}],52:[function(require,module,exports){
var Block = require('./Components/Block');
require('./Code.less');

var noop = function() {};

module.exports = Block.extend('Code', {
    init: function() {
        this.focus();
    },
    configure: function(config) {
        this.terminal = config.terminal || null;
        this.onError  = config.onError  || noop;
        return this;
    },
    beforeRun: function() {
        this.environment.clear();
    },

    /*** Events ***/
    onError: noop
});

},{"./Code.less":53,"./Components/Block":54}],53:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code{overflow:hidden}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],54:[function(require,module,exports){
var subview     = require('subview'),
    cursor      = require('../cursor'),
    Line        = require('./Line'),
    Environment = require('./EnvironmentModel');

require('./Block.less');

module.exports = subview('Code-Block', {
    init: function() {
        var self = this;

        this.environment = new Environment();
        this.empty();

        this.listenDown('Code-Cursor:paste', function() {
            var last = subview(self.$wrapper.children().last());

            if(!last.isEmpty()) {
                self.addLine();
            }

            return false;
        });
    },
    empty: function() {
        this.html('');
        this.addLine();

        return this;
    },
    addLine: function(i) {
        var line = Line.spawn();
        this.$wrapper.append(line.$wrapper);
        return line;
    },
    focus: function() {
        subview(this.$wrapper.children().last()).focus();
        return this;
    },
    beforeRun: function() {},
    run: function() {
        this.beforeRun();

        //Run every line
        var children = this.$wrapper.children();
        for(var i=0; i<children.length; i++) {
            subview(children[i]).run();
        }

        return this;
    }
});

},{"../cursor":122,"./Block.less":55,"./EnvironmentModel":56,"./Line":59,"subview":25}],55:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code-Block{background:#fff;-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],56:[function(require,module,exports){
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
},{}],57:[function(require,module,exports){
var subview = require('subview'),
    cursor  = require('../cursor');

require('./Field.less');

$(document).on('mousedown touchstart', '.view-Code-Field', function(e) {
    e.stopPropagation();
    subview(this).focus();
});

module.exports = subview('Code-Field', {
    dump: function() {

    },
    focus: function() {
        cursor.appendTo(this.$wrapper);
        return this;
    },
    run: function() {
        var stack = [],
            token;

        //Get Tokens
        var tokens = this.$wrapper.children();

        //Ignore Empty Lines
        if(tokens.length === 0) {
            return;
        }

        //Build Stack
        for(var i=0; i<tokens.length; i++) {
            token = subview(tokens[i]);

            if(token.isOperator) {
                stack.push(token);
            }
            else if(token.isLiteral) {
                stack.push(token.val());
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
    error: require('./error')
});

},{"../cursor":122,"./Field.less":58,"./error":61,"subview":25}],58:[function(require,module,exports){
module.exports=require(39)
},{}],59:[function(require,module,exports){
var Field = require('./Field');

require('./Line.less');

module.exports = Field.extend('Code-Line', {
    isEmpty: function() {
        return this.$wrapper.children('.view-Code-Token').length === 0;
    }
});

},{"./Field":57,"./Line.less":60}],60:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code{counter-reset:lineNumber}.view-Code-Line{position:relative;min-height:1.2em;padding-left:30px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}.view-Code-Line:before{font-family:Consolas,monaco,monospace;counter-increment:lineNumber;content:counter(lineNumber);position:absolute;height:100%;width:34px;left:-4px;padding-left:8px;padding-top:.1em;background:#F1F0F0;border-right:1px solid #CCC;color:#555;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],61:[function(require,module,exports){
var Tooltip = require('../../Tooltip/Tooltip'),
    subview = require('subview');

require("./error.less");

var Err = Tooltip.extend('Code-Error');

module.exports = function(msg) {
    this.parent('Code').onError();

    return Err.spawn({
        msg:  msg,
        $el:  this.$wrapper
    });
};

},{"../../Tooltip/Tooltip":129,"./error.less":62,"subview":25}],62:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code-Error{background:#F70000;color:#fff;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;padding:2px 6px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],63:[function(require,module,exports){
var Field = require('../Components/Field');
require('./Argument.less');

module.exports = Field.extend('Argument', {
    init: function(config) {
        config = config || {};
        
        this.name = config.name || "";
        this.type = config.type || null;
    },
    template: "\u200B",
    tagName: 'span'
});

},{"../Components/Field":57,"./Argument.less":64}],64:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Argument{background:#fff;min-width:15px;min-height:1.2em;margin:0 2px;padding:.1em 2px;-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],65:[function(require,module,exports){
var Token       = require('../Token'),
    Argument    = require('../Argument');

require('./Assign.less');

module.exports = Token.extend('Code-Assign', {
    init: function() {
        this.$name = $("<input type='text' />");
        this.value = Argument.spawn();

        this.$wrapper
            .append(this.$name)
            .append(' = ')
            .append(this.value.$wrapper);
    },
    meta: {
        display: "Assign"
    },
    run: function() {
        var value = this.value.run();
        console.log(value);
        this.parent('Code-Block').environment.set(this.$name.val(), value);
        return value;
    },
    focus: function() {
        this.$name.focus();
    }
});
},{"../Argument":63,"../Token":119,"./Assign.less":66}],66:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code-Assign{background:#87F08B;display:inline-block;padding:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],67:[function(require,module,exports){
var Control  = require('../Control'),
    Argument = require('../../Argument'),
    Block    = require('../../../Components/Block');

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

},{"../../../Components/Block":54,"../../Argument":63,"../Control":69,"./Conditional.less":68}],68:[function(require,module,exports){
module.exports=require(39)
},{}],69:[function(require,module,exports){
require('./Control.less');

module.exports = require('../Token').extend('Control', {
    isControl: true,
    
    /*** Should Be Overwritten ***/
    run:    function() {},
    focus:  function() {},

    /*** Functions ***/
    validatePosition: function(cursor) {
        if(subview(cursor.$wrapper.parent()).type == 'Code-Line') {
            return true;
        }
        else {
            cursor.error(this.type + ' must go on its own line.');
            return false;
        }
    }
});

},{"../Token":119,"./Control.less":70}],70:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Control{background:orange;padding:2px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],71:[function(require,module,exports){
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
        this.$wrapper
            .append("while ")
            .append(this.condition.$wrapper)
            .append(':')
            .append(this.block.$wrapper);
    },
    meta: {
        display: 'while'
    },
    run: function() {
        while(this.condition.run()) {
            this.block.run();
        }
    },
    focus: function() {
        this.condition.focus();
    }
});

},{"../../../Components/Block":54,"../../Argument":63,"../Control":69,"./While.less":72}],72:[function(require,module,exports){
module.exports=require(39)
},{}],73:[function(require,module,exports){
module.exports = [
    require("./Conditional/Conditional"),
    require("./Loop/While")
];
},{"./Conditional/Conditional":67,"./Loop/While":71}],74:[function(require,module,exports){
var Argument = require('../Argument'),
    cursor   = require('../../cursor');

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
    }
});

},{"../../cursor":122,"../Argument":63,"../Token":119,"./Function.less":75}],75:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Function{display:inline-block;-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;background:#1075F6;margin:2px;padding:3px 5px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],76:[function(require,module,exports){
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
},{"../Function":74,"./Parentheses.less":77}],77:[function(require,module,exports){
module.exports=require(39)
},{}],78:[function(require,module,exports){
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

},{"../Function":74,"./Print.less":79}],79:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Parentheses{color:#747474;background:#FFF9B6}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],80:[function(require,module,exports){
module.exports = [
    require('./Print/Print'),
    require('./Parentheses/Parentheses')
];

},{"./Parentheses/Parentheses":76,"./Print/Print":78}],81:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-false,.view-true{color:#fff;background:#D32CD3}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],82:[function(require,module,exports){
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

},{"../Literal":84,"./Boolean.less":81}],83:[function(require,module,exports){
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

},{"../Literal":84,"./Boolean.less":81}],84:[function(require,module,exports){
require('./Literal.less');

module.exports = require('../Token').extend('Literal', {
    isLiteral: true,
    val: function() {}
});

},{"../Token":119,"./Literal.less":85}],85:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Literal{-webkit-border-radius:2px;-moz-border-radius:2px;border-radius:2px;padding:0 4px;margin:0 1px;display:inline-block}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],86:[function(require,module,exports){
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

},{"../Literal":84,"./Number.less":87}],87:[function(require,module,exports){
module.exports=require(39)
},{}],88:[function(require,module,exports){
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

},{"../Literal":84,"./String.less":89}],89:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-String{color:#000;background:#FFFFA1;padding:0;display:inline}.string-input{-moz-user-select:text;-ms-user-select:text;-khtml-user-select:text;-webkit-user-select:text;-o-user-select:text;user-select:text}.string-input:focus{outline:0}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],90:[function(require,module,exports){
var Literal     = require('../Literal'),
    Argument    = require('../../Argument');

require('./Var.less');

module.exports = Literal.extend('Code-Var', {
    isVar: true,
    init: function() {
        this.$name = $("<input type='text' />");

        this.$wrapper
            .append(this.$name);
    },
    meta: {
        display: "Var"
    },
    val: function() {
        return this.parent('Code-Block').environment.get(this.$name.val());
    },
    focus: function() {
        this.$name.focus();
    }
});
},{"../../Argument":63,"../Literal":84,"./Var.less":91}],91:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code-Var{background:#00f}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],92:[function(require,module,exports){
module.exports = [
    require('./String/String'),
    require('./Number/Number'),
    require('./Booleans/True'),
    require('./Booleans/False'),
    require('./Var/Var')
];

},{"./Booleans/False":82,"./Booleans/True":83,"./Number/Number":86,"./String/String":88,"./Var/Var":90}],93:[function(require,module,exports){
module.exports = require('./Boolean').extend('AND', {
    template: "AND",
    run: function(first, second) {
        return first && second;
    }
});

},{"./Boolean":94}],94:[function(require,module,exports){
var Operator = require('../Operator');
require('./Boolean.less');

module.exports = Operator.extend('Boolean', {
    precedence: 0
});
},{"../Operator":116,"./Boolean.less":95}],95:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Boolean{background:#F53939;font-style:italic}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],96:[function(require,module,exports){
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

},{"./Boolean":94}],97:[function(require,module,exports){
module.exports = require('./Boolean').extend('OR', {
    template: "OR",
    run: function(first, second) {
        return first || second;
    }
});

},{"./Boolean":94}],98:[function(require,module,exports){
module.exports = require('./Boolean').extend('XOR', {
    template: "XOR",
    run: function(first, second) {
        return !first != !second;
    }
});

},{"./Boolean":94}],99:[function(require,module,exports){
module.exports = [
    require('./AND'),
    require('./OR'),
    require('./XOR'),
    require('./NOT')
];

},{"./AND":93,"./NOT":96,"./OR":97,"./XOR":98}],100:[function(require,module,exports){
var Operator = require('../Operator');
require('./Comparator.less');

module.exports = Operator.extend('Comparator', {
    precedence: 1
});
},{"../Operator":116,"./Comparator.less":101}],101:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Comparator{background:#35C062}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],102:[function(require,module,exports){
module.exports = require('./Comparator').extend('Equals', {
    template: "=",
    run: function(first, second) {
        return first == second;
    }
});

},{"./Comparator":100}],103:[function(require,module,exports){
module.exports = require('./Comparator').extend('GreaterThan', {
    template: ">",
    run: function(first, second) {
        return first > second;
    }
});

},{"./Comparator":100}],104:[function(require,module,exports){
module.exports = require('./Comparator').extend('GreaterThanEquals', {
    template: "&ge;",
    run: function(first, second) {
        return first >= second;
    }
});

},{"./Comparator":100}],105:[function(require,module,exports){
module.exports = require('./Comparator').extend('LessThan', {
    template: "<",
    run: function(first, second) {
        return first < second;
    }
});
},{"./Comparator":100}],106:[function(require,module,exports){
module.exports = require('./Comparator').extend('LessThanEquals', {
    template: "&le;",
    run: function(first, second) {
        return first <= second;
    }
});

},{"./Comparator":100}],107:[function(require,module,exports){
module.exports = [
    require('./GreaterThan'),
    require('./GreaterThanEquals'),
    require('./Equals'),
    require('./LessThanEquals'),
    require('./LessThan')
];
},{"./Equals":102,"./GreaterThan":103,"./GreaterThanEquals":104,"./LessThan":105,"./LessThanEquals":106}],108:[function(require,module,exports){
module.exports = require('./Math').extend('Divide', {
    template: "&frasl;",
    precedence: 3,
    run: function(first, second) {
        return first/second;
    }
});

},{"./Math":110}],109:[function(require,module,exports){
module.exports = require('./Math').extend('Exp', {
    template: "^",
    precedence: 4,
    run: Math.pow
});
},{"./Math":110}],110:[function(require,module,exports){
var Operator = require('../Operator');
require('./Math.less');

module.exports = Operator.extend('Math', {
    
});
},{"../Operator":116,"./Math.less":111}],111:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Math{background:#F53939}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],112:[function(require,module,exports){
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

},{"./Math":110}],113:[function(require,module,exports){
module.exports = require('./Math').extend('Multiply', {
    template: "&times;",
    precedence: 3,
    run: function(first, second) {
        return first*second;
    }
});

},{"./Math":110}],114:[function(require,module,exports){
module.exports = require('./Math').extend('Plus', {
    template: "+",
    precedence: 2,
    run: function(first, second) {
        return first + second;
    }
});

},{"./Math":110}],115:[function(require,module,exports){
module.exports = [
    require('./Exp'),
    require('./Divide'),
    require('./Multiply'),
    require('./Minus'),
    require('./Plus')
];

},{"./Divide":108,"./Exp":109,"./Minus":112,"./Multiply":113,"./Plus":114}],116:[function(require,module,exports){
require('./Operator.less');

module.exports = require('../Token').extend('Operator', {
    isOperator: true,
    tagName: 'span'
});

},{"../Token":119,"./Operator.less":117}],117:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Operator{-webkit-border-radius:3px;-moz-border-radius:3px;border-radius:3px;padding:0 4px;margin:0 1px;display:inline-block}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],118:[function(require,module,exports){
module.exports = require('./Comparators/index').concat(
    require('./Math/index'),
    require('./Boolean/index')
);
},{"./Boolean/index":99,"./Comparators/index":107,"./Math/index":115}],119:[function(require,module,exports){
var subview = require('subview'),
    cursor  = require('../cursor');

require('./Token.less');

module.exports = subview('Code-Token', {
    isToken: true,
    init: function() {},
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
    }
});

},{"../Components/error":61,"../cursor":122,"./Token.less":120,"subview":25}],120:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Code-Token{color:#FFF}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],121:[function(require,module,exports){
module.exports = require('./Functions/index').concat(
    require('./Literals/index'),
    require('./Operators/index'),
    require('./Control/index'),
    require('./Assign/Assign')
);
},{"./Assign/Assign":65,"./Control/index":73,"./Functions/index":80,"./Literals/index":92,"./Operators/index":118}],122:[function(require,module,exports){
var subview = require('subview');

require('./cursor.less');

var Cursor = subview('Code-Cursor', {
    init: function() {
        var self = this;

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
        if(Type.View.prototype.validatePosition(this)) {

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

},{"./Components/error":61,"./cursor.less":123,"subview":25}],123:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "@-webkit-keyframes flash{0%,100%{opacity:1}50%{opacity:0}}.view-Code-Cursor{position:relative;display:inline-block;width:2px;height:1.1em;margin:-.05em -1px;top:.05em;background:#1279FC;-webkit-animation:flash 1s infinite}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],124:[function(require,module,exports){
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
    config: function() {
        this.$slider = $("<div class='Slider-Slider'>")
            .appendTo(this.$wrapper);
    },
    render: function() {
        this.panelWidth = 100/this.panels.length;
        
        //Build the panels
        for(var i=0; i<this.panels.length; i++) {
            var panel = this.panels[i],
                subview = panel.content.isViewPool ? panel.content.spawn() : panel.content;

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
        var self = this;

        //Show the default panel
        this.show(this.defaultPanel);

        //Configure Transitions
        this._setupTransitions();
    },
    clean: function() {
        this.panels         = {};
        this.defaultPanel   = 0;
        this.$wrapper.html('');
        this._removeTransitions();
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

},{"./Slider.less":125,"prefix":19,"subview":25,"unopinionate":26}],125:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Slider{position:relative;width:100%;height:100%;overflow:hidden}.Slider-Slider{position:absolute;left:0;top:0;height:100%;white-space:nowrap}.Slider-Panel{display:inline-block;position:relative;height:100%;vertical-align:top;white-space:normal}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],126:[function(require,module,exports){
var subview     = require('subview'),
    click    = require('onclick');

require('./Toolbar.less');

module.exports = subview("Toolbar");

},{"./Toolbar.less":127,"onclick":10,"subview":25}],127:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Toolbar{position:absolute;height:50px;width:100%;background:#F1F0F0;border-bottom:solid 1px #CCC;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;box-sizing:border-box;padding-top:20px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],128:[function(require,module,exports){
var templater = require("handlebars/runtime").default.template;module.exports = templater(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  if (helper = helpers.msg) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.msg); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  return escapeExpression(stack1);
  });
},{"handlebars/runtime":8}],129:[function(require,module,exports){
var subview = require('subview'),
    $       = require('unopinionate').selector;

var $body = $('body');

require('./Tooltip.less');

module.exports = subview('Tooltip', {
    config: function(config) {
        this.msg = config.msg;
        this.$el = config.$el;
        this.$constrain = config.$constrain || $body; //Constraint should always have relative or absolute positioning
    },
    init: function() {

        /*** Append to Document ***/
        // Do this here so that the default dimensions show up
        this.$constrain.append(this.$wrapper);
        this.$wrapper.append(this.$arrow);

        /*** Get position data ***/
        var el      = this.$el.position(),
            con     = this.$constrain.position();

        el.width    = this.$el.outerWidth();
        el.height   = this.$el.outerHeight();

        con.width   = this.$constrain.outerWidth();
        con.height  = this.$constrain.outerHeight();

        var wrapH   = this.$wrapper.outerHeight(),
            wrapW   = this.$wrapper.outerWidth();

        //Get derived position data
        el.mid = el.left + el.width/2;

        /*** Determine vertical position ***/
        var topSpace    = el.top - con.top,
            bottomSpace = (con.top + con.height) - (el.top + el.height);

        console.log(el);
        console.log(con);

        console.log(topSpace);
        console.log(bottomSpace);

        //Put it above the element
        if(topSpace > bottomSpace) {
            console.log('above');
            if(wrapH > topSpace) {
                wrapH = topSpace;
            }

            this.$wrapper.css('top', el.top - wrapH);
        }

        //Put it below the element
        else {
            console.log('below');
            console.log(wrapH);
            if(wrapH > bottomSpace) {
                wrapH = topSpace;
            }

            this.$wrapper.css('top', el.top + el.height);
        }

        this.$wrapper.css('height', wrapH);

        /*** Determine Horizontal Position ***/
        var centerLeft = el.mid - wrapW/2;
        
        if(centerLeft < con.left) {
            this.$wrapper.css('left', 0);
        }
        else if(centerLeft + wrapW > con.left + con.width) {
            this.$wrapper.css('right', centerLeft);
        }
        else {
            this.$wrapper.css('left', centerLeft);
        }
        
        
    },
    clean: function() {
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
},{"./Tooltip.handlebars":128,"./Tooltip.less":130,"subview":25,"unopinionate":26}],130:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = ".view-Tooltip{position:absolute;max-width:100%;max-height:100%;overflow:auto}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],131:[function(require,module,exports){
var Slider = require('./UI/Slider/Slider');

require('./main.less');

module.exports = Slider.extend('main', {
    init: function() {
        var self = this;

        this.listenDown({
            open: function() {
                self.show('files');
            },
            edit: function() {
                self.show('editor');
            },
            run: function(callback) {
                self.show('run', callback);
            }
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
    defaultPanel: 'editor'
});

},{"./Editor/Editor":28,"./Files/Files":38,"./Run/Run":44,"./UI/Slider/Slider":124,"./main.less":132}],132:[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; style = document.createElement('style'); style.type = 'text/css';var css = "body,html{height:100%;width:100%}body{-moz-user-select:none;-ms-user-select:none;-khtml-user-select:none;-webkit-user-select:none;-o-user-select:none;user-select:none;margin:0;position:absolute;font-family:Avenir,\"Helvetica Neue\",Helvetica,sans-serif}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9ncnVudC1icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL2V4YW1wbGVzL2V4YW1wbGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMucnVudGltZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9iYXNlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2V4Y2VwdGlvbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9ydW50aW1lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3NhZmUtc3RyaW5nLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL3V0aWxzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ydW50aW1lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvb25jbGljay9ub2RlX21vZHVsZXMvdW5vcGluaW9uYXRlL3Vub3BpbmlvbmF0ZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29uY2xpY2svc3JjL29uQ2xpY2suanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9vbmRyYWcvc3JjL0RyYWcuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9vbmRyYWcvc3JjL0Ryb3AuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9vbmRyYWcvc3JjL21haW4uanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9vbmtleS9zcmMvRXZlbnQuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL25vZGVfbW9kdWxlcy9vbmtleS9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL29ua2V5L3NyYy9zcGVjaWFsS2V5cy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL3ByZWZpeC9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL3N1YnZpZXcvbm9kZV9tb2R1bGVzL2xvZ2xldmVsL2xpYi9sb2dsZXZlbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL3N1YnZpZXcvbm9kZV9tb2R1bGVzL3VuZGVyc2NvcmUvdW5kZXJzY29yZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL3N1YnZpZXcvc3JjL1N0YXRlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvc3Vidmlldy9zcmMvVmlldy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvbm9kZV9tb2R1bGVzL3N1YnZpZXcvc3JjL1ZpZXdQb29sLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS9ub2RlX21vZHVsZXMvc3Vidmlldy9zcmMvbWFpbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvRWRpdG9yL0VkaXRvci5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvRWRpdG9yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvRWRpdG9yLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0VkaXRvci9Ub29sYmFyL1Rvb2xiYXIuaGFuZGxlYmFycyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvRWRpdG9yL1Rvb2xiYXIvVG9vbGJhci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvRWRpdG9yL1Rvb2xiYXIvVG9vbGJhci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9FZGl0b3IvVHJheS9UcmF5LmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0VkaXRvci9UcmF5L1RyYXkuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0VkaXRvci9UcmF5L1RyYXkubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvRWRpdG9yL2NvZGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0ZpbGVzL0ZpbGVzLmhhbmRsZWJhcnMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL0ZpbGVzL0ZpbGVzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9GaWxlcy9GaWxlcy5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9GaWxlcy9Ub29sYmFyL1Rvb2xiYXIuaGFuZGxlYmFycyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvRmlsZXMvVG9vbGJhci9Ub29sYmFyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9GaWxlcy9Ub29sYmFyL1Rvb2xiYXIubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvUnVuL1J1bi5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9SdW4vUnVuLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9SdW4vUnVuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1J1bi9UZXJtaW5hbC9UZXJtaW5hbC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvUnVuL1Rvb2xiYXIvVG9vbGJhci5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9SdW4vVG9vbGJhci9Ub29sYmFyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9SdW4vdGVybWluYWwuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvQ29kZS5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Db2RlLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9CbG9jay5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Db21wb25lbnRzL0Jsb2NrLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9FbnZpcm9ubWVudE1vZGVsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL0NvbXBvbmVudHMvRmllbGQuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9MaW5lLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL0NvbXBvbmVudHMvTGluZS5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL0NvbXBvbmVudHMvZXJyb3IuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvQ29tcG9uZW50cy9lcnJvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9Bcmd1bWVudC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvQXJndW1lbnQubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvQXNzaWduL0Fzc2lnbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvQXNzaWduL0Fzc2lnbi5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9Db250cm9sL0NvbmRpdGlvbmFsL0NvbmRpdGlvbmFsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9Db250cm9sL0NvbnRyb2wuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0NvbnRyb2wvQ29udHJvbC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9Db250cm9sL0xvb3AvV2hpbGUuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0NvbnRyb2wvaW5kZXguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0Z1bmN0aW9ucy9GdW5jdGlvbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvRnVuY3Rpb25zL0Z1bmN0aW9uLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0Z1bmN0aW9ucy9QYXJlbnRoZXNlcy9QYXJlbnRoZXNlcy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvRnVuY3Rpb25zL1ByaW50L1ByaW50LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9GdW5jdGlvbnMvUHJpbnQvUHJpbnQubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvRnVuY3Rpb25zL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9Cb29sZWFucy9Cb29sZWFuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL0Jvb2xlYW5zL0ZhbHNlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9Cb29sZWFucy9UcnVlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9MaXRlcmFsLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9MaXRlcmFsLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL051bWJlci9OdW1iZXIuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL1N0cmluZy9TdHJpbmcuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL0xpdGVyYWxzL1N0cmluZy9TdHJpbmcubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvTGl0ZXJhbHMvVmFyL1Zhci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvTGl0ZXJhbHMvVmFyL1Zhci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9MaXRlcmFscy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0Jvb2xlYW4vQU5ELmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9Cb29sZWFuLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQm9vbGVhbi9Cb29sZWFuLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL05PVC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0Jvb2xlYW4vT1IuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Cb29sZWFuL1hPUi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0Jvb2xlYW4vaW5kZXguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9Db21wYXJhdG9yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvQ29tcGFyYXRvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvRXF1YWxzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvR3JlYXRlclRoYW4uanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9HcmVhdGVyVGhhbkVxdWFscy5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL0NvbXBhcmF0b3JzL0xlc3NUaGFuLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvQ29tcGFyYXRvcnMvTGVzc1RoYW5FcXVhbHMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9Db21wYXJhdG9ycy9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvRGl2aWRlLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9FeHAuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9NYXRoL01hdGguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9NYXRoL01hdGgubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL01hdGgvTWludXMuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvVG9rZW5zL09wZXJhdG9ycy9NYXRoL011bHRpcGx5LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9QbHVzLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvTWF0aC9pbmRleC5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL09wZXJhdG9yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9PcGVyYXRvcnMvT3BlcmF0b3IubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvT3BlcmF0b3JzL2luZGV4LmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL1Rva2Vucy9Ub2tlbi5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvVG9rZW4ubGVzcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvQ29kZS9Ub2tlbnMvaW5kZXguanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL0NvZGUvY3Vyc29yLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Db2RlL2N1cnNvci5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9TbGlkZXIvU2xpZGVyLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9TbGlkZXIvU2xpZGVyLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL1Rvb2xiYXIvVG9vbGJhci5qcyIsIi9Vc2Vycy9icmlhbnBlYWNvY2svYXBwcy9Ub3VjaENvZGUvdmlld3MvVUkvVG9vbGJhci9Ub29sYmFyLmxlc3MiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL1Rvb2x0aXAvVG9vbHRpcC5oYW5kbGViYXJzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9VSS9Ub29sdGlwL1Rvb2x0aXAuanMiLCIvVXNlcnMvYnJpYW5wZWFjb2NrL2FwcHMvVG91Y2hDb2RlL3ZpZXdzL1VJL1Rvb2x0aXAvVG9vbHRpcC5sZXNzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9tYWluLmpzIiwiL1VzZXJzL2JyaWFucGVhY29jay9hcHBzL1RvdWNoQ29kZS92aWV3cy9tYWluLmxlc3MiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25MQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzNJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1dkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqQkE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwREE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDeEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BOztBQ0FBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwicmVxdWlyZShcIi4uL3ZpZXdzL21haW4uanNcIik7XG5cbiIsIlwidXNlIHN0cmljdFwiO1xuLypnbG9iYWxzIEhhbmRsZWJhcnM6IHRydWUgKi9cbnZhciBiYXNlID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9iYXNlXCIpO1xuXG4vLyBFYWNoIG9mIHRoZXNlIGF1Z21lbnQgdGhlIEhhbmRsZWJhcnMgb2JqZWN0LiBObyBuZWVkIHRvIHNldHVwIGhlcmUuXG4vLyAoVGhpcyBpcyBkb25lIHRvIGVhc2lseSBzaGFyZSBjb2RlIGJldHdlZW4gY29tbW9uanMgYW5kIGJyb3dzZSBlbnZzKVxudmFyIFNhZmVTdHJpbmcgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3NhZmUtc3RyaW5nXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3V0aWxzXCIpO1xudmFyIHJ1bnRpbWUgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3J1bnRpbWVcIik7XG5cbi8vIEZvciBjb21wYXRpYmlsaXR5IGFuZCB1c2FnZSBvdXRzaWRlIG9mIG1vZHVsZSBzeXN0ZW1zLCBtYWtlIHRoZSBIYW5kbGViYXJzIG9iamVjdCBhIG5hbWVzcGFjZVxudmFyIGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaGIgPSBuZXcgYmFzZS5IYW5kbGViYXJzRW52aXJvbm1lbnQoKTtcblxuICBVdGlscy5leHRlbmQoaGIsIGJhc2UpO1xuICBoYi5TYWZlU3RyaW5nID0gU2FmZVN0cmluZztcbiAgaGIuRXhjZXB0aW9uID0gRXhjZXB0aW9uO1xuICBoYi5VdGlscyA9IFV0aWxzO1xuXG4gIGhiLlZNID0gcnVudGltZTtcbiAgaGIudGVtcGxhdGUgPSBmdW5jdGlvbihzcGVjKSB7XG4gICAgcmV0dXJuIHJ1bnRpbWUudGVtcGxhdGUoc3BlYywgaGIpO1xuICB9O1xuXG4gIHJldHVybiBoYjtcbn07XG5cbnZhciBIYW5kbGViYXJzID0gY3JlYXRlKCk7XG5IYW5kbGViYXJzLmNyZWF0ZSA9IGNyZWF0ZTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBIYW5kbGViYXJzOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHNcIik7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcblxudmFyIFZFUlNJT04gPSBcIjEuMy4wXCI7XG5leHBvcnRzLlZFUlNJT04gPSBWRVJTSU9OO3ZhciBDT01QSUxFUl9SRVZJU0lPTiA9IDQ7XG5leHBvcnRzLkNPTVBJTEVSX1JFVklTSU9OID0gQ09NUElMRVJfUkVWSVNJT047XG52YXIgUkVWSVNJT05fQ0hBTkdFUyA9IHtcbiAgMTogJzw9IDEuMC5yYy4yJywgLy8gMS4wLnJjLjIgaXMgYWN0dWFsbHkgcmV2MiBidXQgZG9lc24ndCByZXBvcnQgaXRcbiAgMjogJz09IDEuMC4wLXJjLjMnLFxuICAzOiAnPT0gMS4wLjAtcmMuNCcsXG4gIDQ6ICc+PSAxLjAuMCdcbn07XG5leHBvcnRzLlJFVklTSU9OX0NIQU5HRVMgPSBSRVZJU0lPTl9DSEFOR0VTO1xudmFyIGlzQXJyYXkgPSBVdGlscy5pc0FycmF5LFxuICAgIGlzRnVuY3Rpb24gPSBVdGlscy5pc0Z1bmN0aW9uLFxuICAgIHRvU3RyaW5nID0gVXRpbHMudG9TdHJpbmcsXG4gICAgb2JqZWN0VHlwZSA9ICdbb2JqZWN0IE9iamVjdF0nO1xuXG5mdW5jdGlvbiBIYW5kbGViYXJzRW52aXJvbm1lbnQoaGVscGVycywgcGFydGlhbHMpIHtcbiAgdGhpcy5oZWxwZXJzID0gaGVscGVycyB8fCB7fTtcbiAgdGhpcy5wYXJ0aWFscyA9IHBhcnRpYWxzIHx8IHt9O1xuXG4gIHJlZ2lzdGVyRGVmYXVsdEhlbHBlcnModGhpcyk7XG59XG5cbmV4cG9ydHMuSGFuZGxlYmFyc0Vudmlyb25tZW50ID0gSGFuZGxlYmFyc0Vudmlyb25tZW50O0hhbmRsZWJhcnNFbnZpcm9ubWVudC5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBIYW5kbGViYXJzRW52aXJvbm1lbnQsXG5cbiAgbG9nZ2VyOiBsb2dnZXIsXG4gIGxvZzogbG9nLFxuXG4gIHJlZ2lzdGVySGVscGVyOiBmdW5jdGlvbihuYW1lLCBmbiwgaW52ZXJzZSkge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBpZiAoaW52ZXJzZSB8fCBmbikgeyB0aHJvdyBuZXcgRXhjZXB0aW9uKCdBcmcgbm90IHN1cHBvcnRlZCB3aXRoIG11bHRpcGxlIGhlbHBlcnMnKTsgfVxuICAgICAgVXRpbHMuZXh0ZW5kKHRoaXMuaGVscGVycywgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpbnZlcnNlKSB7IGZuLm5vdCA9IGludmVyc2U7IH1cbiAgICAgIHRoaXMuaGVscGVyc1tuYW1lXSA9IGZuO1xuICAgIH1cbiAgfSxcblxuICByZWdpc3RlclBhcnRpYWw6IGZ1bmN0aW9uKG5hbWUsIHN0cikge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBVdGlscy5leHRlbmQodGhpcy5wYXJ0aWFscywgIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhcnRpYWxzW25hbWVdID0gc3RyO1xuICAgIH1cbiAgfVxufTtcblxuZnVuY3Rpb24gcmVnaXN0ZXJEZWZhdWx0SGVscGVycyhpbnN0YW5jZSkge1xuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignaGVscGVyTWlzc2luZycsIGZ1bmN0aW9uKGFyZykge1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJNaXNzaW5nIGhlbHBlcjogJ1wiICsgYXJnICsgXCInXCIpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2Jsb2NrSGVscGVyTWlzc2luZycsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgaW52ZXJzZSA9IG9wdGlvbnMuaW52ZXJzZSB8fCBmdW5jdGlvbigpIHt9LCBmbiA9IG9wdGlvbnMuZm47XG5cbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZihjb250ZXh0ID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZm4odGhpcyk7XG4gICAgfSBlbHNlIGlmKGNvbnRleHQgPT09IGZhbHNlIHx8IGNvbnRleHQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KGNvbnRleHQpKSB7XG4gICAgICBpZihjb250ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnMuZWFjaChjb250ZXh0LCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZm4oY29udGV4dCk7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignZWFjaCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgZm4gPSBvcHRpb25zLmZuLCBpbnZlcnNlID0gb3B0aW9ucy5pbnZlcnNlO1xuICAgIHZhciBpID0gMCwgcmV0ID0gXCJcIiwgZGF0YTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRleHQpKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICAgIGlmIChvcHRpb25zLmRhdGEpIHtcbiAgICAgIGRhdGEgPSBjcmVhdGVGcmFtZShvcHRpb25zLmRhdGEpO1xuICAgIH1cblxuICAgIGlmKGNvbnRleHQgJiYgdHlwZW9mIGNvbnRleHQgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoaXNBcnJheShjb250ZXh0KSkge1xuICAgICAgICBmb3IodmFyIGogPSBjb250ZXh0Lmxlbmd0aDsgaTxqOyBpKyspIHtcbiAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgZGF0YS5pbmRleCA9IGk7XG4gICAgICAgICAgICBkYXRhLmZpcnN0ID0gKGkgPT09IDApO1xuICAgICAgICAgICAgZGF0YS5sYXN0ICA9IChpID09PSAoY29udGV4dC5sZW5ndGgtMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2ldLCB7IGRhdGE6IGRhdGEgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvcih2YXIga2V5IGluIGNvbnRleHQpIHtcbiAgICAgICAgICBpZihjb250ZXh0Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGlmKGRhdGEpIHsgXG4gICAgICAgICAgICAgIGRhdGEua2V5ID0ga2V5OyBcbiAgICAgICAgICAgICAgZGF0YS5pbmRleCA9IGk7XG4gICAgICAgICAgICAgIGRhdGEuZmlyc3QgPSAoaSA9PT0gMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2tleV0sIHtkYXRhOiBkYXRhfSk7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoaSA9PT0gMCl7XG4gICAgICByZXQgPSBpbnZlcnNlKHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdpZicsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oY29uZGl0aW9uYWwpKSB7IGNvbmRpdGlvbmFsID0gY29uZGl0aW9uYWwuY2FsbCh0aGlzKTsgfVxuXG4gICAgLy8gRGVmYXVsdCBiZWhhdmlvciBpcyB0byByZW5kZXIgdGhlIHBvc2l0aXZlIHBhdGggaWYgdGhlIHZhbHVlIGlzIHRydXRoeSBhbmQgbm90IGVtcHR5LlxuICAgIC8vIFRoZSBgaW5jbHVkZVplcm9gIG9wdGlvbiBtYXkgYmUgc2V0IHRvIHRyZWF0IHRoZSBjb25kdGlvbmFsIGFzIHB1cmVseSBub3QgZW1wdHkgYmFzZWQgb24gdGhlXG4gICAgLy8gYmVoYXZpb3Igb2YgaXNFbXB0eS4gRWZmZWN0aXZlbHkgdGhpcyBkZXRlcm1pbmVzIGlmIDAgaXMgaGFuZGxlZCBieSB0aGUgcG9zaXRpdmUgcGF0aCBvciBuZWdhdGl2ZS5cbiAgICBpZiAoKCFvcHRpb25zLmhhc2guaW5jbHVkZVplcm8gJiYgIWNvbmRpdGlvbmFsKSB8fCBVdGlscy5pc0VtcHR5KGNvbmRpdGlvbmFsKSkge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuaW52ZXJzZSh0aGlzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuZm4odGhpcyk7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcigndW5sZXNzJywgZnVuY3Rpb24oY29uZGl0aW9uYWwsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gaW5zdGFuY2UuaGVscGVyc1snaWYnXS5jYWxsKHRoaXMsIGNvbmRpdGlvbmFsLCB7Zm46IG9wdGlvbnMuaW52ZXJzZSwgaW52ZXJzZTogb3B0aW9ucy5mbiwgaGFzaDogb3B0aW9ucy5oYXNofSk7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCd3aXRoJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRleHQpKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICAgIGlmICghVXRpbHMuaXNFbXB0eShjb250ZXh0KSkgcmV0dXJuIG9wdGlvbnMuZm4oY29udGV4dCk7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb2cnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIGxldmVsID0gb3B0aW9ucy5kYXRhICYmIG9wdGlvbnMuZGF0YS5sZXZlbCAhPSBudWxsID8gcGFyc2VJbnQob3B0aW9ucy5kYXRhLmxldmVsLCAxMCkgOiAxO1xuICAgIGluc3RhbmNlLmxvZyhsZXZlbCwgY29udGV4dCk7XG4gIH0pO1xufVxuXG52YXIgbG9nZ2VyID0ge1xuICBtZXRob2RNYXA6IHsgMDogJ2RlYnVnJywgMTogJ2luZm8nLCAyOiAnd2FybicsIDM6ICdlcnJvcicgfSxcblxuICAvLyBTdGF0ZSBlbnVtXG4gIERFQlVHOiAwLFxuICBJTkZPOiAxLFxuICBXQVJOOiAyLFxuICBFUlJPUjogMyxcbiAgbGV2ZWw6IDMsXG5cbiAgLy8gY2FuIGJlIG92ZXJyaWRkZW4gaW4gdGhlIGhvc3QgZW52aXJvbm1lbnRcbiAgbG9nOiBmdW5jdGlvbihsZXZlbCwgb2JqKSB7XG4gICAgaWYgKGxvZ2dlci5sZXZlbCA8PSBsZXZlbCkge1xuICAgICAgdmFyIG1ldGhvZCA9IGxvZ2dlci5tZXRob2RNYXBbbGV2ZWxdO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiBjb25zb2xlW21ldGhvZF0pIHtcbiAgICAgICAgY29uc29sZVttZXRob2RdLmNhbGwoY29uc29sZSwgb2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5leHBvcnRzLmxvZ2dlciA9IGxvZ2dlcjtcbmZ1bmN0aW9uIGxvZyhsZXZlbCwgb2JqKSB7IGxvZ2dlci5sb2cobGV2ZWwsIG9iaik7IH1cblxuZXhwb3J0cy5sb2cgPSBsb2c7dmFyIGNyZWF0ZUZyYW1lID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gIHZhciBvYmogPSB7fTtcbiAgVXRpbHMuZXh0ZW5kKG9iaiwgb2JqZWN0KTtcbiAgcmV0dXJuIG9iajtcbn07XG5leHBvcnRzLmNyZWF0ZUZyYW1lID0gY3JlYXRlRnJhbWU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBlcnJvclByb3BzID0gWydkZXNjcmlwdGlvbicsICdmaWxlTmFtZScsICdsaW5lTnVtYmVyJywgJ21lc3NhZ2UnLCAnbmFtZScsICdudW1iZXInLCAnc3RhY2snXTtcblxuZnVuY3Rpb24gRXhjZXB0aW9uKG1lc3NhZ2UsIG5vZGUpIHtcbiAgdmFyIGxpbmU7XG4gIGlmIChub2RlICYmIG5vZGUuZmlyc3RMaW5lKSB7XG4gICAgbGluZSA9IG5vZGUuZmlyc3RMaW5lO1xuXG4gICAgbWVzc2FnZSArPSAnIC0gJyArIGxpbmUgKyAnOicgKyBub2RlLmZpcnN0Q29sdW1uO1xuICB9XG5cbiAgdmFyIHRtcCA9IEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuXG4gIC8vIFVuZm9ydHVuYXRlbHkgZXJyb3JzIGFyZSBub3QgZW51bWVyYWJsZSBpbiBDaHJvbWUgKGF0IGxlYXN0KSwgc28gYGZvciBwcm9wIGluIHRtcGAgZG9lc24ndCB3b3JrLlxuICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBlcnJvclByb3BzLmxlbmd0aDsgaWR4KyspIHtcbiAgICB0aGlzW2Vycm9yUHJvcHNbaWR4XV0gPSB0bXBbZXJyb3JQcm9wc1tpZHhdXTtcbiAgfVxuXG4gIGlmIChsaW5lKSB7XG4gICAgdGhpcy5saW5lTnVtYmVyID0gbGluZTtcbiAgICB0aGlzLmNvbHVtbiA9IG5vZGUuZmlyc3RDb2x1bW47XG4gIH1cbn1cblxuRXhjZXB0aW9uLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEV4Y2VwdGlvbjsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG52YXIgQ09NUElMRVJfUkVWSVNJT04gPSByZXF1aXJlKFwiLi9iYXNlXCIpLkNPTVBJTEVSX1JFVklTSU9OO1xudmFyIFJFVklTSU9OX0NIQU5HRVMgPSByZXF1aXJlKFwiLi9iYXNlXCIpLlJFVklTSU9OX0NIQU5HRVM7XG5cbmZ1bmN0aW9uIGNoZWNrUmV2aXNpb24oY29tcGlsZXJJbmZvKSB7XG4gIHZhciBjb21waWxlclJldmlzaW9uID0gY29tcGlsZXJJbmZvICYmIGNvbXBpbGVySW5mb1swXSB8fCAxLFxuICAgICAgY3VycmVudFJldmlzaW9uID0gQ09NUElMRVJfUkVWSVNJT047XG5cbiAgaWYgKGNvbXBpbGVyUmV2aXNpb24gIT09IGN1cnJlbnRSZXZpc2lvbikge1xuICAgIGlmIChjb21waWxlclJldmlzaW9uIDwgY3VycmVudFJldmlzaW9uKSB7XG4gICAgICB2YXIgcnVudGltZVZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tjdXJyZW50UmV2aXNpb25dLFxuICAgICAgICAgIGNvbXBpbGVyVmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW2NvbXBpbGVyUmV2aXNpb25dO1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGFuIG9sZGVyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFwiK1xuICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcHJlY29tcGlsZXIgdG8gYSBuZXdlciB2ZXJzaW9uIChcIitydW50aW1lVmVyc2lvbnMrXCIpIG9yIGRvd25ncmFkZSB5b3VyIHJ1bnRpbWUgdG8gYW4gb2xkZXIgdmVyc2lvbiAoXCIrY29tcGlsZXJWZXJzaW9ucytcIikuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgdGhlIGVtYmVkZGVkIHZlcnNpb24gaW5mbyBzaW5jZSB0aGUgcnVudGltZSBkb2Vzbid0IGtub3cgYWJvdXQgdGhpcyByZXZpc2lvbiB5ZXRcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUZW1wbGF0ZSB3YXMgcHJlY29tcGlsZWQgd2l0aCBhIG5ld2VyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFwiK1xuICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcnVudGltZSB0byBhIG5ld2VyIHZlcnNpb24gKFwiK2NvbXBpbGVySW5mb1sxXStcIikuXCIpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnRzLmNoZWNrUmV2aXNpb24gPSBjaGVja1JldmlzaW9uOy8vIFRPRE86IFJlbW92ZSB0aGlzIGxpbmUgYW5kIGJyZWFrIHVwIGNvbXBpbGVQYXJ0aWFsXG5cbmZ1bmN0aW9uIHRlbXBsYXRlKHRlbXBsYXRlU3BlYywgZW52KSB7XG4gIGlmICghZW52KSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIk5vIGVudmlyb25tZW50IHBhc3NlZCB0byB0ZW1wbGF0ZVwiKTtcbiAgfVxuXG4gIC8vIE5vdGU6IFVzaW5nIGVudi5WTSByZWZlcmVuY2VzIHJhdGhlciB0aGFuIGxvY2FsIHZhciByZWZlcmVuY2VzIHRocm91Z2hvdXQgdGhpcyBzZWN0aW9uIHRvIGFsbG93XG4gIC8vIGZvciBleHRlcm5hbCB1c2VycyB0byBvdmVycmlkZSB0aGVzZSBhcyBwc3VlZG8tc3VwcG9ydGVkIEFQSXMuXG4gIHZhciBpbnZva2VQYXJ0aWFsV3JhcHBlciA9IGZ1bmN0aW9uKHBhcnRpYWwsIG5hbWUsIGNvbnRleHQsIGhlbHBlcnMsIHBhcnRpYWxzLCBkYXRhKSB7XG4gICAgdmFyIHJlc3VsdCA9IGVudi5WTS5pbnZva2VQYXJ0aWFsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgaWYgKHJlc3VsdCAhPSBudWxsKSB7IHJldHVybiByZXN1bHQ7IH1cblxuICAgIGlmIChlbnYuY29tcGlsZSkge1xuICAgICAgdmFyIG9wdGlvbnMgPSB7IGhlbHBlcnM6IGhlbHBlcnMsIHBhcnRpYWxzOiBwYXJ0aWFscywgZGF0YTogZGF0YSB9O1xuICAgICAgcGFydGlhbHNbbmFtZV0gPSBlbnYuY29tcGlsZShwYXJ0aWFsLCB7IGRhdGE6IGRhdGEgIT09IHVuZGVmaW5lZCB9LCBlbnYpO1xuICAgICAgcmV0dXJuIHBhcnRpYWxzW25hbWVdKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGhlIHBhcnRpYWwgXCIgKyBuYW1lICsgXCIgY291bGQgbm90IGJlIGNvbXBpbGVkIHdoZW4gcnVubmluZyBpbiBydW50aW1lLW9ubHkgbW9kZVwiKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gSnVzdCBhZGQgd2F0ZXJcbiAgdmFyIGNvbnRhaW5lciA9IHtcbiAgICBlc2NhcGVFeHByZXNzaW9uOiBVdGlscy5lc2NhcGVFeHByZXNzaW9uLFxuICAgIGludm9rZVBhcnRpYWw6IGludm9rZVBhcnRpYWxXcmFwcGVyLFxuICAgIHByb2dyYW1zOiBbXSxcbiAgICBwcm9ncmFtOiBmdW5jdGlvbihpLCBmbiwgZGF0YSkge1xuICAgICAgdmFyIHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXTtcbiAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgcHJvZ3JhbVdyYXBwZXIgPSBwcm9ncmFtKGksIGZuLCBkYXRhKTtcbiAgICAgIH0gZWxzZSBpZiAoIXByb2dyYW1XcmFwcGVyKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXSA9IHByb2dyYW0oaSwgZm4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHByb2dyYW1XcmFwcGVyO1xuICAgIH0sXG4gICAgbWVyZ2U6IGZ1bmN0aW9uKHBhcmFtLCBjb21tb24pIHtcbiAgICAgIHZhciByZXQgPSBwYXJhbSB8fCBjb21tb247XG5cbiAgICAgIGlmIChwYXJhbSAmJiBjb21tb24gJiYgKHBhcmFtICE9PSBjb21tb24pKSB7XG4gICAgICAgIHJldCA9IHt9O1xuICAgICAgICBVdGlscy5leHRlbmQocmV0LCBjb21tb24pO1xuICAgICAgICBVdGlscy5leHRlbmQocmV0LCBwYXJhbSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICAgcHJvZ3JhbVdpdGhEZXB0aDogZW52LlZNLnByb2dyYW1XaXRoRGVwdGgsXG4gICAgbm9vcDogZW52LlZNLm5vb3AsXG4gICAgY29tcGlsZXJJbmZvOiBudWxsXG4gIH07XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgbmFtZXNwYWNlID0gb3B0aW9ucy5wYXJ0aWFsID8gb3B0aW9ucyA6IGVudixcbiAgICAgICAgaGVscGVycyxcbiAgICAgICAgcGFydGlhbHM7XG5cbiAgICBpZiAoIW9wdGlvbnMucGFydGlhbCkge1xuICAgICAgaGVscGVycyA9IG9wdGlvbnMuaGVscGVycztcbiAgICAgIHBhcnRpYWxzID0gb3B0aW9ucy5wYXJ0aWFscztcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRlbXBsYXRlU3BlYy5jYWxsKFxuICAgICAgICAgIGNvbnRhaW5lcixcbiAgICAgICAgICBuYW1lc3BhY2UsIGNvbnRleHQsXG4gICAgICAgICAgaGVscGVycyxcbiAgICAgICAgICBwYXJ0aWFscyxcbiAgICAgICAgICBvcHRpb25zLmRhdGEpO1xuXG4gICAgaWYgKCFvcHRpb25zLnBhcnRpYWwpIHtcbiAgICAgIGVudi5WTS5jaGVja1JldmlzaW9uKGNvbnRhaW5lci5jb21waWxlckluZm8pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydHMudGVtcGxhdGUgPSB0ZW1wbGF0ZTtmdW5jdGlvbiBwcm9ncmFtV2l0aERlcHRoKGksIGZuLCBkYXRhIC8qLCAkZGVwdGggKi8pIHtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuXG4gIHZhciBwcm9nID0gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIFtjb250ZXh0LCBvcHRpb25zLmRhdGEgfHwgZGF0YV0uY29uY2F0KGFyZ3MpKTtcbiAgfTtcbiAgcHJvZy5wcm9ncmFtID0gaTtcbiAgcHJvZy5kZXB0aCA9IGFyZ3MubGVuZ3RoO1xuICByZXR1cm4gcHJvZztcbn1cblxuZXhwb3J0cy5wcm9ncmFtV2l0aERlcHRoID0gcHJvZ3JhbVdpdGhEZXB0aDtmdW5jdGlvbiBwcm9ncmFtKGksIGZuLCBkYXRhKSB7XG4gIHZhciBwcm9nID0gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgcmV0dXJuIGZuKGNvbnRleHQsIG9wdGlvbnMuZGF0YSB8fCBkYXRhKTtcbiAgfTtcbiAgcHJvZy5wcm9ncmFtID0gaTtcbiAgcHJvZy5kZXB0aCA9IDA7XG4gIHJldHVybiBwcm9nO1xufVxuXG5leHBvcnRzLnByb2dyYW0gPSBwcm9ncmFtO2Z1bmN0aW9uIGludm9rZVBhcnRpYWwocGFydGlhbCwgbmFtZSwgY29udGV4dCwgaGVscGVycywgcGFydGlhbHMsIGRhdGEpIHtcbiAgdmFyIG9wdGlvbnMgPSB7IHBhcnRpYWw6IHRydWUsIGhlbHBlcnM6IGhlbHBlcnMsIHBhcnRpYWxzOiBwYXJ0aWFscywgZGF0YTogZGF0YSB9O1xuXG4gIGlmKHBhcnRpYWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUaGUgcGFydGlhbCBcIiArIG5hbWUgKyBcIiBjb3VsZCBub3QgYmUgZm91bmRcIik7XG4gIH0gZWxzZSBpZihwYXJ0aWFsIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICByZXR1cm4gcGFydGlhbChjb250ZXh0LCBvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnRzLmludm9rZVBhcnRpYWwgPSBpbnZva2VQYXJ0aWFsO2Z1bmN0aW9uIG5vb3AoKSB7IHJldHVybiBcIlwiOyB9XG5cbmV4cG9ydHMubm9vcCA9IG5vb3A7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vLyBCdWlsZCBvdXQgb3VyIGJhc2ljIFNhZmVTdHJpbmcgdHlwZVxuZnVuY3Rpb24gU2FmZVN0cmluZyhzdHJpbmcpIHtcbiAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG59XG5cblNhZmVTdHJpbmcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIlwiICsgdGhpcy5zdHJpbmc7XG59O1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IFNhZmVTdHJpbmc7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmpzaGludCAtVzAwNCAqL1xudmFyIFNhZmVTdHJpbmcgPSByZXF1aXJlKFwiLi9zYWZlLXN0cmluZ1wiKVtcImRlZmF1bHRcIl07XG5cbnZhciBlc2NhcGUgPSB7XG4gIFwiJlwiOiBcIiZhbXA7XCIsXG4gIFwiPFwiOiBcIiZsdDtcIixcbiAgXCI+XCI6IFwiJmd0O1wiLFxuICAnXCInOiBcIiZxdW90O1wiLFxuICBcIidcIjogXCImI3gyNztcIixcbiAgXCJgXCI6IFwiJiN4NjA7XCJcbn07XG5cbnZhciBiYWRDaGFycyA9IC9bJjw+XCInYF0vZztcbnZhciBwb3NzaWJsZSA9IC9bJjw+XCInYF0vO1xuXG5mdW5jdGlvbiBlc2NhcGVDaGFyKGNocikge1xuICByZXR1cm4gZXNjYXBlW2Nocl0gfHwgXCImYW1wO1wiO1xufVxuXG5mdW5jdGlvbiBleHRlbmQob2JqLCB2YWx1ZSkge1xuICBmb3IodmFyIGtleSBpbiB2YWx1ZSkge1xuICAgIGlmKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwga2V5KSkge1xuICAgICAgb2JqW2tleV0gPSB2YWx1ZVtrZXldO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnRzLmV4dGVuZCA9IGV4dGVuZDt2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuZXhwb3J0cy50b1N0cmluZyA9IHRvU3RyaW5nO1xuLy8gU291cmNlZCBmcm9tIGxvZGFzaFxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2Jlc3RpZWpzL2xvZGFzaC9ibG9iL21hc3Rlci9MSUNFTlNFLnR4dFxudmFyIGlzRnVuY3Rpb24gPSBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xufTtcbi8vIGZhbGxiYWNrIGZvciBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaVxuaWYgKGlzRnVuY3Rpb24oL3gvKSkge1xuICBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmIHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xuICB9O1xufVxudmFyIGlzRnVuY3Rpb247XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JykgPyB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gJ1tvYmplY3QgQXJyYXldJyA6IGZhbHNlO1xufTtcbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGVzY2FwZUV4cHJlc3Npb24oc3RyaW5nKSB7XG4gIC8vIGRvbid0IGVzY2FwZSBTYWZlU3RyaW5ncywgc2luY2UgdGhleSdyZSBhbHJlYWR5IHNhZmVcbiAgaWYgKHN0cmluZyBpbnN0YW5jZW9mIFNhZmVTdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnRvU3RyaW5nKCk7XG4gIH0gZWxzZSBpZiAoIXN0cmluZyAmJiBzdHJpbmcgIT09IDApIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIC8vIEZvcmNlIGEgc3RyaW5nIGNvbnZlcnNpb24gYXMgdGhpcyB3aWxsIGJlIGRvbmUgYnkgdGhlIGFwcGVuZCByZWdhcmRsZXNzIGFuZFxuICAvLyB0aGUgcmVnZXggdGVzdCB3aWxsIGRvIHRoaXMgdHJhbnNwYXJlbnRseSBiZWhpbmQgdGhlIHNjZW5lcywgY2F1c2luZyBpc3N1ZXMgaWZcbiAgLy8gYW4gb2JqZWN0J3MgdG8gc3RyaW5nIGhhcyBlc2NhcGVkIGNoYXJhY3RlcnMgaW4gaXQuXG4gIHN0cmluZyA9IFwiXCIgKyBzdHJpbmc7XG5cbiAgaWYoIXBvc3NpYmxlLnRlc3Qoc3RyaW5nKSkgeyByZXR1cm4gc3RyaW5nOyB9XG4gIHJldHVybiBzdHJpbmcucmVwbGFjZShiYWRDaGFycywgZXNjYXBlQ2hhcik7XG59XG5cbmV4cG9ydHMuZXNjYXBlRXhwcmVzc2lvbiA9IGVzY2FwZUV4cHJlc3Npb247ZnVuY3Rpb24gaXNFbXB0eSh2YWx1ZSkge1xuICBpZiAoIXZhbHVlICYmIHZhbHVlICE9PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydHMuaXNFbXB0eSA9IGlzRW1wdHk7IiwiLy8gQ3JlYXRlIGEgc2ltcGxlIHBhdGggYWxpYXMgdG8gYWxsb3cgYnJvd3NlcmlmeSB0byByZXNvbHZlXG4vLyB0aGUgcnVudGltZSBvbiBhIHN1cHBvcnRlZCBwYXRoLlxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2Rpc3QvY2pzL2hhbmRsZWJhcnMucnVudGltZScpO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuKGZ1bmN0aW9uKHJvb3QpIHtcbiAgICB2YXIgdW5vcGluaW9uYXRlID0ge1xuICAgICAgICBzZWxlY3Rvcjogcm9vdC5qUXVlcnkgfHwgcm9vdC5aZXB0byB8fCByb290LmVuZGVyIHx8IHJvb3QuJCxcbiAgICAgICAgdGVtcGxhdGU6IHJvb3QuSGFuZGxlYmFycyB8fCByb290Lk11c3RhY2hlXG4gICAgfTtcblxuICAgIC8qKiogRXhwb3J0ICoqKi9cblxuICAgIC8vQU1EXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShbXSwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5vcGluaW9uYXRlO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgLy9Db21tb25KU1xuICAgIGVsc2UgaWYodHlwZW9mIG1vZHVsZS5leHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHVub3BpbmlvbmF0ZTtcbiAgICB9XG4gICAgLy9HbG9iYWxcbiAgICBlbHNlIHtcbiAgICAgICAgcm9vdC51bm9waW5pb25hdGUgPSB1bm9waW5pb25hdGU7XG4gICAgfVxufSkodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IGdsb2JhbCk7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwidmFyICQgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcjtcblxudmFyICRkb2N1bWVudCAgID0gJChkb2N1bWVudCksXG4gICAgYmluZGluZ3MgICAgPSB7fTtcblxudmFyIGNsaWNrID0gZnVuY3Rpb24oZXZlbnRzKSB7XG4gICAgY2xpY2suYmluZC5hcHBseShjbGljaywgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gY2xpY2s7XG59O1xuXG4vKioqIENvbmZpZ3VyYXRpb24gT3B0aW9ucyAqKiovXG5jbGljay5kaXN0YW5jZUxpbWl0ID0gMTA7XG5jbGljay50aW1lTGltaXQgICAgID0gMTQwO1xuXG4vKioqIFVzZWZ1bCBQcm9wZXJ0aWVzICoqKi9cbmNsaWNrLmlzVG91Y2ggPSAoJ29udG91Y2hzdGFydCcgaW4gd2luZG93KSB8fFxuICAgICAgICAgICAgICAgIHdpbmRvdy5Eb2N1bWVudFRvdWNoICYmXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQgaW5zdGFuY2VvZiBEb2N1bWVudFRvdWNoO1xuXG4vKioqIENhY2hlZCBGdW5jdGlvbnMgKioqL1xudmFyIG9uVG91Y2hzdGFydCA9IGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgJHRoaXMgICAgICAgPSAkKHRoaXMpLFxuICAgICAgICBzdGFydFRpbWUgICA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLFxuICAgICAgICBzdGFydFBvcyAgICA9IGNsaWNrLl9nZXRQb3MoZSk7XG5cbiAgICAkdGhpcy5vbmUoJ3RvdWNoZW5kJywgZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vUHJldmVudHMgY2xpY2sgZXZlbnQgZnJvbSBmaXJpbmdcbiAgICAgICAgXG4gICAgICAgIHZhciB0aW1lICAgICAgICA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lLFxuICAgICAgICAgICAgZW5kUG9zICAgICAgPSBjbGljay5fZ2V0UG9zKGUpLFxuICAgICAgICAgICAgZGlzdGFuY2UgICAgPSBNYXRoLnNxcnQoXG4gICAgICAgICAgICAgICAgTWF0aC5wb3coZW5kUG9zLnggLSBzdGFydFBvcy54LCAyKSArXG4gICAgICAgICAgICAgICAgTWF0aC5wb3coZW5kUG9zLnkgLSBzdGFydFBvcy55LCAyKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICBpZih0aW1lIDwgY2xpY2sudGltZUxpbWl0ICYmIGRpc3RhbmNlIDwgY2xpY2suZGlzdGFuY2VMaW1pdCkge1xuICAgICAgICAgICAgLy9GaW5kIHRoZSBjb3JyZWN0IGNhbGxiYWNrXG4gICAgICAgICAgICAkLmVhY2goYmluZGluZ3MsIGZ1bmN0aW9uKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGlmKCR0aGlzLmlzKHNlbGVjdG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShlLnRhcmdldCwgW2VdKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKioqIEFQSSAqKiovXG5jbGljay5iaW5kID0gZnVuY3Rpb24oZXZlbnRzKSB7XG5cbiAgICAvL0FyZ3VtZW50IFN1cmdlcnlcbiAgICBpZighJC5pc1BsYWluT2JqZWN0KGV2ZW50cykpIHtcbiAgICAgICAgbmV3RXZlbnRzID0ge307XG4gICAgICAgIG5ld0V2ZW50c1thcmd1bWVudHNbMF1dID0gYXJndW1lbnRzWzFdO1xuICAgICAgICBldmVudHMgPSBuZXdFdmVudHM7XG4gICAgfVxuXG4gICAgJC5lYWNoKGV2ZW50cywgZnVuY3Rpb24oc2VsZWN0b3IsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgLyoqKiBSZWdpc3RlciBCaW5kaW5nICoqKi9cbiAgICAgICAgaWYodHlwZW9mIGJpbmRpbmdzW3NlbGVjdG9yXSAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY2xpY2sudW5iaW5kKHNlbGVjdG9yKTsgLy9FbnN1cmUgbm8gZHVwbGljYXRlc1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBiaW5kaW5nc1tzZWxlY3Rvcl0gPSBjYWxsYmFjaztcblxuICAgICAgICAvKioqIFRvdWNoIFN1cHBvcnQgKioqL1xuICAgICAgICBpZihjbGljay5pc1RvdWNoKSB7XG4gICAgICAgICAgICAkZG9jdW1lbnQuZGVsZWdhdGUoc2VsZWN0b3IsICd0b3VjaHN0YXJ0Jywgb25Ub3VjaHN0YXJ0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKiogTW91c2UgU3VwcG9ydCAqKiovXG4gICAgICAgICRkb2N1bWVudC5kZWxlZ2F0ZShzZWxlY3RvciwgJ21vdXNlZG93bicsIGNhbGxiYWNrKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuY2xpY2sudW5iaW5kID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICAkZG9jdW1lbnRcbiAgICAgICAgLnVuZGVsZWdhdGUoc2VsZWN0b3IsICd0b3VjaHN0YXJ0JylcbiAgICAgICAgLnVuZGVsZWdhdGUoc2VsZWN0b3IsICdjbGljaycpO1xuXG4gICAgZGVsZXRlIGJpbmRpbmdzW3NlbGVjdG9yXTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuY2xpY2sudW5iaW5kQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgJC5lYWNoKGJpbmRpbmdzLCBmdW5jdGlvbihzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAgICAgJGRvY3VtZW50XG4gICAgICAgICAgICAudW5kZWxlZ2F0ZShzZWxlY3RvciwgJ3RvdWNoc3RhcnQnKVxuICAgICAgICAgICAgLnVuZGVsZWdhdGUoc2VsZWN0b3IsICdjbGljaycpO1xuICAgIH0pO1xuICAgIFxuICAgIGJpbmRpbmdzID0ge307XG5cbiAgICByZXR1cm4gdGhpcztcbn07XG5cbmNsaWNrLnRyaWdnZXIgPSBmdW5jdGlvbihzZWxlY3RvciwgZSkge1xuICAgIGUgPSBlIHx8ICQuRXZlbnQoJ2NsaWNrJyk7XG5cbiAgICBpZih0eXBlb2YgYmluZGluZ3Nbc2VsZWN0b3JdICE9ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGJpbmRpbmdzW3NlbGVjdG9yXShlKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJObyBjbGljayBldmVudHMgYm91bmQgZm9yIHNlbGVjdG9yICdcIitzZWxlY3RvcitcIicuXCIpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLyoqKiBJbnRlcm5hbCAoYnV0IHVzZWZ1bCkgTWV0aG9kcyAqKiovXG5jbGljay5fZ2V0UG9zID0gZnVuY3Rpb24oZSkge1xuICAgIGUgPSBlLm9yaWdpbmFsRXZlbnQ7XG5cbiAgICBpZihlLnBhZ2VYIHx8IGUucGFnZVkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IGUucGFnZVgsXG4gICAgICAgICAgICB5OiBlLnBhZ2VZXG4gICAgICAgIH07XG4gICAgfVxuICAgIGVsc2UgaWYoZS5jaGFuZ2VkVG91Y2hlcykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRYLFxuICAgICAgICAgICAgeTogZS5jaGFuZ2VkVG91Y2hlc1swXS5jbGllbnRZXG4gICAgICAgIH07XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogZS5jbGllbnRYICsgZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0ICsgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQsXG4gICAgICAgICAgICB5OiBlLmNsaWVudFkgKyBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcCAgKyBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wXG4gICAgICAgIH07XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBjbGljaztcblxuIiwidmFyICQgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcixcbiAgICAkZG9jdW1lbnQgPSAkKGRvY3VtZW50KTtcblxudmFyIERyYWcgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG4gICAgXG59O1xuXG5EcmFnLnByb3RvdHlwZSA9IHtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEcmFnO1xuIiwidmFyICQgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcjtcblxudmFyIERyb3AgPSBmdW5jdGlvbihzZWxlY3RvciwgY29uZmlnKSB7XG5cbn07XG5cbkRyb3AucHJvdG90eXBlID0ge1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERyb3A7IiwidmFyIERyYWcgPSByZXF1aXJlKFwiLi9EcmFnXCIpLFxuICAgIERyb3AgPSByZXF1aXJlKFwiLi9Ecm9wXCIpO1xuXG52YXIgZHJvcEluZGV4ID0ge307XG5cbnZhciBkcmFnID0gZnVuY3Rpb24oc2VsZWN0b3IsIGNvbmZpZykge1xuICAgIHJldHVybiBuZXcgRHJhZyhzZWxlY3RvciwgY29uZmlnKTtcbn07XG5cbmRyYWcuZHJvcCA9IGZ1bmN0aW9uKHNlbGVjdG9yLCBjb25maWcpIHtcbiAgICB2YXIgZHJvcCA9IG5ldyBEcm9wKHNlbGVjdG9yLCBjb25maWcpO1xuXG4gICAgLy9kcm9wIGluZGV4aW5nXG4gICAgdmFyIGFkZFRvSW5kZXggPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIGlmKHR5cGVvZiBkcm9wSW5kZXhbbmFtZV0gPT0gJ3VuZGVmaW5lZCcpIGRyb3BJbmRleFtuYW1lXSA9IFtkcm9wXTtcbiAgICAgICAgZWxzZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZHJvcEluZGV4W25hbWVdLnB1c2goZHJvcCk7XG4gICAgfTtcblxuICAgIGlmKCFjb25maWcudGFnKSB7XG4gICAgICAgIGFkZFRvSW5kZXgoJycpO1xuICAgIH1cbiAgICBlbHNlIGlmKHR5cGVvZiBjb25maWcudGFnID09ICdTdHJpbmcnKSB7XG4gICAgICAgIGFkZFRvSW5kZXgoY29uZmlnLnRhZyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB2YXIgaSA9IGNvbmZpZy50YWcubGVuZ3RoO1xuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIGFkZFRvSW5kZXgoY29uZmlnLnRhZ1tpXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZHJvcDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZHJhZztcbiIsInZhciAkID0gcmVxdWlyZSgndW5vcGluaW9uYXRlJykuc2VsZWN0b3IsXG4gICAgICAgIHNwZWNpYWxLZXlzID0gcmVxdWlyZSgnLi9zcGVjaWFsS2V5cycpO1xuXG52YXIgJHdpbmRvdyA9ICQod2luZG93KTtcblxudmFyIEV2ZW50ID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICB0aGlzLnNlbGVjdG9yICAgPSBzZWxlY3RvcjtcbiAgICB0aGlzLiRzY29wZSAgICAgPSBzZWxlY3RvciA/ICQoc2VsZWN0b3IpIDogJHdpbmRvdztcbiAgICB0aGlzLmNhbGxiYWNrcyAgPSBbXTtcbiAgICB0aGlzLmFjdGl2ZSAgICAgPSB0cnVlO1xufTtcblxuRXZlbnQucHJvdG90eXBlID0ge1xuICAgIHVwOiBmdW5jdGlvbihldmVudHMpIHtcbiAgICAgICAgdGhpcy5iaW5kKCd1cCcsIGV2ZW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgZG93bjogZnVuY3Rpb24oZXZlbnRzKSB7XG4gICAgICAgIHRoaXMuYmluZCgnZG93bicsIGV2ZW50cyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgYmluZDogZnVuY3Rpb24odHlwZSwgZXZlbnRzKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBpZigkLmlzUGxhaW5PYmplY3QoZXZlbnRzKSkge1xuICAgICAgICAgICAgJC5lYWNoKGV2ZW50cywgZnVuY3Rpb24oa2V5LCBjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHNlbGYuX2FkZCh0eXBlLCBrZXksIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fYWRkKHR5cGUsIGZhbHNlLCBldmVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBvZmY6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRzY29wZVxuICAgICAgICAgICAgLnVuYmluZCgna2V5ZG93bicpXG4gICAgICAgICAgICAudW5iaW5kKCdrZXl1cCcpO1xuICAgIH0sXG5cbiAgICAvKioqIEludGVybmFsIEZ1bmN0aW9ucyAqKiovXG4gICAgX2FkZDogZnVuY3Rpb24odHlwZSwgY29uZGl0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmKCF0aGlzLmNhbGxiYWNrc1t0eXBlXSkge1xuICAgICAgICAgICAgdGhpcy5jYWxsYmFja3NbdHlwZV0gPSBbXTtcblxuICAgICAgICAgICAgdGhpcy4kc2NvcGUuYmluZCgna2V5JyArIHR5cGUsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBpZihzZWxmLmFjdGl2ZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2tzID0gc2VsZi5jYWxsYmFja3NbdHlwZV07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yKHZhciBpPTA7IGk8Y2FsbGJhY2tzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBjYWxsYmFja3NbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZighY2FsbGJhY2suY29uZGl0aW9ucyB8fCBzZWxmLl92YWxpZGF0ZShjYWxsYmFjay5jb25kaXRpb25zLCBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihjb25kaXRpb25zKSB7XG4gICAgICAgICAgICBjYWxsYmFjay5jb25kaXRpb25zID0gdGhpcy5fcGFyc2VDb25kaXRpb25zKGNvbmRpdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jYWxsYmFja3NbdHlwZV0ucHVzaChjYWxsYmFjayk7XG4gICAgfSxcbiAgICBfcGFyc2VDb25kaXRpb25zOiBmdW5jdGlvbihjKSB7XG4gICAgICAgIHZhciBjb25kaXRpb25zID0ge1xuICAgICAgICAgICAgc2hpZnQ6ICAgL1xcYnNoaWZ0XFxiL2kudGVzdChjKSxcbiAgICAgICAgICAgIGFsdDogICAgIC9cXGIoYWx0fGFsdGVybmF0ZSlcXGIvaS50ZXN0KGMpLFxuICAgICAgICAgICAgY3RybDogICAgL1xcYihjdHJsfGNvbnRyb2x8Y21kfGNvbW1hbmQpXFxiL2kudGVzdChjKVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vS2V5IEJpbmRpbmdcbiAgICAgICAgdmFyIGtleXMgPSBjLm1hdGNoKC9cXGIoPyFzaGlmdHxhbHR8YWx0ZXJuYXRlfGN0cmx8Y29udHJvbHxjbWR8Y29tbWFuZCkoXFx3KylcXGIvZ2kpO1xuXG4gICAgICAgIGlmKCFrZXlzKSB7XG4gICAgICAgICAgICAvL1VzZSBtb2RpZmllciBhcyBrZXkgaWYgdGhlcmUgaXMgbm8gb3RoZXIga2V5XG4gICAgICAgICAgICBrZXlzID0gYy5tYXRjaCgvXFxiKFxcdyspXFxiL2dpKTtcblxuICAgICAgICAgICAgLy9Nb2RpZmllcnMgc2hvdWxkIGFsbCBiZSBmYWxzZVxuICAgICAgICAgICAgY29uZGl0aW9ucy5zaGlmdCA9XG4gICAgICAgICAgICBjb25kaXRpb25zLmFsdCAgID1cbiAgICAgICAgICAgIGNvbmRpdGlvbnMuY3RybCAgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGtleXMpIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbnMua2V5ID0ga2V5c1swXTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYoa2V5cy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiTW9yZSB0aGFuIG9uZSBrZXkgYm91bmQgaW4gJ1wiK2MrXCInLiBVc2luZyB0aGUgZmlyc3Qgb25lIChcIitrZXlzWzBdK1wiKS5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25kaXRpb25zLmtleSAgICAgID0gbnVsbDtcbiAgICAgICAgICAgIGNvbmRpdGlvbnMua2V5Q29kZSAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbmRpdGlvbnM7XG4gICAgfSxcbiAgICBfa2V5Q29kZVRlc3Q6IGZ1bmN0aW9uKGtleSwga2V5Q29kZSkge1xuICAgICAgICBpZih0eXBlb2Ygc3BlY2lhbEtleXNba2V5Q29kZV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB2YXIga2V5RGVmID0gc3BlY2lhbEtleXNba2V5Q29kZV07XG5cbiAgICAgICAgICAgIGlmKGtleURlZiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBrZXlEZWYudGVzdChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGtleURlZiA9PT0ga2V5LnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihrZXkubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICByZXR1cm4ga2V5LnRvVXBwZXJDYXNlKCkuY2hhckNvZGVBdCgwKSA9PT0ga2V5Q29kZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgX3ZhbGlkYXRlOiBmdW5jdGlvbihjLCBlKSB7XG4gICAgICAgIHJldHVybiAgKGMua2V5ID8gdGhpcy5fa2V5Q29kZVRlc3QoYy5rZXksIGUud2hpY2gpIDogdHJ1ZSkgJiZcbiAgICAgICAgICAgICAgICBjLnNoaWZ0ID09PSBlLnNoaWZ0S2V5ICYmXG4gICAgICAgICAgICAgICAgYy5hbHQgICA9PT0gZS5hbHRLZXkgJiZcbiAgICAgICAgICAgICAgICAoIWMuY3RybCB8fCAoYy5jdHJsID09PSBlLm1ldGFLZXkpICE9PSAoYy5jdHJsID09PSBlLmN0cmxLZXkpKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50O1xuXG4iLCJ2YXIgRXZlbnQgPSByZXF1aXJlKCcuL0V2ZW50LmpzJyksXG4gICAgZXZlbnRzID0gW107XG5cbnZhciBrZXkgPSBmdW5jdGlvbihzZWxlY3RvcikgeyAvL0ZhY3RvcnkgZm9yIEV2ZW50IG9iamVjdHNcbiAgICByZXR1cm4ga2V5Ll9jcmVhdGVFdmVudChzZWxlY3Rvcik7XG59O1xuXG5rZXkuZG93biA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLl9jcmVhdGVFdmVudCgpLmRvd24oY29uZmlnKTtcbn07XG5cbmtleS51cCA9IGZ1bmN0aW9uKGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLl9jcmVhdGVFdmVudCgpLnVwKGNvbmZpZyk7XG59O1xuXG5rZXkudW5iaW5kQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgd2hpbGUoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgICBldmVudHMucG9wKCkuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuLy9DcmVhdGVzIG5ldyBFdmVudCBvYmplY3RzIChjaGVja2luZyBmb3IgZXhpc3RpbmcgZmlyc3QpXG5rZXkuX2NyZWF0ZUV2ZW50ID0gZnVuY3Rpb24oc2VsZWN0b3IpIHtcbiAgICB2YXIgZSA9IG5ldyBFdmVudChzZWxlY3Rvcik7XG4gICAgZXZlbnRzLnB1c2goZSk7XG4gICAgcmV0dXJuIGU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGtleTtcbiIsIi8vQWRvcHRlZCBmcm9tIFtqUXVlcnkgaG90a2V5c10oaHR0cHM6Ly9naXRodWIuY29tL2plcmVzaWcvanF1ZXJ5LmhvdGtleXMvYmxvYi9tYXN0ZXIvanF1ZXJ5LmhvdGtleXMuanMpXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIDg6IFwiYmFja3NwYWNlXCIsXG4gICAgOTogXCJ0YWJcIixcbiAgICAxMDogL14ocmV0dXJufGVudGVyKSQvaSxcbiAgICAxMzogL14ocmV0dXJufGVudGVyKSQvaSxcbiAgICAxNjogXCJzaGlmdFwiLFxuICAgIDE3OiAvXihjdHJsfGNvbnRyb2wpJC9pLFxuICAgIDE4OiAvXihhbHR8YWx0ZXJuYXRlKSQvaSxcbiAgICAxOTogXCJwYXVzZVwiLFxuICAgIDIwOiBcImNhcHNsb2NrXCIsXG4gICAgMjc6IC9eKGVzY3xlc2NhcGUpJC9pLFxuICAgIDMyOiBcInNwYWNlXCIsXG4gICAgMzM6IFwicGFnZXVwXCIsXG4gICAgMzQ6IFwicGFnZWRvd25cIixcbiAgICAzNTogXCJlbmRcIixcbiAgICAzNjogXCJob21lXCIsXG4gICAgMzc6IFwibGVmdFwiLFxuICAgIDM4OiBcInVwXCIsXG4gICAgMzk6IFwicmlnaHRcIixcbiAgICA0MDogXCJkb3duXCIsXG4gICAgNDU6IFwiaW5zZXJ0XCIsXG4gICAgNDY6IC9eKGRlbHxkZWxldGUpJC9pLFxuICAgIDkxOiAvXihjbWR8Y29tbWFuZCkkL2ksXG4gICAgOTY6IFwiMFwiLFxuICAgIDk3OiBcIjFcIixcbiAgICA5ODogXCIyXCIsXG4gICAgOTk6IFwiM1wiLFxuICAgIDEwMDogXCI0XCIsXG4gICAgMTAxOiBcIjVcIixcbiAgICAxMDI6IFwiNlwiLFxuICAgIDEwMzogXCI3XCIsXG4gICAgMTA0OiBcIjhcIixcbiAgICAxMDU6IFwiOVwiLFxuICAgIDEwNjogXCIqXCIsXG4gICAgMTA3OiBcIitcIixcbiAgICAxMDk6IFwiLVwiLFxuICAgIDExMDogXCIuXCIsXG4gICAgMTExIDogXCIvXCIsXG4gICAgMTEyOiBcImYxXCIsXG4gICAgMTEzOiBcImYyXCIsXG4gICAgMTE0OiBcImYzXCIsXG4gICAgMTE1OiBcImY0XCIsXG4gICAgMTE2OiBcImY1XCIsXG4gICAgMTE3OiBcImY2XCIsXG4gICAgMTE4OiBcImY3XCIsXG4gICAgMTE5OiBcImY4XCIsXG4gICAgMTIwOiBcImY5XCIsXG4gICAgMTIxOiBcImYxMFwiLFxuICAgIDEyMjogXCJmMTFcIixcbiAgICAxMjM6IFwiZjEyXCIsXG4gICAgMTQ0OiBcIm51bWxvY2tcIixcbiAgICAxNDU6IFwic2Nyb2xsXCIsXG4gICAgMTg2OiBcIjtcIixcbiAgICAxODc6IFwiPVwiLFxuICAgIDE4OTogXCItXCIsXG4gICAgMTkwOiBcIi5cIixcbiAgICAxOTE6IFwiL1wiLFxuICAgIDE5MjogXCJgXCIsXG4gICAgMjE5OiBcIltcIixcbiAgICAyMjA6IFwiXFxcXFwiLFxuICAgIDIyMTogXCJdXCIsXG4gICAgMjIyOiBcIidcIixcbiAgICAyMjQ6IFwibWV0YVwiXG59O1xuIiwiXG52YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJykuc3R5bGVcbnZhciBwcmVmaXhlcyA9ICdPIG1zIE1veiB3ZWJraXQnLnNwbGl0KCcgJylcbnZhciB1cHBlciA9IC8oW0EtWl0pL2dcblxudmFyIG1lbW8gPSB7fVxuXG4vKipcbiAqIG1lbW9pemVkIGBwcmVmaXhgXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBmdW5jdGlvbihrZXkpe1xuICByZXR1cm4ga2V5IGluIG1lbW9cbiAgICA/IG1lbW9ba2V5XVxuICAgIDogbWVtb1trZXldID0gcHJlZml4KGtleSlcbn1cblxuZXhwb3J0cy5wcmVmaXggPSBwcmVmaXhcbmV4cG9ydHMuZGFzaCA9IGRhc2hlZFByZWZpeFxuXG4vKipcbiAqIHByZWZpeCBga2V5YFxuICpcbiAqICAgcHJlZml4KCd0cmFuc2Zvcm0nKSAvLyA9PiB3ZWJraXRUcmFuc2Zvcm1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIHByZWZpeChrZXkpe1xuICAvLyBjYW1lbCBjYXNlXG4gIGtleSA9IGtleS5yZXBsYWNlKC8tKFthLXpdKS9nLCBmdW5jdGlvbihfLCBjaGFyKXtcbiAgICByZXR1cm4gY2hhci50b1VwcGVyQ2FzZSgpXG4gIH0pXG5cbiAgLy8gd2l0aG91dCBwcmVmaXhcbiAgaWYgKHN0eWxlW2tleV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIGtleVxuXG4gIC8vIHdpdGggcHJlZml4XG4gIHZhciBLZXkgPSBjYXBpdGFsaXplKGtleSlcbiAgdmFyIGkgPSBwcmVmaXhlcy5sZW5ndGhcbiAgd2hpbGUgKGktLSkge1xuICAgIHZhciBuYW1lID0gcHJlZml4ZXNbaV0gKyBLZXlcbiAgICBpZiAoc3R5bGVbbmFtZV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIG5hbWVcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcigndW5hYmxlIHRvIHByZWZpeCAnICsga2V5KVxufVxuXG5mdW5jdGlvbiBjYXBpdGFsaXplKHN0cil7XG4gIHJldHVybiBzdHIuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSlcbn1cblxuLyoqXG4gKiBjcmVhdGUgYSBkYXNoZXJpemVkIHByZWZpeFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZGFzaGVkUHJlZml4KGtleSl7XG4gIGtleSA9IHByZWZpeChrZXkpXG4gIGlmICh1cHBlci50ZXN0KGtleSkpIGtleSA9ICctJyArIGtleS5yZXBsYWNlKHVwcGVyLCAnLSQxJylcbiAgcmV0dXJuIGtleS50b0xvd2VyQ2FzZSgpXG59XG4iLCIvKlxyXG4gKiBsb2dsZXZlbCAtIGh0dHBzOi8vZ2l0aHViLmNvbS9waW10ZXJyeS9sb2dsZXZlbFxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgVGltIFBlcnJ5XHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cclxuICovXHJcblxyXG47KGZ1bmN0aW9uICh1bmRlZmluZWQpIHtcclxuICAgIHZhciB1bmRlZmluZWRUeXBlID0gXCJ1bmRlZmluZWRcIjtcclxuXHJcbiAgICAoZnVuY3Rpb24gKG5hbWUsIGRlZmluaXRpb24pIHtcclxuICAgICAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBkZWZpbmUoZGVmaW5pdGlvbik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IGRlZmluaXRpb24oKTtcclxuICAgICAgICB9XHJcbiAgICB9KCdsb2cnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB7fTtcclxuICAgICAgICB2YXIgbm9vcCA9IGZ1bmN0aW9uKCkge307XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHJlYWxNZXRob2QobWV0aG9kTmFtZSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgPT09IHVuZGVmaW5lZFR5cGUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvbnNvbGVbbWV0aG9kTmFtZV0gPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbnNvbGUubG9nICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYm91bmRUb0NvbnNvbGUoY29uc29sZSwgJ2xvZycpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9vcDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBib3VuZFRvQ29uc29sZShjb25zb2xlLCBtZXRob2ROYW1lKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gYm91bmRUb0NvbnNvbGUoY29uc29sZSwgbWV0aG9kTmFtZSkge1xyXG4gICAgICAgICAgICB2YXIgbWV0aG9kID0gY29uc29sZVttZXRob2ROYW1lXTtcclxuICAgICAgICAgICAgaWYgKG1ldGhvZC5iaW5kID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChGdW5jdGlvbi5wcm90b3R5cGUuYmluZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uQmluZGluZ1dyYXBwZXIobWV0aG9kLCBjb25zb2xlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kLmNhbGwoY29uc29sZVttZXRob2ROYW1lXSwgY29uc29sZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBJbiBJRTggKyBNb2Rlcm5penIsIHRoZSBiaW5kIHNoaW0gd2lsbCByZWplY3QgdGhlIGFib3ZlLCBzbyB3ZSBmYWxsIGJhY2sgdG8gd3JhcHBpbmdcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uQmluZGluZ1dyYXBwZXIobWV0aG9kLCBjb25zb2xlKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZVttZXRob2ROYW1lXS5iaW5kKGNvbnNvbGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmdW5jdGlvbiBmdW5jdGlvbkJpbmRpbmdXcmFwcGVyKGYsIGNvbnRleHQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICAgICAgRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LmFwcGx5KGYsIFtjb250ZXh0LCBhcmd1bWVudHNdKTtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBsb2dNZXRob2RzID0gW1xyXG4gICAgICAgICAgICBcInRyYWNlXCIsXHJcbiAgICAgICAgICAgIFwiZGVidWdcIixcclxuICAgICAgICAgICAgXCJpbmZvXCIsXHJcbiAgICAgICAgICAgIFwid2FyblwiLFxyXG4gICAgICAgICAgICBcImVycm9yXCJcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiByZXBsYWNlTG9nZ2luZ01ldGhvZHMobWV0aG9kRmFjdG9yeSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgbG9nTWV0aG9kcy5sZW5ndGg7IGlpKyspIHtcclxuICAgICAgICAgICAgICAgIHNlbGZbbG9nTWV0aG9kc1tpaV1dID0gbWV0aG9kRmFjdG9yeShsb2dNZXRob2RzW2lpXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGNvb2tpZXNBdmFpbGFibGUoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5kb2N1bWVudCAhPT0gdW5kZWZpbmVkICYmXHJcbiAgICAgICAgICAgICAgICAgICAgd2luZG93LmRvY3VtZW50LmNvb2tpZSAhPT0gdW5kZWZpbmVkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIGxvY2FsU3RvcmFnZUF2YWlsYWJsZSgpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAodHlwZW9mIHdpbmRvdyAhPT0gdW5kZWZpbmVkVHlwZSAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cubG9jYWxTdG9yYWdlICE9PSB1bmRlZmluZWQpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZ1bmN0aW9uIHBlcnNpc3RMZXZlbElmUG9zc2libGUobGV2ZWxOdW0pIHtcclxuICAgICAgICAgICAgdmFyIGxldmVsTmFtZTtcclxuXHJcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBzZWxmLmxldmVscykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHNlbGYubGV2ZWxzLmhhc093blByb3BlcnR5KGtleSkgJiYgc2VsZi5sZXZlbHNba2V5XSA9PT0gbGV2ZWxOdW0pIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXZlbE5hbWUgPSBrZXk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChsb2NhbFN0b3JhZ2VBdmFpbGFibGUoKSkge1xyXG4gICAgICAgICAgICAgICAgd2luZG93LmxvY2FsU3RvcmFnZVsnbG9nbGV2ZWwnXSA9IGxldmVsTmFtZTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChjb29raWVzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICAgICAgICAgIHdpbmRvdy5kb2N1bWVudC5jb29raWUgPSBcImxvZ2xldmVsPVwiICsgbGV2ZWxOYW1lICsgXCI7XCI7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBjb29raWVSZWdleCA9IC9sb2dsZXZlbD0oW147XSspLztcclxuXHJcbiAgICAgICAgZnVuY3Rpb24gbG9hZFBlcnNpc3RlZExldmVsKCkge1xyXG4gICAgICAgICAgICB2YXIgc3RvcmVkTGV2ZWw7XHJcblxyXG4gICAgICAgICAgICBpZiAobG9jYWxTdG9yYWdlQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICAgICAgICAgIHN0b3JlZExldmVsID0gd2luZG93LmxvY2FsU3RvcmFnZVsnbG9nbGV2ZWwnXTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFzdG9yZWRMZXZlbCAmJiBjb29raWVzQXZhaWxhYmxlKCkpIHtcclxuICAgICAgICAgICAgICAgIHZhciBjb29raWVNYXRjaCA9IGNvb2tpZVJlZ2V4LmV4ZWMod2luZG93LmRvY3VtZW50LmNvb2tpZSkgfHwgW107XHJcbiAgICAgICAgICAgICAgICBzdG9yZWRMZXZlbCA9IGNvb2tpZU1hdGNoWzFdO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBzZWxmLnNldExldmVsKHNlbGYubGV2ZWxzW3N0b3JlZExldmVsXSB8fCBzZWxmLmxldmVscy5XQVJOKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBQdWJsaWMgQVBJXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKi9cclxuXHJcbiAgICAgICAgc2VsZi5sZXZlbHMgPSB7IFwiVFJBQ0VcIjogMCwgXCJERUJVR1wiOiAxLCBcIklORk9cIjogMiwgXCJXQVJOXCI6IDMsXHJcbiAgICAgICAgICAgIFwiRVJST1JcIjogNCwgXCJTSUxFTlRcIjogNX07XHJcblxyXG4gICAgICAgIHNlbGYuc2V0TGV2ZWwgPSBmdW5jdGlvbiAobGV2ZWwpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBsZXZlbCA9PT0gXCJudW1iZXJcIiAmJiBsZXZlbCA+PSAwICYmIGxldmVsIDw9IHNlbGYubGV2ZWxzLlNJTEVOVCkge1xyXG4gICAgICAgICAgICAgICAgcGVyc2lzdExldmVsSWZQb3NzaWJsZShsZXZlbCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGxldmVsID09PSBzZWxmLmxldmVscy5TSUxFTlQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXBsYWNlTG9nZ2luZ01ldGhvZHMoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbm9vcDtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25zb2xlID09PSB1bmRlZmluZWRUeXBlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVwbGFjZUxvZ2dpbmdNZXRob2RzKGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbnNvbGUgIT09IHVuZGVmaW5lZFR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNldExldmVsKGxldmVsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmW21ldGhvZE5hbWVdLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiTm8gY29uc29sZSBhdmFpbGFibGUgZm9yIGxvZ2dpbmdcIjtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVwbGFjZUxvZ2dpbmdNZXRob2RzKGZ1bmN0aW9uIChtZXRob2ROYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsZXZlbCA8PSBzZWxmLmxldmVsc1ttZXRob2ROYW1lLnRvVXBwZXJDYXNlKCldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVhbE1ldGhvZChtZXRob2ROYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBub29wO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGxldmVsID09PSBcInN0cmluZ1wiICYmIHNlbGYubGV2ZWxzW2xldmVsLnRvVXBwZXJDYXNlKCldICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHNbbGV2ZWwudG9VcHBlckNhc2UoKV0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgXCJsb2cuc2V0TGV2ZWwoKSBjYWxsZWQgd2l0aCBpbnZhbGlkIGxldmVsOiBcIiArIGxldmVsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgc2VsZi5lbmFibGVBbGwgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgc2VsZi5zZXRMZXZlbChzZWxmLmxldmVscy5UUkFDRSk7XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgc2VsZi5kaXNhYmxlQWxsID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHNlbGYuc2V0TGV2ZWwoc2VsZi5sZXZlbHMuU0lMRU5UKTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBsb2FkUGVyc2lzdGVkTGV2ZWwoKTtcclxuICAgICAgICByZXR1cm4gc2VsZjtcclxuICAgIH0pKTtcclxufSkoKTtcclxuIiwiLy8gICAgIFVuZGVyc2NvcmUuanMgMS41LjJcbi8vICAgICBodHRwOi8vdW5kZXJzY29yZWpzLm9yZ1xuLy8gICAgIChjKSAyMDA5LTIwMTMgSmVyZW15IEFzaGtlbmFzLCBEb2N1bWVudENsb3VkIGFuZCBJbnZlc3RpZ2F0aXZlIFJlcG9ydGVycyAmIEVkaXRvcnNcbi8vICAgICBVbmRlcnNjb3JlIG1heSBiZSBmcmVlbHkgZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuXG4oZnVuY3Rpb24oKSB7XG5cbiAgLy8gQmFzZWxpbmUgc2V0dXBcbiAgLy8gLS0tLS0tLS0tLS0tLS1cblxuICAvLyBFc3RhYmxpc2ggdGhlIHJvb3Qgb2JqZWN0LCBgd2luZG93YCBpbiB0aGUgYnJvd3Nlciwgb3IgYGV4cG9ydHNgIG9uIHRoZSBzZXJ2ZXIuXG4gIHZhciByb290ID0gdGhpcztcblxuICAvLyBTYXZlIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgYF9gIHZhcmlhYmxlLlxuICB2YXIgcHJldmlvdXNVbmRlcnNjb3JlID0gcm9vdC5fO1xuXG4gIC8vIEVzdGFibGlzaCB0aGUgb2JqZWN0IHRoYXQgZ2V0cyByZXR1cm5lZCB0byBicmVhayBvdXQgb2YgYSBsb29wIGl0ZXJhdGlvbi5cbiAgdmFyIGJyZWFrZXIgPSB7fTtcblxuICAvLyBTYXZlIGJ5dGVzIGluIHRoZSBtaW5pZmllZCAoYnV0IG5vdCBnemlwcGVkKSB2ZXJzaW9uOlxuICB2YXIgQXJyYXlQcm90byA9IEFycmF5LnByb3RvdHlwZSwgT2JqUHJvdG8gPSBPYmplY3QucHJvdG90eXBlLCBGdW5jUHJvdG8gPSBGdW5jdGlvbi5wcm90b3R5cGU7XG5cbiAgLy8gQ3JlYXRlIHF1aWNrIHJlZmVyZW5jZSB2YXJpYWJsZXMgZm9yIHNwZWVkIGFjY2VzcyB0byBjb3JlIHByb3RvdHlwZXMuXG4gIHZhclxuICAgIHB1c2ggICAgICAgICAgICAgPSBBcnJheVByb3RvLnB1c2gsXG4gICAgc2xpY2UgICAgICAgICAgICA9IEFycmF5UHJvdG8uc2xpY2UsXG4gICAgY29uY2F0ICAgICAgICAgICA9IEFycmF5UHJvdG8uY29uY2F0LFxuICAgIHRvU3RyaW5nICAgICAgICAgPSBPYmpQcm90by50b1N0cmluZyxcbiAgICBoYXNPd25Qcm9wZXJ0eSAgID0gT2JqUHJvdG8uaGFzT3duUHJvcGVydHk7XG5cbiAgLy8gQWxsICoqRUNNQVNjcmlwdCA1KiogbmF0aXZlIGZ1bmN0aW9uIGltcGxlbWVudGF0aW9ucyB0aGF0IHdlIGhvcGUgdG8gdXNlXG4gIC8vIGFyZSBkZWNsYXJlZCBoZXJlLlxuICB2YXJcbiAgICBuYXRpdmVGb3JFYWNoICAgICAgPSBBcnJheVByb3RvLmZvckVhY2gsXG4gICAgbmF0aXZlTWFwICAgICAgICAgID0gQXJyYXlQcm90by5tYXAsXG4gICAgbmF0aXZlUmVkdWNlICAgICAgID0gQXJyYXlQcm90by5yZWR1Y2UsXG4gICAgbmF0aXZlUmVkdWNlUmlnaHQgID0gQXJyYXlQcm90by5yZWR1Y2VSaWdodCxcbiAgICBuYXRpdmVGaWx0ZXIgICAgICAgPSBBcnJheVByb3RvLmZpbHRlcixcbiAgICBuYXRpdmVFdmVyeSAgICAgICAgPSBBcnJheVByb3RvLmV2ZXJ5LFxuICAgIG5hdGl2ZVNvbWUgICAgICAgICA9IEFycmF5UHJvdG8uc29tZSxcbiAgICBuYXRpdmVJbmRleE9mICAgICAgPSBBcnJheVByb3RvLmluZGV4T2YsXG4gICAgbmF0aXZlTGFzdEluZGV4T2YgID0gQXJyYXlQcm90by5sYXN0SW5kZXhPZixcbiAgICBuYXRpdmVJc0FycmF5ICAgICAgPSBBcnJheS5pc0FycmF5LFxuICAgIG5hdGl2ZUtleXMgICAgICAgICA9IE9iamVjdC5rZXlzLFxuICAgIG5hdGl2ZUJpbmQgICAgICAgICA9IEZ1bmNQcm90by5iaW5kO1xuXG4gIC8vIENyZWF0ZSBhIHNhZmUgcmVmZXJlbmNlIHRvIHRoZSBVbmRlcnNjb3JlIG9iamVjdCBmb3IgdXNlIGJlbG93LlxuICB2YXIgXyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogaW5zdGFuY2VvZiBfKSByZXR1cm4gb2JqO1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBfKSkgcmV0dXJuIG5ldyBfKG9iaik7XG4gICAgdGhpcy5fd3JhcHBlZCA9IG9iajtcbiAgfTtcblxuICAvLyBFeHBvcnQgdGhlIFVuZGVyc2NvcmUgb2JqZWN0IGZvciAqKk5vZGUuanMqKiwgd2l0aFxuICAvLyBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eSBmb3IgdGhlIG9sZCBgcmVxdWlyZSgpYCBBUEkuIElmIHdlJ3JlIGluXG4gIC8vIHRoZSBicm93c2VyLCBhZGQgYF9gIGFzIGEgZ2xvYmFsIG9iamVjdCB2aWEgYSBzdHJpbmcgaWRlbnRpZmllcixcbiAgLy8gZm9yIENsb3N1cmUgQ29tcGlsZXIgXCJhZHZhbmNlZFwiIG1vZGUuXG4gIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAgIGV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IF87XG4gICAgfVxuICAgIGV4cG9ydHMuXyA9IF87XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5fID0gXztcbiAgfVxuXG4gIC8vIEN1cnJlbnQgdmVyc2lvbi5cbiAgXy5WRVJTSU9OID0gJzEuNS4yJztcblxuICAvLyBDb2xsZWN0aW9uIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFRoZSBjb3JuZXJzdG9uZSwgYW4gYGVhY2hgIGltcGxlbWVudGF0aW9uLCBha2EgYGZvckVhY2hgLlxuICAvLyBIYW5kbGVzIG9iamVjdHMgd2l0aCB0aGUgYnVpbHQtaW4gYGZvckVhY2hgLCBhcnJheXMsIGFuZCByYXcgb2JqZWN0cy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYGZvckVhY2hgIGlmIGF2YWlsYWJsZS5cbiAgdmFyIGVhY2ggPSBfLmVhY2ggPSBfLmZvckVhY2ggPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm47XG4gICAgaWYgKG5hdGl2ZUZvckVhY2ggJiYgb2JqLmZvckVhY2ggPT09IG5hdGl2ZUZvckVhY2gpIHtcbiAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICB9IGVsc2UgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gb2JqLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9ialtpXSwgaSwgb2JqKSA9PT0gYnJlYWtlcikgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGtleXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqW2tleXNbaV1dLCBrZXlzW2ldLCBvYmopID09PSBicmVha2VyKSByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgcmVzdWx0cyBvZiBhcHBseWluZyB0aGUgaXRlcmF0b3IgdG8gZWFjaCBlbGVtZW50LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgbWFwYCBpZiBhdmFpbGFibGUuXG4gIF8ubWFwID0gXy5jb2xsZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHRzID0gW107XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0cztcbiAgICBpZiAobmF0aXZlTWFwICYmIG9iai5tYXAgPT09IG5hdGl2ZU1hcCkgcmV0dXJuIG9iai5tYXAoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHJlc3VsdHMucHVzaChpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIHZhciByZWR1Y2VFcnJvciA9ICdSZWR1Y2Ugb2YgZW1wdHkgYXJyYXkgd2l0aCBubyBpbml0aWFsIHZhbHVlJztcblxuICAvLyAqKlJlZHVjZSoqIGJ1aWxkcyB1cCBhIHNpbmdsZSByZXN1bHQgZnJvbSBhIGxpc3Qgb2YgdmFsdWVzLCBha2EgYGluamVjdGAsXG4gIC8vIG9yIGBmb2xkbGAuIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGByZWR1Y2VgIGlmIGF2YWlsYWJsZS5cbiAgXy5yZWR1Y2UgPSBfLmZvbGRsID0gXy5pbmplY3QgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBtZW1vLCBjb250ZXh0KSB7XG4gICAgdmFyIGluaXRpYWwgPSBhcmd1bWVudHMubGVuZ3RoID4gMjtcbiAgICBpZiAob2JqID09IG51bGwpIG9iaiA9IFtdO1xuICAgIGlmIChuYXRpdmVSZWR1Y2UgJiYgb2JqLnJlZHVjZSA9PT0gbmF0aXZlUmVkdWNlKSB7XG4gICAgICBpZiAoY29udGV4dCkgaXRlcmF0b3IgPSBfLmJpbmQoaXRlcmF0b3IsIGNvbnRleHQpO1xuICAgICAgcmV0dXJuIGluaXRpYWwgPyBvYmoucmVkdWNlKGl0ZXJhdG9yLCBtZW1vKSA6IG9iai5yZWR1Y2UoaXRlcmF0b3IpO1xuICAgIH1cbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoIWluaXRpYWwpIHtcbiAgICAgICAgbWVtbyA9IHZhbHVlO1xuICAgICAgICBpbml0aWFsID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1lbW8gPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG1lbW8sIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICByZXR1cm4gbWVtbztcbiAgfTtcblxuICAvLyBUaGUgcmlnaHQtYXNzb2NpYXRpdmUgdmVyc2lvbiBvZiByZWR1Y2UsIGFsc28ga25vd24gYXMgYGZvbGRyYC5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYHJlZHVjZVJpZ2h0YCBpZiBhdmFpbGFibGUuXG4gIF8ucmVkdWNlUmlnaHQgPSBfLmZvbGRyID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgbWVtbywgY29udGV4dCkge1xuICAgIHZhciBpbml0aWFsID0gYXJndW1lbnRzLmxlbmd0aCA+IDI7XG4gICAgaWYgKG9iaiA9PSBudWxsKSBvYmogPSBbXTtcbiAgICBpZiAobmF0aXZlUmVkdWNlUmlnaHQgJiYgb2JqLnJlZHVjZVJpZ2h0ID09PSBuYXRpdmVSZWR1Y2VSaWdodCkge1xuICAgICAgaWYgKGNvbnRleHQpIGl0ZXJhdG9yID0gXy5iaW5kKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgIHJldHVybiBpbml0aWFsID8gb2JqLnJlZHVjZVJpZ2h0KGl0ZXJhdG9yLCBtZW1vKSA6IG9iai5yZWR1Y2VSaWdodChpdGVyYXRvcik7XG4gICAgfVxuICAgIHZhciBsZW5ndGggPSBvYmoubGVuZ3RoO1xuICAgIGlmIChsZW5ndGggIT09ICtsZW5ndGgpIHtcbiAgICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgICBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB9XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgaW5kZXggPSBrZXlzID8ga2V5c1stLWxlbmd0aF0gOiAtLWxlbmd0aDtcbiAgICAgIGlmICghaW5pdGlhbCkge1xuICAgICAgICBtZW1vID0gb2JqW2luZGV4XTtcbiAgICAgICAgaW5pdGlhbCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZW1vID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBtZW1vLCBvYmpbaW5kZXhdLCBpbmRleCwgbGlzdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKCFpbml0aWFsKSB0aHJvdyBuZXcgVHlwZUVycm9yKHJlZHVjZUVycm9yKTtcbiAgICByZXR1cm4gbWVtbztcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIGZpcnN0IHZhbHVlIHdoaWNoIHBhc3NlcyBhIHRydXRoIHRlc3QuIEFsaWFzZWQgYXMgYGRldGVjdGAuXG4gIF8uZmluZCA9IF8uZGV0ZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHZhciByZXN1bHQ7XG4gICAgYW55KG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIHRoYXQgcGFzcyBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBmaWx0ZXJgIGlmIGF2YWlsYWJsZS5cbiAgLy8gQWxpYXNlZCBhcyBgc2VsZWN0YC5cbiAgXy5maWx0ZXIgPSBfLnNlbGVjdCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdHM7XG4gICAgaWYgKG5hdGl2ZUZpbHRlciAmJiBvYmouZmlsdGVyID09PSBuYXRpdmVGaWx0ZXIpIHJldHVybiBvYmouZmlsdGVyKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSByZXN1bHRzLnB1c2godmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFJldHVybiBhbGwgdGhlIGVsZW1lbnRzIGZvciB3aGljaCBhIHRydXRoIHRlc3QgZmFpbHMuXG4gIF8ucmVqZWN0ID0gZnVuY3Rpb24ob2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIHJldHVybiBfLmZpbHRlcihvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuICFpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCk7XG4gICAgfSwgY29udGV4dCk7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIHdoZXRoZXIgYWxsIG9mIHRoZSBlbGVtZW50cyBtYXRjaCBhIHRydXRoIHRlc3QuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBldmVyeWAgaWYgYXZhaWxhYmxlLlxuICAvLyBBbGlhc2VkIGFzIGBhbGxgLlxuICBfLmV2ZXJ5ID0gXy5hbGwgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgfHwgKGl0ZXJhdG9yID0gXy5pZGVudGl0eSk7XG4gICAgdmFyIHJlc3VsdCA9IHRydWU7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChuYXRpdmVFdmVyeSAmJiBvYmouZXZlcnkgPT09IG5hdGl2ZUV2ZXJ5KSByZXR1cm4gb2JqLmV2ZXJ5KGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAoIShyZXN1bHQgPSByZXN1bHQgJiYgaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpKSkgcmV0dXJuIGJyZWFrZXI7XG4gICAgfSk7XG4gICAgcmV0dXJuICEhcmVzdWx0O1xuICB9O1xuXG4gIC8vIERldGVybWluZSBpZiBhdCBsZWFzdCBvbmUgZWxlbWVudCBpbiB0aGUgb2JqZWN0IG1hdGNoZXMgYSB0cnV0aCB0ZXN0LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgc29tZWAgaWYgYXZhaWxhYmxlLlxuICAvLyBBbGlhc2VkIGFzIGBhbnlgLlxuICB2YXIgYW55ID0gXy5zb21lID0gXy5hbnkgPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaXRlcmF0b3IgfHwgKGl0ZXJhdG9yID0gXy5pZGVudGl0eSk7XG4gICAgdmFyIHJlc3VsdCA9IGZhbHNlO1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIHJlc3VsdDtcbiAgICBpZiAobmF0aXZlU29tZSAmJiBvYmouc29tZSA9PT0gbmF0aXZlU29tZSkgcmV0dXJuIG9iai5zb21lKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICBpZiAocmVzdWx0IHx8IChyZXN1bHQgPSBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdCkpKSByZXR1cm4gYnJlYWtlcjtcbiAgICB9KTtcbiAgICByZXR1cm4gISFyZXN1bHQ7XG4gIH07XG5cbiAgLy8gRGV0ZXJtaW5lIGlmIHRoZSBhcnJheSBvciBvYmplY3QgY29udGFpbnMgYSBnaXZlbiB2YWx1ZSAodXNpbmcgYD09PWApLlxuICAvLyBBbGlhc2VkIGFzIGBpbmNsdWRlYC5cbiAgXy5jb250YWlucyA9IF8uaW5jbHVkZSA9IGZ1bmN0aW9uKG9iaiwgdGFyZ2V0KSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKG5hdGl2ZUluZGV4T2YgJiYgb2JqLmluZGV4T2YgPT09IG5hdGl2ZUluZGV4T2YpIHJldHVybiBvYmouaW5kZXhPZih0YXJnZXQpICE9IC0xO1xuICAgIHJldHVybiBhbnkob2JqLCBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgcmV0dXJuIHZhbHVlID09PSB0YXJnZXQ7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gSW52b2tlIGEgbWV0aG9kICh3aXRoIGFyZ3VtZW50cykgb24gZXZlcnkgaXRlbSBpbiBhIGNvbGxlY3Rpb24uXG4gIF8uaW52b2tlID0gZnVuY3Rpb24ob2JqLCBtZXRob2QpIHtcbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICB2YXIgaXNGdW5jID0gXy5pc0Z1bmN0aW9uKG1ldGhvZCk7XG4gICAgcmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIHJldHVybiAoaXNGdW5jID8gbWV0aG9kIDogdmFsdWVbbWV0aG9kXSkuYXBwbHkodmFsdWUsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYG1hcGA6IGZldGNoaW5nIGEgcHJvcGVydHkuXG4gIF8ucGx1Y2sgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlKXsgcmV0dXJuIHZhbHVlW2tleV07IH0pO1xuICB9O1xuXG4gIC8vIENvbnZlbmllbmNlIHZlcnNpb24gb2YgYSBjb21tb24gdXNlIGNhc2Ugb2YgYGZpbHRlcmA6IHNlbGVjdGluZyBvbmx5IG9iamVjdHNcbiAgLy8gY29udGFpbmluZyBzcGVjaWZpYyBga2V5OnZhbHVlYCBwYWlycy5cbiAgXy53aGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMsIGZpcnN0KSB7XG4gICAgaWYgKF8uaXNFbXB0eShhdHRycykpIHJldHVybiBmaXJzdCA/IHZvaWQgMCA6IFtdO1xuICAgIHJldHVybiBfW2ZpcnN0ID8gJ2ZpbmQnIDogJ2ZpbHRlciddKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBhdHRycykge1xuICAgICAgICBpZiAoYXR0cnNba2V5XSAhPT0gdmFsdWVba2V5XSkgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gQ29udmVuaWVuY2UgdmVyc2lvbiBvZiBhIGNvbW1vbiB1c2UgY2FzZSBvZiBgZmluZGA6IGdldHRpbmcgdGhlIGZpcnN0IG9iamVjdFxuICAvLyBjb250YWluaW5nIHNwZWNpZmljIGBrZXk6dmFsdWVgIHBhaXJzLlxuICBfLmZpbmRXaGVyZSA9IGZ1bmN0aW9uKG9iaiwgYXR0cnMpIHtcbiAgICByZXR1cm4gXy53aGVyZShvYmosIGF0dHJzLCB0cnVlKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG1heGltdW0gZWxlbWVudCBvciAoZWxlbWVudC1iYXNlZCBjb21wdXRhdGlvbikuXG4gIC8vIENhbid0IG9wdGltaXplIGFycmF5cyBvZiBpbnRlZ2VycyBsb25nZXIgdGhhbiA2NSw1MzUgZWxlbWVudHMuXG4gIC8vIFNlZSBbV2ViS2l0IEJ1ZyA4MDc5N10oaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTgwNzk3KVxuICBfLm1heCA9IGZ1bmN0aW9uKG9iaiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoIWl0ZXJhdG9yICYmIF8uaXNBcnJheShvYmopICYmIG9ialswXSA9PT0gK29ialswXSAmJiBvYmoubGVuZ3RoIDwgNjU1MzUpIHtcbiAgICAgIHJldHVybiBNYXRoLm1heC5hcHBseShNYXRoLCBvYmopO1xuICAgIH1cbiAgICBpZiAoIWl0ZXJhdG9yICYmIF8uaXNFbXB0eShvYmopKSByZXR1cm4gLUluZmluaXR5O1xuICAgIHZhciByZXN1bHQgPSB7Y29tcHV0ZWQgOiAtSW5maW5pdHksIHZhbHVlOiAtSW5maW5pdHl9O1xuICAgIGVhY2gob2JqLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGxpc3QpIHtcbiAgICAgIHZhciBjb21wdXRlZCA9IGl0ZXJhdG9yID8gaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIGxpc3QpIDogdmFsdWU7XG4gICAgICBjb21wdXRlZCA+IHJlc3VsdC5jb21wdXRlZCAmJiAocmVzdWx0ID0ge3ZhbHVlIDogdmFsdWUsIGNvbXB1dGVkIDogY29tcHV0ZWR9KTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0LnZhbHVlO1xuICB9O1xuXG4gIC8vIFJldHVybiB0aGUgbWluaW11bSBlbGVtZW50IChvciBlbGVtZW50LWJhc2VkIGNvbXB1dGF0aW9uKS5cbiAgXy5taW4gPSBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpdGVyYXRvciAmJiBfLmlzQXJyYXkob2JqKSAmJiBvYmpbMF0gPT09ICtvYmpbMF0gJiYgb2JqLmxlbmd0aCA8IDY1NTM1KSB7XG4gICAgICByZXR1cm4gTWF0aC5taW4uYXBwbHkoTWF0aCwgb2JqKTtcbiAgICB9XG4gICAgaWYgKCFpdGVyYXRvciAmJiBfLmlzRW1wdHkob2JqKSkgcmV0dXJuIEluZmluaXR5O1xuICAgIHZhciByZXN1bHQgPSB7Y29tcHV0ZWQgOiBJbmZpbml0eSwgdmFsdWU6IEluZmluaXR5fTtcbiAgICBlYWNoKG9iaiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBsaXN0KSB7XG4gICAgICB2YXIgY29tcHV0ZWQgPSBpdGVyYXRvciA/IGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgdmFsdWUsIGluZGV4LCBsaXN0KSA6IHZhbHVlO1xuICAgICAgY29tcHV0ZWQgPCByZXN1bHQuY29tcHV0ZWQgJiYgKHJlc3VsdCA9IHt2YWx1ZSA6IHZhbHVlLCBjb21wdXRlZCA6IGNvbXB1dGVkfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgfTtcblxuICAvLyBTaHVmZmxlIGFuIGFycmF5LCB1c2luZyB0aGUgbW9kZXJuIHZlcnNpb24gb2YgdGhlIFxuICAvLyBbRmlzaGVyLVlhdGVzIHNodWZmbGVdKGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvRmlzaGVy4oCTWWF0ZXNfc2h1ZmZsZSkuXG4gIF8uc2h1ZmZsZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciByYW5kO1xuICAgIHZhciBpbmRleCA9IDA7XG4gICAgdmFyIHNodWZmbGVkID0gW107XG4gICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICByYW5kID0gXy5yYW5kb20oaW5kZXgrKyk7XG4gICAgICBzaHVmZmxlZFtpbmRleCAtIDFdID0gc2h1ZmZsZWRbcmFuZF07XG4gICAgICBzaHVmZmxlZFtyYW5kXSA9IHZhbHVlO1xuICAgIH0pO1xuICAgIHJldHVybiBzaHVmZmxlZDtcbiAgfTtcblxuICAvLyBTYW1wbGUgKipuKiogcmFuZG9tIHZhbHVlcyBmcm9tIGFuIGFycmF5LlxuICAvLyBJZiAqKm4qKiBpcyBub3Qgc3BlY2lmaWVkLCByZXR1cm5zIGEgc2luZ2xlIHJhbmRvbSBlbGVtZW50IGZyb20gdGhlIGFycmF5LlxuICAvLyBUaGUgaW50ZXJuYWwgYGd1YXJkYCBhcmd1bWVudCBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBtYXBgLlxuICBfLnNhbXBsZSA9IGZ1bmN0aW9uKG9iaiwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDIgfHwgZ3VhcmQpIHtcbiAgICAgIHJldHVybiBvYmpbXy5yYW5kb20ob2JqLmxlbmd0aCAtIDEpXTtcbiAgICB9XG4gICAgcmV0dXJuIF8uc2h1ZmZsZShvYmopLnNsaWNlKDAsIE1hdGgubWF4KDAsIG4pKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB0byBnZW5lcmF0ZSBsb29rdXAgaXRlcmF0b3JzLlxuICB2YXIgbG9va3VwSXRlcmF0b3IgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBfLmlzRnVuY3Rpb24odmFsdWUpID8gdmFsdWUgOiBmdW5jdGlvbihvYmopeyByZXR1cm4gb2JqW3ZhbHVlXTsgfTtcbiAgfTtcblxuICAvLyBTb3J0IHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24gcHJvZHVjZWQgYnkgYW4gaXRlcmF0b3IuXG4gIF8uc29ydEJ5ID0gZnVuY3Rpb24ob2JqLCB2YWx1ZSwgY29udGV4dCkge1xuICAgIHZhciBpdGVyYXRvciA9IGxvb2t1cEl0ZXJhdG9yKHZhbHVlKTtcbiAgICByZXR1cm4gXy5wbHVjayhfLm1hcChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgbGlzdCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBpbmRleDogaW5kZXgsXG4gICAgICAgIGNyaXRlcmlhOiBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHZhbHVlLCBpbmRleCwgbGlzdClcbiAgICAgIH07XG4gICAgfSkuc29ydChmdW5jdGlvbihsZWZ0LCByaWdodCkge1xuICAgICAgdmFyIGEgPSBsZWZ0LmNyaXRlcmlhO1xuICAgICAgdmFyIGIgPSByaWdodC5jcml0ZXJpYTtcbiAgICAgIGlmIChhICE9PSBiKSB7XG4gICAgICAgIGlmIChhID4gYiB8fCBhID09PSB2b2lkIDApIHJldHVybiAxO1xuICAgICAgICBpZiAoYSA8IGIgfHwgYiA9PT0gdm9pZCAwKSByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgICByZXR1cm4gbGVmdC5pbmRleCAtIHJpZ2h0LmluZGV4O1xuICAgIH0pLCAndmFsdWUnKTtcbiAgfTtcblxuICAvLyBBbiBpbnRlcm5hbCBmdW5jdGlvbiB1c2VkIGZvciBhZ2dyZWdhdGUgXCJncm91cCBieVwiIG9wZXJhdGlvbnMuXG4gIHZhciBncm91cCA9IGZ1bmN0aW9uKGJlaGF2aW9yKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKG9iaiwgdmFsdWUsIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICAgIHZhciBpdGVyYXRvciA9IHZhbHVlID09IG51bGwgPyBfLmlkZW50aXR5IDogbG9va3VwSXRlcmF0b3IodmFsdWUpO1xuICAgICAgZWFjaChvYmosIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCkge1xuICAgICAgICB2YXIga2V5ID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCB2YWx1ZSwgaW5kZXgsIG9iaik7XG4gICAgICAgIGJlaGF2aW9yKHJlc3VsdCwga2V5LCB2YWx1ZSk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBHcm91cHMgdGhlIG9iamVjdCdzIHZhbHVlcyBieSBhIGNyaXRlcmlvbi4gUGFzcyBlaXRoZXIgYSBzdHJpbmcgYXR0cmlidXRlXG4gIC8vIHRvIGdyb3VwIGJ5LCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGUgY3JpdGVyaW9uLlxuICBfLmdyb3VwQnkgPSBncm91cChmdW5jdGlvbihyZXN1bHQsIGtleSwgdmFsdWUpIHtcbiAgICAoXy5oYXMocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0gOiAocmVzdWx0W2tleV0gPSBbXSkpLnB1c2godmFsdWUpO1xuICB9KTtcblxuICAvLyBJbmRleGVzIHRoZSBvYmplY3QncyB2YWx1ZXMgYnkgYSBjcml0ZXJpb24sIHNpbWlsYXIgdG8gYGdyb3VwQnlgLCBidXQgZm9yXG4gIC8vIHdoZW4geW91IGtub3cgdGhhdCB5b3VyIGluZGV4IHZhbHVlcyB3aWxsIGJlIHVuaXF1ZS5cbiAgXy5pbmRleEJ5ID0gZ3JvdXAoZnVuY3Rpb24ocmVzdWx0LCBrZXksIHZhbHVlKSB7XG4gICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcbiAgfSk7XG5cbiAgLy8gQ291bnRzIGluc3RhbmNlcyBvZiBhbiBvYmplY3QgdGhhdCBncm91cCBieSBhIGNlcnRhaW4gY3JpdGVyaW9uLiBQYXNzXG4gIC8vIGVpdGhlciBhIHN0cmluZyBhdHRyaWJ1dGUgdG8gY291bnQgYnksIG9yIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIHRoZVxuICAvLyBjcml0ZXJpb24uXG4gIF8uY291bnRCeSA9IGdyb3VwKGZ1bmN0aW9uKHJlc3VsdCwga2V5KSB7XG4gICAgXy5oYXMocmVzdWx0LCBrZXkpID8gcmVzdWx0W2tleV0rKyA6IHJlc3VsdFtrZXldID0gMTtcbiAgfSk7XG5cbiAgLy8gVXNlIGEgY29tcGFyYXRvciBmdW5jdGlvbiB0byBmaWd1cmUgb3V0IHRoZSBzbWFsbGVzdCBpbmRleCBhdCB3aGljaFxuICAvLyBhbiBvYmplY3Qgc2hvdWxkIGJlIGluc2VydGVkIHNvIGFzIHRvIG1haW50YWluIG9yZGVyLiBVc2VzIGJpbmFyeSBzZWFyY2guXG4gIF8uc29ydGVkSW5kZXggPSBmdW5jdGlvbihhcnJheSwgb2JqLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGl0ZXJhdG9yID0gaXRlcmF0b3IgPT0gbnVsbCA/IF8uaWRlbnRpdHkgOiBsb29rdXBJdGVyYXRvcihpdGVyYXRvcik7XG4gICAgdmFyIHZhbHVlID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmopO1xuICAgIHZhciBsb3cgPSAwLCBoaWdoID0gYXJyYXkubGVuZ3RoO1xuICAgIHdoaWxlIChsb3cgPCBoaWdoKSB7XG4gICAgICB2YXIgbWlkID0gKGxvdyArIGhpZ2gpID4+PiAxO1xuICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBhcnJheVttaWRdKSA8IHZhbHVlID8gbG93ID0gbWlkICsgMSA6IGhpZ2ggPSBtaWQ7XG4gICAgfVxuICAgIHJldHVybiBsb3c7XG4gIH07XG5cbiAgLy8gU2FmZWx5IGNyZWF0ZSBhIHJlYWwsIGxpdmUgYXJyYXkgZnJvbSBhbnl0aGluZyBpdGVyYWJsZS5cbiAgXy50b0FycmF5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKCFvYmopIHJldHVybiBbXTtcbiAgICBpZiAoXy5pc0FycmF5KG9iaikpIHJldHVybiBzbGljZS5jYWxsKG9iaik7XG4gICAgaWYgKG9iai5sZW5ndGggPT09ICtvYmoubGVuZ3RoKSByZXR1cm4gXy5tYXAob2JqLCBfLmlkZW50aXR5KTtcbiAgICByZXR1cm4gXy52YWx1ZXMob2JqKTtcbiAgfTtcblxuICAvLyBSZXR1cm4gdGhlIG51bWJlciBvZiBlbGVtZW50cyBpbiBhbiBvYmplY3QuXG4gIF8uc2l6ZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuIDA7XG4gICAgcmV0dXJuIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkgPyBvYmoubGVuZ3RoIDogXy5rZXlzKG9iaikubGVuZ3RoO1xuICB9O1xuXG4gIC8vIEFycmF5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS1cblxuICAvLyBHZXQgdGhlIGZpcnN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGZpcnN0IE5cbiAgLy8gdmFsdWVzIGluIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgaGVhZGAgYW5kIGB0YWtlYC4gVGhlICoqZ3VhcmQqKiBjaGVja1xuICAvLyBhbGxvd3MgaXQgdG8gd29yayB3aXRoIGBfLm1hcGAuXG4gIF8uZmlyc3QgPSBfLmhlYWQgPSBfLnRha2UgPSBmdW5jdGlvbihhcnJheSwgbiwgZ3VhcmQpIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICByZXR1cm4gKG4gPT0gbnVsbCkgfHwgZ3VhcmQgPyBhcnJheVswXSA6IHNsaWNlLmNhbGwoYXJyYXksIDAsIG4pO1xuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGxhc3QgZW50cnkgb2YgdGhlIGFycmF5LiBFc3BlY2lhbGx5IHVzZWZ1bCBvblxuICAvLyB0aGUgYXJndW1lbnRzIG9iamVjdC4gUGFzc2luZyAqKm4qKiB3aWxsIHJldHVybiBhbGwgdGhlIHZhbHVlcyBpblxuICAvLyB0aGUgYXJyYXksIGV4Y2x1ZGluZyB0aGUgbGFzdCBOLiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGhcbiAgLy8gYF8ubWFwYC5cbiAgXy5pbml0aWFsID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIDAsIGFycmF5Lmxlbmd0aCAtICgobiA9PSBudWxsKSB8fCBndWFyZCA/IDEgOiBuKSk7XG4gIH07XG5cbiAgLy8gR2V0IHRoZSBsYXN0IGVsZW1lbnQgb2YgYW4gYXJyYXkuIFBhc3NpbmcgKipuKiogd2lsbCByZXR1cm4gdGhlIGxhc3QgTlxuICAvLyB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5sYXN0ID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiB2b2lkIDA7XG4gICAgaWYgKChuID09IG51bGwpIHx8IGd1YXJkKSB7XG4gICAgICByZXR1cm4gYXJyYXlbYXJyYXkubGVuZ3RoIC0gMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzbGljZS5jYWxsKGFycmF5LCBNYXRoLm1heChhcnJheS5sZW5ndGggLSBuLCAwKSk7XG4gICAgfVxuICB9O1xuXG4gIC8vIFJldHVybnMgZXZlcnl0aGluZyBidXQgdGhlIGZpcnN0IGVudHJ5IG9mIHRoZSBhcnJheS4gQWxpYXNlZCBhcyBgdGFpbGAgYW5kIGBkcm9wYC5cbiAgLy8gRXNwZWNpYWxseSB1c2VmdWwgb24gdGhlIGFyZ3VtZW50cyBvYmplY3QuIFBhc3NpbmcgYW4gKipuKiogd2lsbCByZXR1cm5cbiAgLy8gdGhlIHJlc3QgTiB2YWx1ZXMgaW4gdGhlIGFycmF5LiBUaGUgKipndWFyZCoqXG4gIC8vIGNoZWNrIGFsbG93cyBpdCB0byB3b3JrIHdpdGggYF8ubWFwYC5cbiAgXy5yZXN0ID0gXy50YWlsID0gXy5kcm9wID0gZnVuY3Rpb24oYXJyYXksIG4sIGd1YXJkKSB7XG4gICAgcmV0dXJuIHNsaWNlLmNhbGwoYXJyYXksIChuID09IG51bGwpIHx8IGd1YXJkID8gMSA6IG4pO1xuICB9O1xuXG4gIC8vIFRyaW0gb3V0IGFsbCBmYWxzeSB2YWx1ZXMgZnJvbSBhbiBhcnJheS5cbiAgXy5jb21wYWN0ID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIoYXJyYXksIF8uaWRlbnRpdHkpO1xuICB9O1xuXG4gIC8vIEludGVybmFsIGltcGxlbWVudGF0aW9uIG9mIGEgcmVjdXJzaXZlIGBmbGF0dGVuYCBmdW5jdGlvbi5cbiAgdmFyIGZsYXR0ZW4gPSBmdW5jdGlvbihpbnB1dCwgc2hhbGxvdywgb3V0cHV0KSB7XG4gICAgaWYgKHNoYWxsb3cgJiYgXy5ldmVyeShpbnB1dCwgXy5pc0FycmF5KSkge1xuICAgICAgcmV0dXJuIGNvbmNhdC5hcHBseShvdXRwdXQsIGlucHV0KTtcbiAgICB9XG4gICAgZWFjaChpbnB1dCwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgIGlmIChfLmlzQXJyYXkodmFsdWUpIHx8IF8uaXNBcmd1bWVudHModmFsdWUpKSB7XG4gICAgICAgIHNoYWxsb3cgPyBwdXNoLmFwcGx5KG91dHB1dCwgdmFsdWUpIDogZmxhdHRlbih2YWx1ZSwgc2hhbGxvdywgb3V0cHV0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG91dHB1dC5wdXNoKHZhbHVlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gb3V0cHV0O1xuICB9O1xuXG4gIC8vIEZsYXR0ZW4gb3V0IGFuIGFycmF5LCBlaXRoZXIgcmVjdXJzaXZlbHkgKGJ5IGRlZmF1bHQpLCBvciBqdXN0IG9uZSBsZXZlbC5cbiAgXy5mbGF0dGVuID0gZnVuY3Rpb24oYXJyYXksIHNoYWxsb3cpIHtcbiAgICByZXR1cm4gZmxhdHRlbihhcnJheSwgc2hhbGxvdywgW10pO1xuICB9O1xuXG4gIC8vIFJldHVybiBhIHZlcnNpb24gb2YgdGhlIGFycmF5IHRoYXQgZG9lcyBub3QgY29udGFpbiB0aGUgc3BlY2lmaWVkIHZhbHVlKHMpLlxuICBfLndpdGhvdXQgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHJldHVybiBfLmRpZmZlcmVuY2UoYXJyYXksIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gIH07XG5cbiAgLy8gUHJvZHVjZSBhIGR1cGxpY2F0ZS1mcmVlIHZlcnNpb24gb2YgdGhlIGFycmF5LiBJZiB0aGUgYXJyYXkgaGFzIGFscmVhZHlcbiAgLy8gYmVlbiBzb3J0ZWQsIHlvdSBoYXZlIHRoZSBvcHRpb24gb2YgdXNpbmcgYSBmYXN0ZXIgYWxnb3JpdGhtLlxuICAvLyBBbGlhc2VkIGFzIGB1bmlxdWVgLlxuICBfLnVuaXEgPSBfLnVuaXF1ZSA9IGZ1bmN0aW9uKGFycmF5LCBpc1NvcnRlZCwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoXy5pc0Z1bmN0aW9uKGlzU29ydGVkKSkge1xuICAgICAgY29udGV4dCA9IGl0ZXJhdG9yO1xuICAgICAgaXRlcmF0b3IgPSBpc1NvcnRlZDtcbiAgICAgIGlzU29ydGVkID0gZmFsc2U7XG4gICAgfVxuICAgIHZhciBpbml0aWFsID0gaXRlcmF0b3IgPyBfLm1hcChhcnJheSwgaXRlcmF0b3IsIGNvbnRleHQpIDogYXJyYXk7XG4gICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICB2YXIgc2VlbiA9IFtdO1xuICAgIGVhY2goaW5pdGlhbCwgZnVuY3Rpb24odmFsdWUsIGluZGV4KSB7XG4gICAgICBpZiAoaXNTb3J0ZWQgPyAoIWluZGV4IHx8IHNlZW5bc2Vlbi5sZW5ndGggLSAxXSAhPT0gdmFsdWUpIDogIV8uY29udGFpbnMoc2VlbiwgdmFsdWUpKSB7XG4gICAgICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG4gICAgICAgIHJlc3VsdHMucHVzaChhcnJheVtpbmRleF0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyB0aGUgdW5pb246IGVhY2ggZGlzdGluY3QgZWxlbWVudCBmcm9tIGFsbCBvZlxuICAvLyB0aGUgcGFzc2VkLWluIGFycmF5cy5cbiAgXy51bmlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBfLnVuaXEoXy5mbGF0dGVuKGFyZ3VtZW50cywgdHJ1ZSkpO1xuICB9O1xuXG4gIC8vIFByb2R1Y2UgYW4gYXJyYXkgdGhhdCBjb250YWlucyBldmVyeSBpdGVtIHNoYXJlZCBiZXR3ZWVuIGFsbCB0aGVcbiAgLy8gcGFzc2VkLWluIGFycmF5cy5cbiAgXy5pbnRlcnNlY3Rpb24gPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHZhciByZXN0ID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBfLmZpbHRlcihfLnVuaXEoYXJyYXkpLCBmdW5jdGlvbihpdGVtKSB7XG4gICAgICByZXR1cm4gXy5ldmVyeShyZXN0LCBmdW5jdGlvbihvdGhlcikge1xuICAgICAgICByZXR1cm4gXy5pbmRleE9mKG90aGVyLCBpdGVtKSA+PSAwO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gVGFrZSB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIG9uZSBhcnJheSBhbmQgYSBudW1iZXIgb2Ygb3RoZXIgYXJyYXlzLlxuICAvLyBPbmx5IHRoZSBlbGVtZW50cyBwcmVzZW50IGluIGp1c3QgdGhlIGZpcnN0IGFycmF5IHdpbGwgcmVtYWluLlxuICBfLmRpZmZlcmVuY2UgPSBmdW5jdGlvbihhcnJheSkge1xuICAgIHZhciByZXN0ID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgcmV0dXJuIF8uZmlsdGVyKGFycmF5LCBmdW5jdGlvbih2YWx1ZSl7IHJldHVybiAhXy5jb250YWlucyhyZXN0LCB2YWx1ZSk7IH0pO1xuICB9O1xuXG4gIC8vIFppcCB0b2dldGhlciBtdWx0aXBsZSBsaXN0cyBpbnRvIGEgc2luZ2xlIGFycmF5IC0tIGVsZW1lbnRzIHRoYXQgc2hhcmVcbiAgLy8gYW4gaW5kZXggZ28gdG9nZXRoZXIuXG4gIF8uemlwID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGxlbmd0aCA9IF8ubWF4KF8ucGx1Y2soYXJndW1lbnRzLCBcImxlbmd0aFwiKS5jb25jYXQoMCkpO1xuICAgIHZhciByZXN1bHRzID0gbmV3IEFycmF5KGxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgcmVzdWx0c1tpXSA9IF8ucGx1Y2soYXJndW1lbnRzLCAnJyArIGkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfTtcblxuICAvLyBDb252ZXJ0cyBsaXN0cyBpbnRvIG9iamVjdHMuIFBhc3MgZWl0aGVyIGEgc2luZ2xlIGFycmF5IG9mIGBba2V5LCB2YWx1ZV1gXG4gIC8vIHBhaXJzLCBvciB0d28gcGFyYWxsZWwgYXJyYXlzIG9mIHRoZSBzYW1lIGxlbmd0aCAtLSBvbmUgb2Yga2V5cywgYW5kIG9uZSBvZlxuICAvLyB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZXMuXG4gIF8ub2JqZWN0ID0gZnVuY3Rpb24obGlzdCwgdmFsdWVzKSB7XG4gICAgaWYgKGxpc3QgPT0gbnVsbCkgcmV0dXJuIHt9O1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gbGlzdC5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZhbHVlcykge1xuICAgICAgICByZXN1bHRbbGlzdFtpXV0gPSB2YWx1ZXNbaV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHRbbGlzdFtpXVswXV0gPSBsaXN0W2ldWzFdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuXG4gIC8vIElmIHRoZSBicm93c2VyIGRvZXNuJ3Qgc3VwcGx5IHVzIHdpdGggaW5kZXhPZiAoSSdtIGxvb2tpbmcgYXQgeW91LCAqKk1TSUUqKiksXG4gIC8vIHdlIG5lZWQgdGhpcyBmdW5jdGlvbi4gUmV0dXJuIHRoZSBwb3NpdGlvbiBvZiB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBhblxuICAvLyBpdGVtIGluIGFuIGFycmF5LCBvciAtMSBpZiB0aGUgaXRlbSBpcyBub3QgaW5jbHVkZWQgaW4gdGhlIGFycmF5LlxuICAvLyBEZWxlZ2F0ZXMgdG8gKipFQ01BU2NyaXB0IDUqKidzIG5hdGl2ZSBgaW5kZXhPZmAgaWYgYXZhaWxhYmxlLlxuICAvLyBJZiB0aGUgYXJyYXkgaXMgbGFyZ2UgYW5kIGFscmVhZHkgaW4gc29ydCBvcmRlciwgcGFzcyBgdHJ1ZWBcbiAgLy8gZm9yICoqaXNTb3J0ZWQqKiB0byB1c2UgYmluYXJ5IHNlYXJjaC5cbiAgXy5pbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0sIGlzU29ydGVkKSB7XG4gICAgaWYgKGFycmF5ID09IG51bGwpIHJldHVybiAtMTtcbiAgICB2YXIgaSA9IDAsIGxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcbiAgICBpZiAoaXNTb3J0ZWQpIHtcbiAgICAgIGlmICh0eXBlb2YgaXNTb3J0ZWQgPT0gJ251bWJlcicpIHtcbiAgICAgICAgaSA9IChpc1NvcnRlZCA8IDAgPyBNYXRoLm1heCgwLCBsZW5ndGggKyBpc1NvcnRlZCkgOiBpc1NvcnRlZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpID0gXy5zb3J0ZWRJbmRleChhcnJheSwgaXRlbSk7XG4gICAgICAgIHJldHVybiBhcnJheVtpXSA9PT0gaXRlbSA/IGkgOiAtMTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG5hdGl2ZUluZGV4T2YgJiYgYXJyYXkuaW5kZXhPZiA9PT0gbmF0aXZlSW5kZXhPZikgcmV0dXJuIGFycmF5LmluZGV4T2YoaXRlbSwgaXNTb3J0ZWQpO1xuICAgIGZvciAoOyBpIDwgbGVuZ3RoOyBpKyspIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIC8vIERlbGVnYXRlcyB0byAqKkVDTUFTY3JpcHQgNSoqJ3MgbmF0aXZlIGBsYXN0SW5kZXhPZmAgaWYgYXZhaWxhYmxlLlxuICBfLmxhc3RJbmRleE9mID0gZnVuY3Rpb24oYXJyYXksIGl0ZW0sIGZyb20pIHtcbiAgICBpZiAoYXJyYXkgPT0gbnVsbCkgcmV0dXJuIC0xO1xuICAgIHZhciBoYXNJbmRleCA9IGZyb20gIT0gbnVsbDtcbiAgICBpZiAobmF0aXZlTGFzdEluZGV4T2YgJiYgYXJyYXkubGFzdEluZGV4T2YgPT09IG5hdGl2ZUxhc3RJbmRleE9mKSB7XG4gICAgICByZXR1cm4gaGFzSW5kZXggPyBhcnJheS5sYXN0SW5kZXhPZihpdGVtLCBmcm9tKSA6IGFycmF5Lmxhc3RJbmRleE9mKGl0ZW0pO1xuICAgIH1cbiAgICB2YXIgaSA9IChoYXNJbmRleCA/IGZyb20gOiBhcnJheS5sZW5ndGgpO1xuICAgIHdoaWxlIChpLS0pIGlmIChhcnJheVtpXSA9PT0gaXRlbSkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xuICB9O1xuXG4gIC8vIEdlbmVyYXRlIGFuIGludGVnZXIgQXJyYXkgY29udGFpbmluZyBhbiBhcml0aG1ldGljIHByb2dyZXNzaW9uLiBBIHBvcnQgb2ZcbiAgLy8gdGhlIG5hdGl2ZSBQeXRob24gYHJhbmdlKClgIGZ1bmN0aW9uLiBTZWVcbiAgLy8gW3RoZSBQeXRob24gZG9jdW1lbnRhdGlvbl0oaHR0cDovL2RvY3MucHl0aG9uLm9yZy9saWJyYXJ5L2Z1bmN0aW9ucy5odG1sI3JhbmdlKS5cbiAgXy5yYW5nZSA9IGZ1bmN0aW9uKHN0YXJ0LCBzdG9wLCBzdGVwKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPD0gMSkge1xuICAgICAgc3RvcCA9IHN0YXJ0IHx8IDA7XG4gICAgICBzdGFydCA9IDA7XG4gICAgfVxuICAgIHN0ZXAgPSBhcmd1bWVudHNbMl0gfHwgMTtcblxuICAgIHZhciBsZW5ndGggPSBNYXRoLm1heChNYXRoLmNlaWwoKHN0b3AgLSBzdGFydCkgLyBzdGVwKSwgMCk7XG4gICAgdmFyIGlkeCA9IDA7XG4gICAgdmFyIHJhbmdlID0gbmV3IEFycmF5KGxlbmd0aCk7XG5cbiAgICB3aGlsZShpZHggPCBsZW5ndGgpIHtcbiAgICAgIHJhbmdlW2lkeCsrXSA9IHN0YXJ0O1xuICAgICAgc3RhcnQgKz0gc3RlcDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmFuZ2U7XG4gIH07XG5cbiAgLy8gRnVuY3Rpb24gKGFoZW0pIEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSZXVzYWJsZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBmb3IgcHJvdG90eXBlIHNldHRpbmcuXG4gIHZhciBjdG9yID0gZnVuY3Rpb24oKXt9O1xuXG4gIC8vIENyZWF0ZSBhIGZ1bmN0aW9uIGJvdW5kIHRvIGEgZ2l2ZW4gb2JqZWN0IChhc3NpZ25pbmcgYHRoaXNgLCBhbmQgYXJndW1lbnRzLFxuICAvLyBvcHRpb25hbGx5KS4gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYEZ1bmN0aW9uLmJpbmRgIGlmXG4gIC8vIGF2YWlsYWJsZS5cbiAgXy5iaW5kID0gZnVuY3Rpb24oZnVuYywgY29udGV4dCkge1xuICAgIHZhciBhcmdzLCBib3VuZDtcbiAgICBpZiAobmF0aXZlQmluZCAmJiBmdW5jLmJpbmQgPT09IG5hdGl2ZUJpbmQpIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgaWYgKCFfLmlzRnVuY3Rpb24oZnVuYykpIHRocm93IG5ldyBUeXBlRXJyb3I7XG4gICAgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICByZXR1cm4gYm91bmQgPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkpIHJldHVybiBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MuY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgY3Rvci5wcm90b3R5cGUgPSBmdW5jLnByb3RvdHlwZTtcbiAgICAgIHZhciBzZWxmID0gbmV3IGN0b3I7XG4gICAgICBjdG9yLnByb3RvdHlwZSA9IG51bGw7XG4gICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShzZWxmLCBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgIGlmIChPYmplY3QocmVzdWx0KSA9PT0gcmVzdWx0KSByZXR1cm4gcmVzdWx0O1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcbiAgfTtcblxuICAvLyBQYXJ0aWFsbHkgYXBwbHkgYSBmdW5jdGlvbiBieSBjcmVhdGluZyBhIHZlcnNpb24gdGhhdCBoYXMgaGFkIHNvbWUgb2YgaXRzXG4gIC8vIGFyZ3VtZW50cyBwcmUtZmlsbGVkLCB3aXRob3V0IGNoYW5naW5nIGl0cyBkeW5hbWljIGB0aGlzYCBjb250ZXh0LlxuICBfLnBhcnRpYWwgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgdmFyIGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpcywgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBCaW5kIGFsbCBvZiBhbiBvYmplY3QncyBtZXRob2RzIHRvIHRoYXQgb2JqZWN0LiBVc2VmdWwgZm9yIGVuc3VyaW5nIHRoYXRcbiAgLy8gYWxsIGNhbGxiYWNrcyBkZWZpbmVkIG9uIGFuIG9iamVjdCBiZWxvbmcgdG8gaXQuXG4gIF8uYmluZEFsbCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBmdW5jcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBpZiAoZnVuY3MubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoXCJiaW5kQWxsIG11c3QgYmUgcGFzc2VkIGZ1bmN0aW9uIG5hbWVzXCIpO1xuICAgIGVhY2goZnVuY3MsIGZ1bmN0aW9uKGYpIHsgb2JqW2ZdID0gXy5iaW5kKG9ialtmXSwgb2JqKTsgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBNZW1vaXplIGFuIGV4cGVuc2l2ZSBmdW5jdGlvbiBieSBzdG9yaW5nIGl0cyByZXN1bHRzLlxuICBfLm1lbW9pemUgPSBmdW5jdGlvbihmdW5jLCBoYXNoZXIpIHtcbiAgICB2YXIgbWVtbyA9IHt9O1xuICAgIGhhc2hlciB8fCAoaGFzaGVyID0gXy5pZGVudGl0eSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGtleSA9IGhhc2hlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIF8uaGFzKG1lbW8sIGtleSkgPyBtZW1vW2tleV0gOiAobWVtb1trZXldID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpKTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIERlbGF5cyBhIGZ1bmN0aW9uIGZvciB0aGUgZ2l2ZW4gbnVtYmVyIG9mIG1pbGxpc2Vjb25kcywgYW5kIHRoZW4gY2FsbHNcbiAgLy8gaXQgd2l0aCB0aGUgYXJndW1lbnRzIHN1cHBsaWVkLlxuICBfLmRlbGF5ID0gZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7IHJldHVybiBmdW5jLmFwcGx5KG51bGwsIGFyZ3MpOyB9LCB3YWl0KTtcbiAgfTtcblxuICAvLyBEZWZlcnMgYSBmdW5jdGlvbiwgc2NoZWR1bGluZyBpdCB0byBydW4gYWZ0ZXIgdGhlIGN1cnJlbnQgY2FsbCBzdGFjayBoYXNcbiAgLy8gY2xlYXJlZC5cbiAgXy5kZWZlciA9IGZ1bmN0aW9uKGZ1bmMpIHtcbiAgICByZXR1cm4gXy5kZWxheS5hcHBseShfLCBbZnVuYywgMV0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiwgdGhhdCwgd2hlbiBpbnZva2VkLCB3aWxsIG9ubHkgYmUgdHJpZ2dlcmVkIGF0IG1vc3Qgb25jZVxuICAvLyBkdXJpbmcgYSBnaXZlbiB3aW5kb3cgb2YgdGltZS4gTm9ybWFsbHksIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbCBydW5cbiAgLy8gYXMgbXVjaCBhcyBpdCBjYW4sIHdpdGhvdXQgZXZlciBnb2luZyBtb3JlIHRoYW4gb25jZSBwZXIgYHdhaXRgIGR1cmF0aW9uO1xuICAvLyBidXQgaWYgeW91J2QgbGlrZSB0byBkaXNhYmxlIHRoZSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSwgcGFzc1xuICAvLyBge2xlYWRpbmc6IGZhbHNlfWAuIFRvIGRpc2FibGUgZXhlY3V0aW9uIG9uIHRoZSB0cmFpbGluZyBlZGdlLCBkaXR0by5cbiAgXy50aHJvdHRsZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICB2YXIgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgIHZhciB0aW1lb3V0ID0gbnVsbDtcbiAgICB2YXIgcHJldmlvdXMgPSAwO1xuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG4gICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICBwcmV2aW91cyA9IG9wdGlvbnMubGVhZGluZyA9PT0gZmFsc2UgPyAwIDogbmV3IERhdGU7XG4gICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgfTtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgbm93ID0gbmV3IERhdGU7XG4gICAgICBpZiAoIXByZXZpb3VzICYmIG9wdGlvbnMubGVhZGluZyA9PT0gZmFsc2UpIHByZXZpb3VzID0gbm93O1xuICAgICAgdmFyIHJlbWFpbmluZyA9IHdhaXQgLSAobm93IC0gcHJldmlvdXMpO1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgIHByZXZpb3VzID0gbm93O1xuICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgfSBlbHNlIGlmICghdGltZW91dCAmJiBvcHRpb25zLnRyYWlsaW5nICE9PSBmYWxzZSkge1xuICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgcmVtYWluaW5nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIGFzIGxvbmcgYXMgaXQgY29udGludWVzIHRvIGJlIGludm9rZWQsIHdpbGwgbm90XG4gIC8vIGJlIHRyaWdnZXJlZC4gVGhlIGZ1bmN0aW9uIHdpbGwgYmUgY2FsbGVkIGFmdGVyIGl0IHN0b3BzIGJlaW5nIGNhbGxlZCBmb3JcbiAgLy8gTiBtaWxsaXNlY29uZHMuIElmIGBpbW1lZGlhdGVgIGlzIHBhc3NlZCwgdHJpZ2dlciB0aGUgZnVuY3Rpb24gb24gdGhlXG4gIC8vIGxlYWRpbmcgZWRnZSwgaW5zdGVhZCBvZiB0aGUgdHJhaWxpbmcuXG4gIF8uZGVib3VuY2UgPSBmdW5jdGlvbihmdW5jLCB3YWl0LCBpbW1lZGlhdGUpIHtcbiAgICB2YXIgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wLCByZXN1bHQ7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcbiAgICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbGFzdCA9IChuZXcgRGF0ZSgpKSAtIHRpbWVzdGFtcDtcbiAgICAgICAgaWYgKGxhc3QgPCB3YWl0KSB7XG4gICAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICBpZiAoIWltbWVkaWF0ZSkgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciBjYWxsTm93ID0gaW1tZWRpYXRlICYmICF0aW1lb3V0O1xuICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgIH1cbiAgICAgIGlmIChjYWxsTm93KSByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgYXQgbW9zdCBvbmUgdGltZSwgbm8gbWF0dGVyIGhvd1xuICAvLyBvZnRlbiB5b3UgY2FsbCBpdC4gVXNlZnVsIGZvciBsYXp5IGluaXRpYWxpemF0aW9uLlxuICBfLm9uY2UgPSBmdW5jdGlvbihmdW5jKSB7XG4gICAgdmFyIHJhbiA9IGZhbHNlLCBtZW1vO1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChyYW4pIHJldHVybiBtZW1vO1xuICAgICAgcmFuID0gdHJ1ZTtcbiAgICAgIG1lbW8gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICBmdW5jID0gbnVsbDtcbiAgICAgIHJldHVybiBtZW1vO1xuICAgIH07XG4gIH07XG5cbiAgLy8gUmV0dXJucyB0aGUgZmlyc3QgZnVuY3Rpb24gcGFzc2VkIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSBzZWNvbmQsXG4gIC8vIGFsbG93aW5nIHlvdSB0byBhZGp1c3QgYXJndW1lbnRzLCBydW4gY29kZSBiZWZvcmUgYW5kIGFmdGVyLCBhbmRcbiAgLy8gY29uZGl0aW9uYWxseSBleGVjdXRlIHRoZSBvcmlnaW5hbCBmdW5jdGlvbi5cbiAgXy53cmFwID0gZnVuY3Rpb24oZnVuYywgd3JhcHBlcikge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBhcmdzID0gW2Z1bmNdO1xuICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuICAgICAgcmV0dXJuIHdyYXBwZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfTtcbiAgfTtcblxuICAvLyBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBpcyB0aGUgY29tcG9zaXRpb24gb2YgYSBsaXN0IG9mIGZ1bmN0aW9ucywgZWFjaFxuICAvLyBjb25zdW1pbmcgdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZnVuY3Rpb24gdGhhdCBmb2xsb3dzLlxuICBfLmNvbXBvc2UgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZnVuY3MgPSBhcmd1bWVudHM7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICBmb3IgKHZhciBpID0gZnVuY3MubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgYXJncyA9IFtmdW5jc1tpXS5hcHBseSh0aGlzLCBhcmdzKV07XG4gICAgICB9XG4gICAgICByZXR1cm4gYXJnc1swXTtcbiAgICB9O1xuICB9O1xuXG4gIC8vIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHdpbGwgb25seSBiZSBleGVjdXRlZCBhZnRlciBiZWluZyBjYWxsZWQgTiB0aW1lcy5cbiAgXy5hZnRlciA9IGZ1bmN0aW9uKHRpbWVzLCBmdW5jKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKC0tdGltZXMgPCAxKSB7XG4gICAgICAgIHJldHVybiBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICB9XG4gICAgfTtcbiAgfTtcblxuICAvLyBPYmplY3QgRnVuY3Rpb25zXG4gIC8vIC0tLS0tLS0tLS0tLS0tLS1cblxuICAvLyBSZXRyaWV2ZSB0aGUgbmFtZXMgb2YgYW4gb2JqZWN0J3MgcHJvcGVydGllcy5cbiAgLy8gRGVsZWdhdGVzIHRvICoqRUNNQVNjcmlwdCA1KioncyBuYXRpdmUgYE9iamVjdC5rZXlzYFxuICBfLmtleXMgPSBuYXRpdmVLZXlzIHx8IGZ1bmN0aW9uKG9iaikge1xuICAgIGlmIChvYmogIT09IE9iamVjdChvYmopKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIG9iamVjdCcpO1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgaWYgKF8uaGFzKG9iaiwga2V5KSkga2V5cy5wdXNoKGtleSk7XG4gICAgcmV0dXJuIGtleXM7XG4gIH07XG5cbiAgLy8gUmV0cmlldmUgdGhlIHZhbHVlcyBvZiBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICBfLnZhbHVlcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBrZXlzID0gXy5rZXlzKG9iaik7XG4gICAgdmFyIGxlbmd0aCA9IGtleXMubGVuZ3RoO1xuICAgIHZhciB2YWx1ZXMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB2YWx1ZXNbaV0gPSBvYmpba2V5c1tpXV07XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG4gIH07XG5cbiAgLy8gQ29udmVydCBhbiBvYmplY3QgaW50byBhIGxpc3Qgb2YgYFtrZXksIHZhbHVlXWAgcGFpcnMuXG4gIF8ucGFpcnMgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIHZhciBsZW5ndGggPSBrZXlzLmxlbmd0aDtcbiAgICB2YXIgcGFpcnMgPSBuZXcgQXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICBwYWlyc1tpXSA9IFtrZXlzW2ldLCBvYmpba2V5c1tpXV1dO1xuICAgIH1cbiAgICByZXR1cm4gcGFpcnM7XG4gIH07XG5cbiAgLy8gSW52ZXJ0IHRoZSBrZXlzIGFuZCB2YWx1ZXMgb2YgYW4gb2JqZWN0LiBUaGUgdmFsdWVzIG11c3QgYmUgc2VyaWFsaXphYmxlLlxuICBfLmludmVydCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciByZXN1bHQgPSB7fTtcbiAgICB2YXIga2V5cyA9IF8ua2V5cyhvYmopO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBrZXlzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICByZXN1bHRbb2JqW2tleXNbaV1dXSA9IGtleXNbaV07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgc29ydGVkIGxpc3Qgb2YgdGhlIGZ1bmN0aW9uIG5hbWVzIGF2YWlsYWJsZSBvbiB0aGUgb2JqZWN0LlxuICAvLyBBbGlhc2VkIGFzIGBtZXRob2RzYFxuICBfLmZ1bmN0aW9ucyA9IF8ubWV0aG9kcyA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBuYW1lcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChfLmlzRnVuY3Rpb24ob2JqW2tleV0pKSBuYW1lcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiBuYW1lcy5zb3J0KCk7XG4gIH07XG5cbiAgLy8gRXh0ZW5kIGEgZ2l2ZW4gb2JqZWN0IHdpdGggYWxsIHRoZSBwcm9wZXJ0aWVzIGluIHBhc3NlZC1pbiBvYmplY3QocykuXG4gIF8uZXh0ZW5kID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgZWFjaChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgIG9ialtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgY29weSBvZiB0aGUgb2JqZWN0IG9ubHkgY29udGFpbmluZyB0aGUgd2hpdGVsaXN0ZWQgcHJvcGVydGllcy5cbiAgXy5waWNrID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgdmFyIGNvcHkgPSB7fTtcbiAgICB2YXIga2V5cyA9IGNvbmNhdC5hcHBseShBcnJheVByb3RvLCBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpO1xuICAgIGVhY2goa2V5cywgZnVuY3Rpb24oa2V5KSB7XG4gICAgICBpZiAoa2V5IGluIG9iaikgY29weVtrZXldID0gb2JqW2tleV07XG4gICAgfSk7XG4gICAgcmV0dXJuIGNvcHk7XG4gIH07XG5cbiAgIC8vIFJldHVybiBhIGNvcHkgb2YgdGhlIG9iamVjdCB3aXRob3V0IHRoZSBibGFja2xpc3RlZCBwcm9wZXJ0aWVzLlxuICBfLm9taXQgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgY29weSA9IHt9O1xuICAgIHZhciBrZXlzID0gY29uY2F0LmFwcGx5KEFycmF5UHJvdG8sIHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSk7XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKCFfLmNvbnRhaW5zKGtleXMsIGtleSkpIGNvcHlba2V5XSA9IG9ialtrZXldO1xuICAgIH1cbiAgICByZXR1cm4gY29weTtcbiAgfTtcblxuICAvLyBGaWxsIGluIGEgZ2l2ZW4gb2JqZWN0IHdpdGggZGVmYXVsdCBwcm9wZXJ0aWVzLlxuICBfLmRlZmF1bHRzID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgZWFjaChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSksIGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgICAgaWYgKHNvdXJjZSkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHNvdXJjZSkge1xuICAgICAgICAgIGlmIChvYmpbcHJvcF0gPT09IHZvaWQgMCkgb2JqW3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG9iajtcbiAgfTtcblxuICAvLyBDcmVhdGUgYSAoc2hhbGxvdy1jbG9uZWQpIGR1cGxpY2F0ZSBvZiBhbiBvYmplY3QuXG4gIF8uY2xvbmUgPSBmdW5jdGlvbihvYmopIHtcbiAgICBpZiAoIV8uaXNPYmplY3Qob2JqKSkgcmV0dXJuIG9iajtcbiAgICByZXR1cm4gXy5pc0FycmF5KG9iaikgPyBvYmouc2xpY2UoKSA6IF8uZXh0ZW5kKHt9LCBvYmopO1xuICB9O1xuXG4gIC8vIEludm9rZXMgaW50ZXJjZXB0b3Igd2l0aCB0aGUgb2JqLCBhbmQgdGhlbiByZXR1cm5zIG9iai5cbiAgLy8gVGhlIHByaW1hcnkgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2QgY2hhaW4sIGluXG4gIC8vIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW4gdGhlIGNoYWluLlxuICBfLnRhcCA9IGZ1bmN0aW9uKG9iaiwgaW50ZXJjZXB0b3IpIHtcbiAgICBpbnRlcmNlcHRvcihvYmopO1xuICAgIHJldHVybiBvYmo7XG4gIH07XG5cbiAgLy8gSW50ZXJuYWwgcmVjdXJzaXZlIGNvbXBhcmlzb24gZnVuY3Rpb24gZm9yIGBpc0VxdWFsYC5cbiAgdmFyIGVxID0gZnVuY3Rpb24oYSwgYiwgYVN0YWNrLCBiU3RhY2spIHtcbiAgICAvLyBJZGVudGljYWwgb2JqZWN0cyBhcmUgZXF1YWwuIGAwID09PSAtMGAsIGJ1dCB0aGV5IGFyZW4ndCBpZGVudGljYWwuXG4gICAgLy8gU2VlIHRoZSBbSGFybW9ueSBgZWdhbGAgcHJvcG9zYWxdKGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPWhhcm1vbnk6ZWdhbCkuXG4gICAgaWYgKGEgPT09IGIpIHJldHVybiBhICE9PSAwIHx8IDEgLyBhID09IDEgLyBiO1xuICAgIC8vIEEgc3RyaWN0IGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5IGJlY2F1c2UgYG51bGwgPT0gdW5kZWZpbmVkYC5cbiAgICBpZiAoYSA9PSBudWxsIHx8IGIgPT0gbnVsbCkgcmV0dXJuIGEgPT09IGI7XG4gICAgLy8gVW53cmFwIGFueSB3cmFwcGVkIG9iamVjdHMuXG4gICAgaWYgKGEgaW5zdGFuY2VvZiBfKSBhID0gYS5fd3JhcHBlZDtcbiAgICBpZiAoYiBpbnN0YW5jZW9mIF8pIGIgPSBiLl93cmFwcGVkO1xuICAgIC8vIENvbXBhcmUgYFtbQ2xhc3NdXWAgbmFtZXMuXG4gICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSk7XG4gICAgaWYgKGNsYXNzTmFtZSAhPSB0b1N0cmluZy5jYWxsKGIpKSByZXR1cm4gZmFsc2U7XG4gICAgc3dpdGNoIChjbGFzc05hbWUpIHtcbiAgICAgIC8vIFN0cmluZ3MsIG51bWJlcnMsIGRhdGVzLCBhbmQgYm9vbGVhbnMgYXJlIGNvbXBhcmVkIGJ5IHZhbHVlLlxuICAgICAgY2FzZSAnW29iamVjdCBTdHJpbmddJzpcbiAgICAgICAgLy8gUHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3Qgd3JhcHBlcnMgYXJlIGVxdWl2YWxlbnQ7IHRodXMsIGBcIjVcImAgaXNcbiAgICAgICAgLy8gZXF1aXZhbGVudCB0byBgbmV3IFN0cmluZyhcIjVcIilgLlxuICAgICAgICByZXR1cm4gYSA9PSBTdHJpbmcoYik7XG4gICAgICBjYXNlICdbb2JqZWN0IE51bWJlcl0nOlxuICAgICAgICAvLyBgTmFOYHMgYXJlIGVxdWl2YWxlbnQsIGJ1dCBub24tcmVmbGV4aXZlLiBBbiBgZWdhbGAgY29tcGFyaXNvbiBpcyBwZXJmb3JtZWQgZm9yXG4gICAgICAgIC8vIG90aGVyIG51bWVyaWMgdmFsdWVzLlxuICAgICAgICByZXR1cm4gYSAhPSArYSA/IGIgIT0gK2IgOiAoYSA9PSAwID8gMSAvIGEgPT0gMSAvIGIgOiBhID09ICtiKTtcbiAgICAgIGNhc2UgJ1tvYmplY3QgRGF0ZV0nOlxuICAgICAgY2FzZSAnW29iamVjdCBCb29sZWFuXSc6XG4gICAgICAgIC8vIENvZXJjZSBkYXRlcyBhbmQgYm9vbGVhbnMgdG8gbnVtZXJpYyBwcmltaXRpdmUgdmFsdWVzLiBEYXRlcyBhcmUgY29tcGFyZWQgYnkgdGhlaXJcbiAgICAgICAgLy8gbWlsbGlzZWNvbmQgcmVwcmVzZW50YXRpb25zLiBOb3RlIHRoYXQgaW52YWxpZCBkYXRlcyB3aXRoIG1pbGxpc2Vjb25kIHJlcHJlc2VudGF0aW9uc1xuICAgICAgICAvLyBvZiBgTmFOYCBhcmUgbm90IGVxdWl2YWxlbnQuXG4gICAgICAgIHJldHVybiArYSA9PSArYjtcbiAgICAgIC8vIFJlZ0V4cHMgYXJlIGNvbXBhcmVkIGJ5IHRoZWlyIHNvdXJjZSBwYXR0ZXJucyBhbmQgZmxhZ3MuXG4gICAgICBjYXNlICdbb2JqZWN0IFJlZ0V4cF0nOlxuICAgICAgICByZXR1cm4gYS5zb3VyY2UgPT0gYi5zb3VyY2UgJiZcbiAgICAgICAgICAgICAgIGEuZ2xvYmFsID09IGIuZ2xvYmFsICYmXG4gICAgICAgICAgICAgICBhLm11bHRpbGluZSA9PSBiLm11bHRpbGluZSAmJlxuICAgICAgICAgICAgICAgYS5pZ25vcmVDYXNlID09IGIuaWdub3JlQ2FzZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBhICE9ICdvYmplY3QnIHx8IHR5cGVvZiBiICE9ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gQXNzdW1lIGVxdWFsaXR5IGZvciBjeWNsaWMgc3RydWN0dXJlcy4gVGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpY1xuICAgIC8vIHN0cnVjdHVyZXMgaXMgYWRhcHRlZCBmcm9tIEVTIDUuMSBzZWN0aW9uIDE1LjEyLjMsIGFic3RyYWN0IG9wZXJhdGlvbiBgSk9gLlxuICAgIHZhciBsZW5ndGggPSBhU3RhY2subGVuZ3RoO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgLy8gTGluZWFyIHNlYXJjaC4gUGVyZm9ybWFuY2UgaXMgaW52ZXJzZWx5IHByb3BvcnRpb25hbCB0byB0aGUgbnVtYmVyIG9mXG4gICAgICAvLyB1bmlxdWUgbmVzdGVkIHN0cnVjdHVyZXMuXG4gICAgICBpZiAoYVN0YWNrW2xlbmd0aF0gPT0gYSkgcmV0dXJuIGJTdGFja1tsZW5ndGhdID09IGI7XG4gICAgfVxuICAgIC8vIE9iamVjdHMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1aXZhbGVudCwgYnV0IGBPYmplY3Rgc1xuICAgIC8vIGZyb20gZGlmZmVyZW50IGZyYW1lcyBhcmUuXG4gICAgdmFyIGFDdG9yID0gYS5jb25zdHJ1Y3RvciwgYkN0b3IgPSBiLmNvbnN0cnVjdG9yO1xuICAgIGlmIChhQ3RvciAhPT0gYkN0b3IgJiYgIShfLmlzRnVuY3Rpb24oYUN0b3IpICYmIChhQ3RvciBpbnN0YW5jZW9mIGFDdG9yKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmlzRnVuY3Rpb24oYkN0b3IpICYmIChiQ3RvciBpbnN0YW5jZW9mIGJDdG9yKSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgLy8gQWRkIHRoZSBmaXJzdCBvYmplY3QgdG8gdGhlIHN0YWNrIG9mIHRyYXZlcnNlZCBvYmplY3RzLlxuICAgIGFTdGFjay5wdXNoKGEpO1xuICAgIGJTdGFjay5wdXNoKGIpO1xuICAgIHZhciBzaXplID0gMCwgcmVzdWx0ID0gdHJ1ZTtcbiAgICAvLyBSZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cy5cbiAgICBpZiAoY2xhc3NOYW1lID09ICdbb2JqZWN0IEFycmF5XScpIHtcbiAgICAgIC8vIENvbXBhcmUgYXJyYXkgbGVuZ3RocyB0byBkZXRlcm1pbmUgaWYgYSBkZWVwIGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5LlxuICAgICAgc2l6ZSA9IGEubGVuZ3RoO1xuICAgICAgcmVzdWx0ID0gc2l6ZSA9PSBiLmxlbmd0aDtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgLy8gRGVlcCBjb21wYXJlIHRoZSBjb250ZW50cywgaWdub3Jpbmcgbm9uLW51bWVyaWMgcHJvcGVydGllcy5cbiAgICAgICAgd2hpbGUgKHNpemUtLSkge1xuICAgICAgICAgIGlmICghKHJlc3VsdCA9IGVxKGFbc2l6ZV0sIGJbc2l6ZV0sIGFTdGFjaywgYlN0YWNrKSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERlZXAgY29tcGFyZSBvYmplY3RzLlxuICAgICAgZm9yICh2YXIga2V5IGluIGEpIHtcbiAgICAgICAgaWYgKF8uaGFzKGEsIGtleSkpIHtcbiAgICAgICAgICAvLyBDb3VudCB0aGUgZXhwZWN0ZWQgbnVtYmVyIG9mIHByb3BlcnRpZXMuXG4gICAgICAgICAgc2l6ZSsrO1xuICAgICAgICAgIC8vIERlZXAgY29tcGFyZSBlYWNoIG1lbWJlci5cbiAgICAgICAgICBpZiAoIShyZXN1bHQgPSBfLmhhcyhiLCBrZXkpICYmIGVxKGFba2V5XSwgYltrZXldLCBhU3RhY2ssIGJTdGFjaykpKSBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gRW5zdXJlIHRoYXQgYm90aCBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUgbnVtYmVyIG9mIHByb3BlcnRpZXMuXG4gICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgIGZvciAoa2V5IGluIGIpIHtcbiAgICAgICAgICBpZiAoXy5oYXMoYiwga2V5KSAmJiAhKHNpemUtLSkpIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCA9ICFzaXplO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBSZW1vdmUgdGhlIGZpcnN0IG9iamVjdCBmcm9tIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0cy5cbiAgICBhU3RhY2sucG9wKCk7XG4gICAgYlN0YWNrLnBvcCgpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLy8gUGVyZm9ybSBhIGRlZXAgY29tcGFyaXNvbiB0byBjaGVjayBpZiB0d28gb2JqZWN0cyBhcmUgZXF1YWwuXG4gIF8uaXNFcXVhbCA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICByZXR1cm4gZXEoYSwgYiwgW10sIFtdKTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIGFycmF5LCBzdHJpbmcsIG9yIG9iamVjdCBlbXB0eT9cbiAgLy8gQW4gXCJlbXB0eVwiIG9iamVjdCBoYXMgbm8gZW51bWVyYWJsZSBvd24tcHJvcGVydGllcy5cbiAgXy5pc0VtcHR5ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgaWYgKG9iaiA9PSBudWxsKSByZXR1cm4gdHJ1ZTtcbiAgICBpZiAoXy5pc0FycmF5KG9iaikgfHwgXy5pc1N0cmluZyhvYmopKSByZXR1cm4gb2JqLmxlbmd0aCA9PT0gMDtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBpZiAoXy5oYXMob2JqLCBrZXkpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH07XG5cbiAgLy8gSXMgYSBnaXZlbiB2YWx1ZSBhIERPTSBlbGVtZW50P1xuICBfLmlzRWxlbWVudCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiAhIShvYmogJiYgb2JqLm5vZGVUeXBlID09PSAxKTtcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhbHVlIGFuIGFycmF5P1xuICAvLyBEZWxlZ2F0ZXMgdG8gRUNNQTUncyBuYXRpdmUgQXJyYXkuaXNBcnJheVxuICBfLmlzQXJyYXkgPSBuYXRpdmVJc0FycmF5IHx8IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcblxuICAvLyBJcyBhIGdpdmVuIHZhcmlhYmxlIGFuIG9iamVjdD9cbiAgXy5pc09iamVjdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IE9iamVjdChvYmopO1xuICB9O1xuXG4gIC8vIEFkZCBzb21lIGlzVHlwZSBtZXRob2RzOiBpc0FyZ3VtZW50cywgaXNGdW5jdGlvbiwgaXNTdHJpbmcsIGlzTnVtYmVyLCBpc0RhdGUsIGlzUmVnRXhwLlxuICBlYWNoKFsnQXJndW1lbnRzJywgJ0Z1bmN0aW9uJywgJ1N0cmluZycsICdOdW1iZXInLCAnRGF0ZScsICdSZWdFeHAnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIF9bJ2lzJyArIG5hbWVdID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHJpbmcuY2FsbChvYmopID09ICdbb2JqZWN0ICcgKyBuYW1lICsgJ10nO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIERlZmluZSBhIGZhbGxiYWNrIHZlcnNpb24gb2YgdGhlIG1ldGhvZCBpbiBicm93c2VycyAoYWhlbSwgSUUpLCB3aGVyZVxuICAvLyB0aGVyZSBpc24ndCBhbnkgaW5zcGVjdGFibGUgXCJBcmd1bWVudHNcIiB0eXBlLlxuICBpZiAoIV8uaXNBcmd1bWVudHMoYXJndW1lbnRzKSkge1xuICAgIF8uaXNBcmd1bWVudHMgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiAhIShvYmogJiYgXy5oYXMob2JqLCAnY2FsbGVlJykpO1xuICAgIH07XG4gIH1cblxuICAvLyBPcHRpbWl6ZSBgaXNGdW5jdGlvbmAgaWYgYXBwcm9wcmlhdGUuXG4gIGlmICh0eXBlb2YgKC8uLykgIT09ICdmdW5jdGlvbicpIHtcbiAgICBfLmlzRnVuY3Rpb24gPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nO1xuICAgIH07XG4gIH1cblxuICAvLyBJcyBhIGdpdmVuIG9iamVjdCBhIGZpbml0ZSBudW1iZXI/XG4gIF8uaXNGaW5pdGUgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gaXNGaW5pdGUob2JqKSAmJiAhaXNOYU4ocGFyc2VGbG9hdChvYmopKTtcbiAgfTtcblxuICAvLyBJcyB0aGUgZ2l2ZW4gdmFsdWUgYE5hTmA/IChOYU4gaXMgdGhlIG9ubHkgbnVtYmVyIHdoaWNoIGRvZXMgbm90IGVxdWFsIGl0c2VsZikuXG4gIF8uaXNOYU4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gXy5pc051bWJlcihvYmopICYmIG9iaiAhPSArb2JqO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgYSBib29sZWFuP1xuICBfLmlzQm9vbGVhbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBvYmogPT09IHRydWUgfHwgb2JqID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQm9vbGVhbl0nO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFsdWUgZXF1YWwgdG8gbnVsbD9cbiAgXy5pc051bGwgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gb2JqID09PSBudWxsO1xuICB9O1xuXG4gIC8vIElzIGEgZ2l2ZW4gdmFyaWFibGUgdW5kZWZpbmVkP1xuICBfLmlzVW5kZWZpbmVkID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIG9iaiA9PT0gdm9pZCAwO1xuICB9O1xuXG4gIC8vIFNob3J0Y3V0IGZ1bmN0aW9uIGZvciBjaGVja2luZyBpZiBhbiBvYmplY3QgaGFzIGEgZ2l2ZW4gcHJvcGVydHkgZGlyZWN0bHlcbiAgLy8gb24gaXRzZWxmIChpbiBvdGhlciB3b3Jkcywgbm90IG9uIGEgcHJvdG90eXBlKS5cbiAgXy5oYXMgPSBmdW5jdGlvbihvYmosIGtleSkge1xuICAgIHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KTtcbiAgfTtcblxuICAvLyBVdGlsaXR5IEZ1bmN0aW9uc1xuICAvLyAtLS0tLS0tLS0tLS0tLS0tLVxuXG4gIC8vIFJ1biBVbmRlcnNjb3JlLmpzIGluICpub0NvbmZsaWN0KiBtb2RlLCByZXR1cm5pbmcgdGhlIGBfYCB2YXJpYWJsZSB0byBpdHNcbiAgLy8gcHJldmlvdXMgb3duZXIuIFJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICByb290Ll8gPSBwcmV2aW91c1VuZGVyc2NvcmU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLy8gS2VlcCB0aGUgaWRlbnRpdHkgZnVuY3Rpb24gYXJvdW5kIGZvciBkZWZhdWx0IGl0ZXJhdG9ycy5cbiAgXy5pZGVudGl0eSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIC8vIFJ1biBhIGZ1bmN0aW9uICoqbioqIHRpbWVzLlxuICBfLnRpbWVzID0gZnVuY3Rpb24obiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICB2YXIgYWNjdW0gPSBBcnJheShNYXRoLm1heCgwLCBuKSk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuOyBpKyspIGFjY3VtW2ldID0gaXRlcmF0b3IuY2FsbChjb250ZXh0LCBpKTtcbiAgICByZXR1cm4gYWNjdW07XG4gIH07XG5cbiAgLy8gUmV0dXJuIGEgcmFuZG9tIGludGVnZXIgYmV0d2VlbiBtaW4gYW5kIG1heCAoaW5jbHVzaXZlKS5cbiAgXy5yYW5kb20gPSBmdW5jdGlvbihtaW4sIG1heCkge1xuICAgIGlmIChtYXggPT0gbnVsbCkge1xuICAgICAgbWF4ID0gbWluO1xuICAgICAgbWluID0gMDtcbiAgICB9XG4gICAgcmV0dXJuIG1pbiArIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSk7XG4gIH07XG5cbiAgLy8gTGlzdCBvZiBIVE1MIGVudGl0aWVzIGZvciBlc2NhcGluZy5cbiAgdmFyIGVudGl0eU1hcCA9IHtcbiAgICBlc2NhcGU6IHtcbiAgICAgICcmJzogJyZhbXA7JyxcbiAgICAgICc8JzogJyZsdDsnLFxuICAgICAgJz4nOiAnJmd0OycsXG4gICAgICAnXCInOiAnJnF1b3Q7JyxcbiAgICAgIFwiJ1wiOiAnJiN4Mjc7J1xuICAgIH1cbiAgfTtcbiAgZW50aXR5TWFwLnVuZXNjYXBlID0gXy5pbnZlcnQoZW50aXR5TWFwLmVzY2FwZSk7XG5cbiAgLy8gUmVnZXhlcyBjb250YWluaW5nIHRoZSBrZXlzIGFuZCB2YWx1ZXMgbGlzdGVkIGltbWVkaWF0ZWx5IGFib3ZlLlxuICB2YXIgZW50aXR5UmVnZXhlcyA9IHtcbiAgICBlc2NhcGU6ICAgbmV3IFJlZ0V4cCgnWycgKyBfLmtleXMoZW50aXR5TWFwLmVzY2FwZSkuam9pbignJykgKyAnXScsICdnJyksXG4gICAgdW5lc2NhcGU6IG5ldyBSZWdFeHAoJygnICsgXy5rZXlzKGVudGl0eU1hcC51bmVzY2FwZSkuam9pbignfCcpICsgJyknLCAnZycpXG4gIH07XG5cbiAgLy8gRnVuY3Rpb25zIGZvciBlc2NhcGluZyBhbmQgdW5lc2NhcGluZyBzdHJpbmdzIHRvL2Zyb20gSFRNTCBpbnRlcnBvbGF0aW9uLlxuICBfLmVhY2goWydlc2NhcGUnLCAndW5lc2NhcGUnXSwgZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgX1ttZXRob2RdID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICBpZiAoc3RyaW5nID09IG51bGwpIHJldHVybiAnJztcbiAgICAgIHJldHVybiAoJycgKyBzdHJpbmcpLnJlcGxhY2UoZW50aXR5UmVnZXhlc1ttZXRob2RdLCBmdW5jdGlvbihtYXRjaCkge1xuICAgICAgICByZXR1cm4gZW50aXR5TWFwW21ldGhvZF1bbWF0Y2hdO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgLy8gSWYgdGhlIHZhbHVlIG9mIHRoZSBuYW1lZCBgcHJvcGVydHlgIGlzIGEgZnVuY3Rpb24gdGhlbiBpbnZva2UgaXQgd2l0aCB0aGVcbiAgLy8gYG9iamVjdGAgYXMgY29udGV4dDsgb3RoZXJ3aXNlLCByZXR1cm4gaXQuXG4gIF8ucmVzdWx0ID0gZnVuY3Rpb24ob2JqZWN0LCBwcm9wZXJ0eSkge1xuICAgIGlmIChvYmplY3QgPT0gbnVsbCkgcmV0dXJuIHZvaWQgMDtcbiAgICB2YXIgdmFsdWUgPSBvYmplY3RbcHJvcGVydHldO1xuICAgIHJldHVybiBfLmlzRnVuY3Rpb24odmFsdWUpID8gdmFsdWUuY2FsbChvYmplY3QpIDogdmFsdWU7XG4gIH07XG5cbiAgLy8gQWRkIHlvdXIgb3duIGN1c3RvbSBmdW5jdGlvbnMgdG8gdGhlIFVuZGVyc2NvcmUgb2JqZWN0LlxuICBfLm1peGluID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgZWFjaChfLmZ1bmN0aW9ucyhvYmopLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICB2YXIgZnVuYyA9IF9bbmFtZV0gPSBvYmpbbmFtZV07XG4gICAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYXJncyA9IFt0aGlzLl93cmFwcGVkXTtcbiAgICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuICAgICAgICByZXR1cm4gcmVzdWx0LmNhbGwodGhpcywgZnVuYy5hcHBseShfLCBhcmdzKSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEdlbmVyYXRlIGEgdW5pcXVlIGludGVnZXIgaWQgKHVuaXF1ZSB3aXRoaW4gdGhlIGVudGlyZSBjbGllbnQgc2Vzc2lvbikuXG4gIC8vIFVzZWZ1bCBmb3IgdGVtcG9yYXJ5IERPTSBpZHMuXG4gIHZhciBpZENvdW50ZXIgPSAwO1xuICBfLnVuaXF1ZUlkID0gZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgdmFyIGlkID0gKytpZENvdW50ZXIgKyAnJztcbiAgICByZXR1cm4gcHJlZml4ID8gcHJlZml4ICsgaWQgOiBpZDtcbiAgfTtcblxuICAvLyBCeSBkZWZhdWx0LCBVbmRlcnNjb3JlIHVzZXMgRVJCLXN0eWxlIHRlbXBsYXRlIGRlbGltaXRlcnMsIGNoYW5nZSB0aGVcbiAgLy8gZm9sbG93aW5nIHRlbXBsYXRlIHNldHRpbmdzIHRvIHVzZSBhbHRlcm5hdGl2ZSBkZWxpbWl0ZXJzLlxuICBfLnRlbXBsYXRlU2V0dGluZ3MgPSB7XG4gICAgZXZhbHVhdGUgICAgOiAvPCUoW1xcc1xcU10rPyklPi9nLFxuICAgIGludGVycG9sYXRlIDogLzwlPShbXFxzXFxTXSs/KSU+L2csXG4gICAgZXNjYXBlICAgICAgOiAvPCUtKFtcXHNcXFNdKz8pJT4vZ1xuICB9O1xuXG4gIC8vIFdoZW4gY3VzdG9taXppbmcgYHRlbXBsYXRlU2V0dGluZ3NgLCBpZiB5b3UgZG9uJ3Qgd2FudCB0byBkZWZpbmUgYW5cbiAgLy8gaW50ZXJwb2xhdGlvbiwgZXZhbHVhdGlvbiBvciBlc2NhcGluZyByZWdleCwgd2UgbmVlZCBvbmUgdGhhdCBpc1xuICAvLyBndWFyYW50ZWVkIG5vdCB0byBtYXRjaC5cbiAgdmFyIG5vTWF0Y2ggPSAvKC4pXi87XG5cbiAgLy8gQ2VydGFpbiBjaGFyYWN0ZXJzIG5lZWQgdG8gYmUgZXNjYXBlZCBzbyB0aGF0IHRoZXkgY2FuIGJlIHB1dCBpbnRvIGFcbiAgLy8gc3RyaW5nIGxpdGVyYWwuXG4gIHZhciBlc2NhcGVzID0ge1xuICAgIFwiJ1wiOiAgICAgIFwiJ1wiLFxuICAgICdcXFxcJzogICAgICdcXFxcJyxcbiAgICAnXFxyJzogICAgICdyJyxcbiAgICAnXFxuJzogICAgICduJyxcbiAgICAnXFx0JzogICAgICd0JyxcbiAgICAnXFx1MjAyOCc6ICd1MjAyOCcsXG4gICAgJ1xcdTIwMjknOiAndTIwMjknXG4gIH07XG5cbiAgdmFyIGVzY2FwZXIgPSAvXFxcXHwnfFxccnxcXG58XFx0fFxcdTIwMjh8XFx1MjAyOS9nO1xuXG4gIC8vIEphdmFTY3JpcHQgbWljcm8tdGVtcGxhdGluZywgc2ltaWxhciB0byBKb2huIFJlc2lnJ3MgaW1wbGVtZW50YXRpb24uXG4gIC8vIFVuZGVyc2NvcmUgdGVtcGxhdGluZyBoYW5kbGVzIGFyYml0cmFyeSBkZWxpbWl0ZXJzLCBwcmVzZXJ2ZXMgd2hpdGVzcGFjZSxcbiAgLy8gYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXG4gIF8udGVtcGxhdGUgPSBmdW5jdGlvbih0ZXh0LCBkYXRhLCBzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXI7XG4gICAgc2V0dGluZ3MgPSBfLmRlZmF1bHRzKHt9LCBzZXR0aW5ncywgXy50ZW1wbGF0ZVNldHRpbmdzKTtcblxuICAgIC8vIENvbWJpbmUgZGVsaW1pdGVycyBpbnRvIG9uZSByZWd1bGFyIGV4cHJlc3Npb24gdmlhIGFsdGVybmF0aW9uLlxuICAgIHZhciBtYXRjaGVyID0gbmV3IFJlZ0V4cChbXG4gICAgICAoc2V0dGluZ3MuZXNjYXBlIHx8IG5vTWF0Y2gpLnNvdXJjZSxcbiAgICAgIChzZXR0aW5ncy5pbnRlcnBvbGF0ZSB8fCBub01hdGNoKS5zb3VyY2UsXG4gICAgICAoc2V0dGluZ3MuZXZhbHVhdGUgfHwgbm9NYXRjaCkuc291cmNlXG4gICAgXS5qb2luKCd8JykgKyAnfCQnLCAnZycpO1xuXG4gICAgLy8gQ29tcGlsZSB0aGUgdGVtcGxhdGUgc291cmNlLCBlc2NhcGluZyBzdHJpbmcgbGl0ZXJhbHMgYXBwcm9wcmlhdGVseS5cbiAgICB2YXIgaW5kZXggPSAwO1xuICAgIHZhciBzb3VyY2UgPSBcIl9fcCs9J1wiO1xuICAgIHRleHQucmVwbGFjZShtYXRjaGVyLCBmdW5jdGlvbihtYXRjaCwgZXNjYXBlLCBpbnRlcnBvbGF0ZSwgZXZhbHVhdGUsIG9mZnNldCkge1xuICAgICAgc291cmNlICs9IHRleHQuc2xpY2UoaW5kZXgsIG9mZnNldClcbiAgICAgICAgLnJlcGxhY2UoZXNjYXBlciwgZnVuY3Rpb24obWF0Y2gpIHsgcmV0dXJuICdcXFxcJyArIGVzY2FwZXNbbWF0Y2hdOyB9KTtcblxuICAgICAgaWYgKGVzY2FwZSkge1xuICAgICAgICBzb3VyY2UgKz0gXCInK1xcbigoX190PShcIiArIGVzY2FwZSArIFwiKSk9PW51bGw/Jyc6Xy5lc2NhcGUoX190KSkrXFxuJ1wiO1xuICAgICAgfVxuICAgICAgaWYgKGludGVycG9sYXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIicrXFxuKChfX3Q9KFwiICsgaW50ZXJwb2xhdGUgKyBcIikpPT1udWxsPycnOl9fdCkrXFxuJ1wiO1xuICAgICAgfVxuICAgICAgaWYgKGV2YWx1YXRlKSB7XG4gICAgICAgIHNvdXJjZSArPSBcIic7XFxuXCIgKyBldmFsdWF0ZSArIFwiXFxuX19wKz0nXCI7XG4gICAgICB9XG4gICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcbiAgICAgIHJldHVybiBtYXRjaDtcbiAgICB9KTtcbiAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xuXG4gICAgLy8gSWYgYSB2YXJpYWJsZSBpcyBub3Qgc3BlY2lmaWVkLCBwbGFjZSBkYXRhIHZhbHVlcyBpbiBsb2NhbCBzY29wZS5cbiAgICBpZiAoIXNldHRpbmdzLnZhcmlhYmxlKSBzb3VyY2UgPSAnd2l0aChvYmp8fHt9KXtcXG4nICsgc291cmNlICsgJ31cXG4nO1xuXG4gICAgc291cmNlID0gXCJ2YXIgX190LF9fcD0nJyxfX2o9QXJyYXkucHJvdG90eXBlLmpvaW4sXCIgK1xuICAgICAgXCJwcmludD1mdW5jdGlvbigpe19fcCs9X19qLmNhbGwoYXJndW1lbnRzLCcnKTt9O1xcblwiICtcbiAgICAgIHNvdXJjZSArIFwicmV0dXJuIF9fcDtcXG5cIjtcblxuICAgIHRyeSB7XG4gICAgICByZW5kZXIgPSBuZXcgRnVuY3Rpb24oc2V0dGluZ3MudmFyaWFibGUgfHwgJ29iaicsICdfJywgc291cmNlKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBlLnNvdXJjZSA9IHNvdXJjZTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEpIHJldHVybiByZW5kZXIoZGF0YSwgXyk7XG4gICAgdmFyIHRlbXBsYXRlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgcmV0dXJuIHJlbmRlci5jYWxsKHRoaXMsIGRhdGEsIF8pO1xuICAgIH07XG5cbiAgICAvLyBQcm92aWRlIHRoZSBjb21waWxlZCBmdW5jdGlvbiBzb3VyY2UgYXMgYSBjb252ZW5pZW5jZSBmb3IgcHJlY29tcGlsYXRpb24uXG4gICAgdGVtcGxhdGUuc291cmNlID0gJ2Z1bmN0aW9uKCcgKyAoc2V0dGluZ3MudmFyaWFibGUgfHwgJ29iaicpICsgJyl7XFxuJyArIHNvdXJjZSArICd9JztcblxuICAgIHJldHVybiB0ZW1wbGF0ZTtcbiAgfTtcblxuICAvLyBBZGQgYSBcImNoYWluXCIgZnVuY3Rpb24sIHdoaWNoIHdpbGwgZGVsZWdhdGUgdG8gdGhlIHdyYXBwZXIuXG4gIF8uY2hhaW4gPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gXyhvYmopLmNoYWluKCk7XG4gIH07XG5cbiAgLy8gT09QXG4gIC8vIC0tLS0tLS0tLS0tLS0tLVxuICAvLyBJZiBVbmRlcnNjb3JlIGlzIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLCBpdCByZXR1cm5zIGEgd3JhcHBlZCBvYmplY3QgdGhhdFxuICAvLyBjYW4gYmUgdXNlZCBPTy1zdHlsZS4gVGhpcyB3cmFwcGVyIGhvbGRzIGFsdGVyZWQgdmVyc2lvbnMgb2YgYWxsIHRoZVxuICAvLyB1bmRlcnNjb3JlIGZ1bmN0aW9ucy4gV3JhcHBlZCBvYmplY3RzIG1heSBiZSBjaGFpbmVkLlxuXG4gIC8vIEhlbHBlciBmdW5jdGlvbiB0byBjb250aW51ZSBjaGFpbmluZyBpbnRlcm1lZGlhdGUgcmVzdWx0cy5cbiAgdmFyIHJlc3VsdCA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiB0aGlzLl9jaGFpbiA/IF8ob2JqKS5jaGFpbigpIDogb2JqO1xuICB9O1xuXG4gIC8vIEFkZCBhbGwgb2YgdGhlIFVuZGVyc2NvcmUgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyIG9iamVjdC5cbiAgXy5taXhpbihfKTtcblxuICAvLyBBZGQgYWxsIG11dGF0b3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsncG9wJywgJ3B1c2gnLCAncmV2ZXJzZScsICdzaGlmdCcsICdzb3J0JywgJ3NwbGljZScsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB2YXIgbWV0aG9kID0gQXJyYXlQcm90b1tuYW1lXTtcbiAgICBfLnByb3RvdHlwZVtuYW1lXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIG9iaiA9IHRoaXMuX3dyYXBwZWQ7XG4gICAgICBtZXRob2QuYXBwbHkob2JqLCBhcmd1bWVudHMpO1xuICAgICAgaWYgKChuYW1lID09ICdzaGlmdCcgfHwgbmFtZSA9PSAnc3BsaWNlJykgJiYgb2JqLmxlbmd0aCA9PT0gMCkgZGVsZXRlIG9ialswXTtcbiAgICAgIHJldHVybiByZXN1bHQuY2FsbCh0aGlzLCBvYmopO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFkZCBhbGwgYWNjZXNzb3IgQXJyYXkgZnVuY3Rpb25zIHRvIHRoZSB3cmFwcGVyLlxuICBlYWNoKFsnY29uY2F0JywgJ2pvaW4nLCAnc2xpY2UnXSwgZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciBtZXRob2QgPSBBcnJheVByb3RvW25hbWVdO1xuICAgIF8ucHJvdG90eXBlW25hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcmVzdWx0LmNhbGwodGhpcywgbWV0aG9kLmFwcGx5KHRoaXMuX3dyYXBwZWQsIGFyZ3VtZW50cykpO1xuICAgIH07XG4gIH0pO1xuXG4gIF8uZXh0ZW5kKF8ucHJvdG90eXBlLCB7XG5cbiAgICAvLyBTdGFydCBjaGFpbmluZyBhIHdyYXBwZWQgVW5kZXJzY29yZSBvYmplY3QuXG4gICAgY2hhaW46IGZ1bmN0aW9uKCkge1xuICAgICAgdGhpcy5fY2hhaW4gPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8vIEV4dHJhY3RzIHRoZSByZXN1bHQgZnJvbSBhIHdyYXBwZWQgYW5kIGNoYWluZWQgb2JqZWN0LlxuICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLl93cmFwcGVkO1xuICAgIH1cblxuICB9KTtcblxufSkuY2FsbCh0aGlzKTtcbiIsInZhciBsb2cgPSByZXF1aXJlKFwibG9nbGV2ZWxcIiksXG4gICAgXyAgID0gcmVxdWlyZShcInVuZGVyc2NvcmVcIik7XG5cbi8qKiogQ2FjaGUgKioqL1xudmFyIHN0YXRlUHJlZml4ID0gXCJzdGF0ZS1cIixcbiAgICBzdGF0ZVJlZ2V4ICA9IG5ldyBSZWdFeHAoXCJeXCIrc3RhdGVQcmVmaXgsIFwiXCIpLFxuICAgIG5vb3AgPSBmdW5jdGlvbigpIHt9LFxuICAgIHN0YXRlQ2xhc3NGaWx0ZXIgPSBmdW5jdGlvbihjKSB7XG4gICAgICAgIHJldHVybiBjLm1hdGNoKHN0YXRlUmVnZXgpO1xuICAgIH0sXG4gICAgZ2V0U3RhdGVDbGFzc1JlZ2V4ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVnRXhwKFwiXlwiICsgc3RhdGVQcmVmaXggKyBrZXkgKyBcIi1cIiwgXCJcIik7XG4gICAgfTtcblxuLyoqKiBUaGUgQ2xhc3MgKioqL1xudmFyIFN0YXRlID0gZnVuY3Rpb24odmlldywgZGVmYXVsdHMpIHtcbiAgICB0aGlzLnZpZXcgICAgICAgPSB2aWV3O1xuICAgIHRoaXMuZGF0YSAgICAgICA9IHt9O1xuICAgIHRoaXMuYmluZGluZ3MgICA9IHt9O1xuICAgIHRoaXMubGlzdGVuZXJzICA9IHt9O1xuXG4gICAgdGhpcy5fc2V0RGVmYXVsdHMoZGVmYXVsdHMpO1xufTtcblxuU3RhdGUucHJvdG90eXBlID0ge1xuXG4gICAgLyoqKiBHZXR0ZXJzICYgU2V0dGVycyAqKiovXG4gICAgc2V0OiBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICAgIC8vVmFsaWRhdGVcbiAgICAgICAgaWYoIWtleS5tYXRjaCgvXlthLXpBLVowLTlcXC5dKyQvKSkge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwiU3RhdGUgbmFtZSAnXCIgKyBrZXkgKyBcIicgaXMgbm90IGFscGhhbnVtZXJpYy5cIik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAvL1NldFxuICAgICAgICAgICAgaWYodGhpcy5nZXQoa2V5KSAhPSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YVtrZXldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyKGtleSwgdmFsdWUpO1xuXG4gICAgICAgICAgICAgICAgaWYodmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09IGZhbHNlIHx8ICh0eXBlb2YgdmFsdWUgPT0gJ3N0cmluZycgJiYgdmFsdWUubWF0Y2goL15bYS16QS1aMC05XSskLykpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGNsYXNzZXMgPSB0aGlzLnZpZXcuX2dldENsYXNzZXMoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2V4ICAgPSBnZXRTdGF0ZUNsYXNzUmVnZXgoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGkgICAgICAgPSBjbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZWQgPSBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1N0YXRlID0gc3RhdGVQcmVmaXggKyBrZXkgKyBcIi1cIiArIHZhbHVlO1xuXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlKGktLSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoY2xhc3Nlc1tpXS5tYXRjaChyZWdleCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihuZXdTdGF0ZSA9PSBjbGFzc2VzW2ldKSAgcmV0dXJuIHRoaXM7IC8vRG9uJ3QgZG8gYW55dGhpbmcgaWYgdGhlcmUgaXMgbm8gY2hhbmdlIChlZmZpY2llbnQhISEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzZXNbaV0gPSBuZXdTdGF0ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmluZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYoIWRlZmluZWQpIGNsYXNzZXMucHVzaChuZXdTdGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudmlldy5fc2V0Q2xhc3NlcyhjbGFzc2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFba2V5XTtcbiAgICB9LFxuICAgIHJlbW92ZTogZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIGlmKHRoaXMuZ2V0KGtleSkpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmRhdGFba2V5XTtcbiAgICAgICAgICAgIHRoaXMudHJpZ2dlcihrZXksIG51bGwpO1xuXG4gICAgICAgICAgICB2YXIgY2xhc3NlcyA9IHRoaXMudmlldy5fZ2V0Q2xhc3NlcygpLFxuICAgICAgICAgICAgICAgIGxlbiAgICAgPSBjbGFzc2VzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICByZWdleCAgID0gZ2V0U3RhdGVDbGFzc1JlZ2V4KGtleSk7XG5cbiAgICAgICAgICAgIGNsYXNzZXMgPSBfLnJlamVjdChjbGFzc2VzLCBmdW5jdGlvbihjKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGMubWF0Y2gocmVnZXgpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmKGNsYXNzZXMubGVuZ3RoICE9IGxlbikgdGhpcy52aWV3LndyYXBwZXIuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJyk7IC8vRG9uJ3QgZG8gYW55dGhpbmcgaWYgdGhlcmUgaXMgbm8gY2hhbmdlIChlZmZpY2llbnQhISEpXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqKiBFdmVudCBCaW5kaW5ncyAqKiovXG4gICAgYmluZDogZnVuY3Rpb24oa2V5LCBjYWxsYmFjaykge1xuICAgICAgICB0aGlzLmJpbmRpbmdzW2tleV0gPSBjYWxsYmFjaztcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrO1xuICAgIH0sXG4gICAgdW5iaW5kOiBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuYmluZGluZ3Nba2V5XTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUgPT09IHVuZGVmaW5lZCA/IHRoaXMuZ2V0KGtleSkgOiB2YWx1ZTtcbiAgICAgICAgKHRoaXMuYmluZGluZ3Nba2V5XSB8fCBub29wKSh2YWx1ZSk7XG5cbiAgICAgICAgLy9UZWxsIGFsbCBvZiB0aGUgbGlzdGVuaW5nIGNoaWxkcmVuXG4gICAgICAgIHZhciAkY2hpbGRyZW4gPSB0aGlzLnZpZXcuJHdyYXBwZXIuZmluZCgnLicgKyB0aGlzLl9saXN0ZW5Dc3NQcmVmaXggKyB0aGlzLnZpZXcudHlwZSArICctJyArIGtleSksXG4gICAgICAgICAgICBpID0gJGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9ICRjaGlsZHJlbltpXVtzdWJ2aWV3Ll9kb21Qcm9wZXJ0eU5hbWVdO1xuICAgICAgICAgICAgY2hpbGQuc3RhdGUuX2hlYXIodGhpcy52aWV3LnR5cGUsIGtleSwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuXG4gICAgLyoqKiBDb21tdW5pY2F0b3J5IEdldC9TZXQvQmluZCAqKiovXG4gICAgLy9UaGVzZSBtZXRob2RzIGNvbW11bmljYXRlIHdpdGggdGhlIGNsb3Nlc3QgcGFyZW50IG9mIHRoZSBnaXZlbiB0eXBlXG4gICAgYXNrUGFyZW50OiBmdW5jdGlvbih0eXBlLCBrZXkpIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IHRoaXMudmlldy4kd3JhcHBlci5jbG9zZXN0KCcuJyt0aGlzLnZpZXcuX3ZpZXdDc3NQcmVmaXggKyB0eXBlKVswXTtcblxuICAgICAgICBpZihwYXJlbnQpICByZXR1cm4gcGFyZW50W3N1YnZpZXcuX2RvbVByb3BlcnR5TmFtZV0uc3RhdGUuZ2V0KGtleSk7XG4gICAgICAgIGVsc2UgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICB0ZWxsUGFyZW50OiBmdW5jdGlvbih0eXBlLCBrZXksIHZhbHVlKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnZpZXcuJHdyYXBwZXIuY2xvc2VzdCgnLicrdGhpcy52aWV3Ll92aWV3Q3NzUHJlZml4ICsgdHlwZSlbMF07XG5cbiAgICAgICAgaWYocGFyZW50KSBwYXJlbnRbc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lXS5zdGF0ZS5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgX2xpc3RlbkNzc1ByZWZpeDogXCJsaXN0ZW4tXCIsXG4gICAgbGlzdGVuOiBmdW5jdGlvbih0eXBlLCBrZXksIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciBjbGFzc2VzID0gdGhpcy52aWV3Ll9nZXRDbGFzc2VzKCk7XG4gICAgICAgIGNsYXNzZXMucHVzaCh0aGlzLl9saXN0ZW5Dc3NQcmVmaXgrdHlwZStcIi1cIitrZXkpO1xuICAgICAgICB0aGlzLnZpZXcuX3NldENsYXNzZXMoY2xhc3Nlcyk7XG5cbiAgICAgICAgdGhpcy5saXN0ZW5lcnNbdHlwZSArICctJyArIGtleV0gPSBjYWxsYmFjaztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBfaGVhcjogZnVuY3Rpb24odHlwZSwga2V5LCB2YWx1ZSkge1xuICAgICAgICAodGhpcy5saXN0ZW5lcnNbdHlwZSArICctJyArIGtleV0gfHwgbm9vcCkodmFsdWUpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG5cbiAgICAvKioqIFVwZGF0ZXMgU3RhdGUgRnJvbSBET00gQ2xhc3NlcyAqKiovXG4gICAgX3NldERlZmF1bHRzOiBmdW5jdGlvbihkZWZhdWx0cykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0cyAgID0gZGVmYXVsdHMgfHwgdGhpcy5kZWZhdWx0cztcbiAgICAgICAgdGhpcy5kYXRhICAgICAgID0ge307XG5cbiAgICAgICAgXy5lYWNoKFxuICAgICAgICAgICAgXy5leHRlbmQodGhpcy5kZWZhdWx0cywgdGhpcy5fZ2V0U3RhdGVDbGFzc2VzKCkpLFxuICAgICAgICAgICAgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICAgICAgICAgIHNlbGYuc2V0KGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKioqIFN0YXRlIENsYXNzIG1ldGhvZHMgKioqL1xuICAgIF9nZXRTdGF0ZUNsYXNzZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY2xhc3NlcyA9IHRoaXMudmlldy5fZ2V0Q2xhc3NlcygpLFxuICAgICAgICAgICAgaSA9IGNsYXNzZXMubGVuZ3RoLFxuICAgICAgICAgICAgZGF0YSA9IHt9O1xuXG4gICAgICAgIHdoaWxlKGktLSkge1xuICAgICAgICAgICAgdmFyIGMgPSBjbGFzc2VzW2ldO1xuXG4gICAgICAgICAgICBpZihjLm1hdGNoKHN0YXRlUmVnZXgpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhcnRzID0gYy5zcGxpdCgnLScpO1xuICAgICAgICAgICAgICAgIGlmKHBhcnRzLmxlbmd0aCA9PSAzKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGFbcGFydHNbMV1dID0gcGFydHNbMl07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZTtcblxuIiwidmFyIF8gICAgICAgICAgID0gcmVxdWlyZSgndW5kZXJzY29yZScpLFxuICAgIGxvZyAgICAgICAgID0gcmVxdWlyZSgnbG9nbGV2ZWwnKTtcblxudmFyIFZpZXcgPSBmdW5jdGlvbigpIHt9O1xuXG5WaWV3LnByb3RvdHlwZSA9IHtcbiAgICBpc1ZpZXc6IHRydWUsXG5cbiAgICAvKioqIERlZmF1bHQgQXR0cmlidXRlcyAoc2hvdWxkIGJlIG92ZXJ3cml0dGVuKSAqKiovXG4gICAgdGFnTmFtZTogICAgXCJkaXZcIixcbiAgICBjbGFzc05hbWU6ICBcIlwiLFxuICAgIHRlbXBsYXRlOiAgIFwiXCIsXG5cbiAgICAvL1N0YXRlIGRhdGEgZ2V0cyBtYXBwZWQgdG8gY2xhc3Nlc1xuICAgIHN0YXRlOiAgICAgIHt9LFxuXG4gICAgLy9EYXRhIGdvZXMgaW50byB0aGUgdGVtcGxhdGVzIGFuZCBtYXkgYWxzbyBiZSBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbiBvYmplY3RcbiAgICBkYXRhOiAgICAgICB7fSxcblxuICAgIC8vU3Vidmlld3MgYXJlIGEgc2V0IG9mIHN1YnZpZXdzIHRoYXQgd2lsbCBiZSBmZWQgaW50byB0aGUgdGVtcGxhdGluZyBlbmdpbmVcbiAgICBzdWJ2aWV3czogICB7fSxcblxuICAgIC8qKiogSW5pdGlhbGl6YXRpb24gRnVuY3Rpb25zIChzaG91bGQgYmUgY29uZmlndXJlZCBidXQgd2lsbCBiZSBtYW5pcHVsYXRlZCB3aGVuIGRlZmluaW5nIHRoZSBzdWJ2aWV3KSAqKiovXG4gICAgY29uZmlnOiBmdW5jdGlvbihjb25maWcpIHsgLy9SdW5zIGJlZm9yZSByZW5kZXJcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMgPSB7fTtcblxuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmNvbmZpZ0Z1bmN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jb25maWdGdW5jdGlvbnNbaV0uYXBwbHkodGhpcywgW2NvbmZpZ10pO1xuICAgICAgICB9XG4gICAgfSwgXG4gICAgY29uZmlnRnVuY3Rpb25zOiBbXSxcbiAgICBpbml0OiBmdW5jdGlvbihjb25maWcpIHsgLy9SdW5zIGFmdGVyIHJlbmRlclxuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmluaXRGdW5jdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdEZ1bmN0aW9uc1tpXS5hcHBseSh0aGlzLCBbY29uZmlnXSk7XG4gICAgICAgIH1cbiAgICB9LCBcbiAgICBpbml0RnVuY3Rpb25zOiBbXSxcbiAgICBjbGVhbjogZnVuY3Rpb24oKSB7IC8vUnVucyBvbiByZW1vdmVcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8dGhpcy5jbGVhbkZ1bmN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5jbGVhbkZ1bmN0aW9uc1tpXS5hcHBseSh0aGlzLCBbXSk7XG4gICAgICAgIH1cbiAgICB9LCBcbiAgICBjbGVhbkZ1bmN0aW9uczogW10sXG5cbiAgICAvKioqIFJlbmRlcmluZyAqKiovXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgaHRtbCA9ICcnLFxuICAgICAgICAgICAgcG9zdExvYWQgPSBmYWxzZTtcblxuICAgICAgICAvL05vIFRlbXBsYXRpbmcgRW5naW5lXG4gICAgICAgIGlmKHR5cGVvZiB0aGlzLnRlbXBsYXRlID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBodG1sID0gdGhpcy50ZW1wbGF0ZTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gXy5leHRlbmQodGhpcy5zdGF0ZS5kYXRhLCB0eXBlb2YgdGhpcy5kYXRhID09ICdmdW5jdGlvbicgPyB0aGlzLmRhdGEoKSA6IHRoaXMuZGF0YSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vRGVmaW5lIHRoZSBzdWJ2aWV3IHZhcmlhYmxlXG4gICAgICAgICAgICBkYXRhLnN1YnZpZXcgPSB7fTtcbiAgICAgICAgICAgICQuZWFjaCh0aGlzLnN1YnZpZXdzLCBmdW5jdGlvbihuYW1lLCBzdWJ2aWV3KSB7XG4gICAgICAgICAgICAgICAgaWYoc3Vidmlldy5pc1ZpZXdQb29sKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuc3Vidmlld1tuYW1lXSA9IHN1YnZpZXcudGVtcGxhdGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwb3N0TG9hZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuc3Vidmlld1tuYW1lXSA9IFwiPHNjcmlwdCBjbGFzcz0ncG9zdC1sb2FkLXZpZXcnIHR5cGU9J3RleHQvaHRtbCcgZGF0YS1uYW1lPSdcIituYW1lK1wiJz48L3NjcmlwdD5cIjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy9SdW4gdGhlIHRlbXBsYXRpbmcgZW5naW5lXG4gICAgICAgICAgICBpZihfLmlzRnVuY3Rpb24odGhpcy50ZW1wbGF0ZSkpIHtcbiAgICAgICAgICAgICAgICAvL0VKU1xuICAgICAgICAgICAgICAgIGlmKHR5cGVvZiB0aGlzLnRlbXBsYXRlLnJlbmRlciA9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIGh0bWwgPSB0aGlzLnRlbXBsYXRlLnJlbmRlcihkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy9IYW5kbGViYXJzICYgVW5kZXJzY29yZSAmIEphZGVcbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaHRtbCA9IHRoaXMudGVtcGxhdGUoZGF0YSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nLmVycm9yKFwiVGVtcGxhdGluZyBlbmdpbmUgbm90IHJlY29nbml6ZWQuXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5odG1sKGh0bWwpO1xuXG4gICAgICAgIC8vUG9zdCBMb2FkIFZpZXdzXG4gICAgICAgIGlmKHBvc3RMb2FkKSB7XG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmZpbmQoJy5wb3N0LWxvYWQtdmlldycpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcbiAgICAgICAgICAgICAgICAkdGhpc1xuICAgICAgICAgICAgICAgICAgICAuYWZ0ZXIoc2VsZi5zdWJ2aWV3c1skdGhpcy5hdHRyKCdkYXRhLW5hbWUnKV0uJHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgICAgIC5yZW1vdmUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBodG1sOiBmdW5jdGlvbihodG1sKSB7XG4gICAgICAgIC8vUmVtb3ZlICYgY2xlYW4gc3Vidmlld3MgaW4gdGhlIHdyYXBwZXIgXG4gICAgICAgIHRoaXMuJHdyYXBwZXIuZmluZCgnLnZpZXcnKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc3Vidmlldyh0aGlzKS5yZW1vdmUoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy53cmFwcGVyLmlubmVySFRNTCA9IGh0bWw7XG5cbiAgICAgICAgLy9Mb2FkIHN1YnZpZXdzIGluIHRoZSB3cmFwcGVyXG4gICAgICAgIHN1YnZpZXcubG9hZCh0aGlzLiR3cmFwcGVyKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIHJlbW92ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vRGV0YWNoXG4gICAgICAgIHZhciBwYXJlbnQgPSB0aGlzLndyYXBwZXIucGFyZW50Tm9kZTtcbiAgICAgICAgaWYocGFyZW50KSB7XG4gICAgICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy53cmFwcGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQ2xlYW5cbiAgICAgICAgdGhpcy5zdGF0ZS5zZXREZWZhdWx0cygpO1xuICAgICAgICB0aGlzLmNsZWFuKCk7XG5cbiAgICAgICAgdGhpcy5wb29sLl9yZWxlYXNlKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKioqIEV2ZW50IEFQSSAqKiovXG4gICAgdHJpZ2dlcjogZnVuY3Rpb24obmFtZSwgYXJncykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIGFyZ3MgPSBhcmdzIHx8IFtdO1xuICAgICAgICBcbiAgICAgICAgLy9Ccm9hZGNhc3QgaW4gYWxsIGRpcmVjdGlvbnNcbiAgICAgICAgdmFyIGRpcmVjdGlvbnMgPSB7XG4gICAgICAgICAgICB1cDogICAgICdmaW5kJyxcbiAgICAgICAgICAgIGRvd246ICAgJ3BhcmVudHMnLFxuICAgICAgICAgICAgYWNyb3NzOiAnc2libGluZ3MnXG4gICAgICAgIH07XG5cbiAgICAgICAgXy5maW5kKGRpcmVjdGlvbnMsIGZ1bmN0aW9uKGpxRnVuYywgZGlyKSB7XG4gICAgICAgICAgICB2YXIgc2VsZWN0b3IgPSAnLmxpc3RlbmVyLScrbmFtZSsnLScrZGlyO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvL1NlbGVjdCAkd3JhcHBlcnMgd2l0aCB0aGUgcmlnaHQgbGlzdGVuZXIgY2xhc3MgaW4gdGhlIHJpZ2h0IGRpcmVjdGlvblxuICAgICAgICAgICAgdmFyICRlbHMgPSBzZWxmLiR3cmFwcGVyW2pxRnVuY10oc2VsZWN0b3IgKyAnLCAnICsgc2VsZWN0b3IrJy0nK3NlbGYudHlwZSk7XG5cbiAgICAgICAgICAgIGZvcih2YXIgaT0wOyBpPCRlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvL0dldCB0aGUgYWN0dWFsIHN1YnZpZXdcbiAgICAgICAgICAgICAgICB2YXIgcmVjaXBpZW50ID0gc3VidmlldygkZWxzW2ldKTtcblxuICAgICAgICAgICAgICAgIC8vQ2hlY2sgZm9yIGEgc3VidmlldyB0eXBlIHNwZWNpZmljIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgdmFyIHR5cGVkQ2FsbGJhY2sgPSByZWNpcGllbnQubGlzdGVuZXJzW3NlbGYudHlwZSArIFwiOlwiICsgbmFtZSArIFwiOlwiICsgZGlyXTtcbiAgICAgICAgICAgICAgICBpZih0eXBlZENhbGxiYWNrICYmIHR5cGVkQ2FsbGJhY2suYXBwbHkoc2VsZiwgW2FyZ3NdKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vQnJlYWtzIGlmIGNhbGxiYWNrIHJldHVybnMgZmFsc2VcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL0NoZWNrIGZvciBhIGdlbmVyYWwgZXZlbnQgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICB2YXIgdW50eXBlZENhbGxiYWNrID0gcmVjaXBpZW50Lmxpc3RlbmVyc1tuYW1lICsgXCI6XCIgKyBkaXJdO1xuICAgICAgICAgICAgICAgIGlmKHVudHlwZWRDYWxsYmFjayAmJiB1bnR5cGVkQ2FsbGJhY2suYXBwbHkoc2VsZiwgW2FyZ3NdKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7IC8vQnJlYWtzIGlmIGNhbGxiYWNrIHJldHVybnMgZmFsc2VcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgbGlzdGVuOiBmdW5jdGlvbihldmVudCwgY2FsbGJhY2ssIGRpcmVjdGlvbikge1xuICAgICAgICAvL1BhcnNlIHRoZSBldmVudCBmb3JtYXQgXCJbdmlldyB0eXBlXTpbZXZlbnQgbmFtZV1cIlxuICAgICAgICBldmVudFBhcnRzID0gZXZlbnQuc3BsaXQoJzonKTtcbiAgICAgICAgXG4gICAgICAgIHZhciBldmVudE5hbWUgPSBldmVudFBhcnRzLmxlbmd0aCA+IDEgPyBldmVudFBhcnRzWzFdIDogZXZlbnRQYXJ0c1swXSxcbiAgICAgICAgICAgIHZpZXdUeXBlICA9IGV2ZW50UGFydHMubGVuZ3RoID4gMSA/IGV2ZW50UGFydHNbMF0gOiBudWxsO1xuXG4gICAgICAgIC8vQWRkIHRoZSBsaXN0ZW5lciBjbGFzc1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFkZENsYXNzKCdsaXN0ZW5lci0nK2V2ZW50TmFtZSsnLScrZGlyZWN0aW9uKyh2aWV3VHlwZSA/ICctJyt2aWV3VHlwZSA6ICcnKSk7XG5cbiAgICAgICAgLy9TYXZlIHRoZSBjYWxsYmFja1xuICAgICAgICB0aGlzLmxpc3RlbmVyc1tldmVudCtcIjpcIitkaXJlY3Rpb25dID0gY2FsbGJhY2s7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIGxpc3RlblVwOiBmdW5jdGlvbihldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmKHR5cGVvZiBldmVudCA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdGhpcy5saXN0ZW4oZXZlbnQsIGNhbGxiYWNrLCAndXAnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIF8uZWFjaChldmVudCwgZnVuY3Rpb24oY2FsbGJhY2ssIGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5saXN0ZW4oZXZlbnQsIGNhbGxiYWNrLCAndXAnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGxpc3RlbkRvd246IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgaWYodHlwZW9mIGV2ZW50ID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbihldmVudCwgY2FsbGJhY2ssICdkb3duJyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBfLmVhY2goZXZlbnQsIGZ1bmN0aW9uKGNhbGxiYWNrLCBldmVudCkge1xuICAgICAgICAgICAgICAgIHNlbGYubGlzdGVuKGV2ZW50LCBjYWxsYmFjaywgJ2Rvd24nKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBsaXN0ZW5BY3Jvc3M6IGZ1bmN0aW9uKGV2ZW50LCBjYWxsYmFjaykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgaWYodHlwZW9mIGV2ZW50ID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aGlzLmxpc3RlbihldmVudCwgY2FsbGJhY2ssICdhY3Jvc3MnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIF8uZWFjaChldmVudCwgZnVuY3Rpb24oY2FsbGJhY2ssIGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgc2VsZi5saXN0ZW4oZXZlbnQsIGNhbGxiYWNrLCAnYWNyb3NzJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKioqIFRyYXZlcnNpbmcgKioqL1xuICAgIHBhcmVudDogZnVuY3Rpb24odHlwZSkge1xuICAgICAgICB2YXIgJGVsID0gdGhpcy4kd3JhcHBlci5jbG9zZXN0KCcuJyArICh0eXBlID8gdGhpcy5fdmlld0Nzc1ByZWZpeCArIHR5cGUgOiAndmlldycpKTtcbiAgICAgICAgXG4gICAgICAgIGlmKCRlbCAmJiAkZWwubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuICRlbFswXVtzdWJ2aWV3Ll9kb21Qcm9wZXJ0eU5hbWVdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG5leHQ6IGZ1bmN0aW9uKHR5cGUpIHtcblxuICAgIH0sXG4gICAgcHJldjogZnVuY3Rpb24odHlwZSkge1xuXG4gICAgfSxcbiAgICBjaGlsZHJlbjogZnVuY3Rpb24odHlwZSkge1xuXG4gICAgfSxcblxuICAgIC8qKiogQ2xhc3NlcyAqKiovXG4gICAgX3ZpZXdDc3NQcmVmaXg6ICd2aWV3LScsXG4gICAgX2dldENsYXNzZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy53cmFwcGVyLmNsYXNzTmFtZS5zcGxpdCgvXFxzKy8pO1xuICAgIH0sXG4gICAgX3NldENsYXNzZXM6IGZ1bmN0aW9uKGNsYXNzZXMpIHtcbiAgICAgICAgdmFyIG5ld0NsYXNzTmFtZSA9IGNsYXNzZXMuam9pbignICcpO1xuICAgICAgICBpZih0aGlzLndyYXBwZXIuY2xhc3NOYW1lICE9IG5ld0NsYXNzTmFtZSkgdGhpcy53cmFwcGVyLmNsYXNzTmFtZSA9IG5ld0NsYXNzTmFtZTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIF9hZGREZWZhdWx0Q2xhc3NlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjbGFzc2VzID0gdGhpcy5fZ2V0Q2xhc3NlcygpO1xuICAgICAgICBjbGFzc2VzLnB1c2godGhpcy5fdmlld0Nzc1ByZWZpeCArIHRoaXMudHlwZSk7XG5cbiAgICAgICAgdmFyIHN1cGVyQ2xhc3MgPSB0aGlzLnN1cGVyO1xuICAgICAgICB3aGlsZSh0cnVlKSB7XG4gICAgICAgICAgICBpZihzdXBlckNsYXNzLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjbGFzc2VzLnB1c2godGhpcy5fdmlld0Nzc1ByZWZpeCArIHN1cGVyQ2xhc3MudHlwZSk7XG4gICAgICAgICAgICAgICAgc3VwZXJDbGFzcyA9IHN1cGVyQ2xhc3Muc3VwZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vQWRkIERlZmF1bHQgVmlldyBDbGFzc1xuICAgICAgICBjbGFzc2VzLnB1c2goJ3ZpZXcnKTtcblxuICAgICAgICAvL0FkZCBjbGFzc05hbWVcbiAgICAgICAgY2xhc3NlcyA9IGNsYXNzZXMuY29uY2F0KHRoaXMuY2xhc3NOYW1lLnNwbGl0KCcgJykpO1xuXG4gICAgICAgIHRoaXMuX3NldENsYXNzZXMoXy51bmlxKGNsYXNzZXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZpZXc7XG5cbiIsInZhciBTdGF0ZSA9IHJlcXVpcmUoXCIuL1N0YXRlXCIpLFxuICAgICQgICAgID0gcmVxdWlyZShcInVub3BpbmlvbmF0ZVwiKS5zZWxlY3RvcjtcblxudmFyIFZpZXdQb29sID0gZnVuY3Rpb24oVmlldykge1xuICAgIC8vQ29uZmlndXJhdGlvblxuICAgIHRoaXMuVmlldyAgID0gVmlldztcbiAgICB0aGlzLnR5cGUgICA9IFZpZXcucHJvdG90eXBlLnR5cGU7XG4gICAgdGhpcy5zdXBlciAgPSBWaWV3LnByb3RvdHlwZS5zdXBlcjtcbiAgICB0aGlzLnRlbXBsYXRlID0gXCI8XCIrdGhpcy5WaWV3LnByb3RvdHlwZS50YWdOYW1lK1wiIGNsYXNzPSdcIit0aGlzLlZpZXcucHJvdG90eXBlLl92aWV3Q3NzUHJlZml4ICsgdGhpcy5WaWV3LnByb3RvdHlwZS50eXBlK1wiIFwiK3RoaXMuVmlldy5wcm90b3R5cGUuY2xhc3NOYW1lK1wiJz48L1wiK3RoaXMuVmlldy5wcm90b3R5cGUudGFnTmFtZStcIj5cIjtcblxuICAgIC8vVmlldyBDb25maWd1cmF0aW9uXG4gICAgdGhpcy5WaWV3LnByb3RvdHlwZS5wb29sID0gdGhpcztcblxuICAgIC8vUG9vbFxuICAgIHRoaXMucG9vbCA9IFtdO1xufTtcblxuVmlld1Bvb2wucHJvdG90eXBlID0ge1xuICAgIGlzVmlld1Bvb2w6IHRydWUsXG4gICAgc3Bhd246IGZ1bmN0aW9uKGVsLCBjb25maWcpIHtcbiAgICAgICAgLy9qUXVlcnkgbm9ybWFsaXphdGlvblxuICAgICAgICB2YXIgJGVsID0gZWwgPyAoZWwuanF1ZXJ5ID8gZWwgOiAkKGVsKSk6IG51bGw7XG4gICAgICAgIGVsID0gZWwgJiYgZWwuanF1ZXJ5ID8gZWxbMF0gOiBlbDtcblxuICAgICAgICAvL0FyZ3VtZW50IHN1cmdlcnlcbiAgICAgICAgaWYoZWwgJiYgZWwudmlldykge1xuICAgICAgICAgICAgcmV0dXJuIGVsLnZpZXc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25maWcgPSBjb25maWcgfHwgKCQuaXNQbGFpbk9iamVjdChlbCkgPyBlbCA6IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vR2V0IHRoZSBET00gbm9kZVxuICAgICAgICAgICAgaWYoIWVsIHx8ICFlbC5ub2RlVHlwZSkge1xuICAgICAgICAgICAgICAgIGlmKHRoaXMucG9vbC5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucG9vbC5wb3AoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0aGlzLlZpZXcucHJvdG90eXBlLnRhZ05hbWUpO1xuICAgICAgICAgICAgICAgICAgICAkZWwgPSAkKGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciB2aWV3ID0gbmV3IHRoaXMuVmlldygpO1xuICAgICAgICAgICAgZWxbc3Vidmlldy5fZG9tUHJvcGVydHlOYW1lXSA9IHZpZXc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZpZXcud3JhcHBlciAgPSBlbDtcbiAgICAgICAgICAgIHZpZXcuJHdyYXBwZXIgPSAkZWw7XG4gICAgICAgICAgICB2aWV3Ll9hZGREZWZhdWx0Q2xhc3NlcygpO1xuXG4gICAgICAgICAgICAvL0FkZCB2aWV3IFN0YXRlXG4gICAgICAgICAgICB2aWV3LnN0YXRlID0gbmV3IFN0YXRlKHZpZXcsIHZpZXcuc3RhdGUpO1xuXG4gICAgICAgICAgICAvL1JlbmRlciAoZG9uJ3QgY2hhaW4gc2luY2UgaW50cm9kdWNlcyBvcHBvcnR1bml0eSBmb3IgdXNlciBlcnJvcilcbiAgICAgICAgICAgIHZpZXcuY29uZmlnKGNvbmZpZyk7IFxuICAgICAgICAgICAgdmlldy5yZW5kZXIoKTtcbiAgICAgICAgICAgIHZpZXcuaW5pdChjb25maWcpO1xuXG4gICAgICAgICAgICByZXR1cm4gdmlldztcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZXh0ZW5kOiBmdW5jdGlvbihuYW1lLCBjb25maWcpIHtcbiAgICAgICAgcmV0dXJuIHN1YnZpZXcobmFtZSwgdGhpcywgY29uZmlnKTtcbiAgICB9LFxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnBvb2wgPSBudWxsO1xuICAgICAgICBkZWxldGUgc3Vidmlldy52aWV3c1t0aGlzLnR5cGVdO1xuICAgIH0sXG5cbiAgICBfcmVsZWFzZTogZnVuY3Rpb24odmlldykge1xuICAgICAgICB0aGlzLnBvb2wucHVzaCh2aWV3KTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBWaWV3UG9vbDtcbiIsInZhciBfICAgICAgICAgICAgICAgPSByZXF1aXJlKFwidW5kZXJzY29yZVwiKSxcbiAgICBsb2cgICAgICAgICAgICAgPSByZXF1aXJlKFwibG9nbGV2ZWxcIiksXG4gICAgJCAgICAgICAgICAgICAgID0gcmVxdWlyZShcInVub3BpbmlvbmF0ZVwiKS5zZWxlY3RvcixcbiAgICBWaWV3UG9vbCAgICAgICAgPSByZXF1aXJlKFwiLi9WaWV3UG9vbFwiKSxcbiAgICBWaWV3VGVtcGxhdGUgICAgPSByZXF1aXJlKFwiLi9WaWV3XCIpLFxuICAgIHZpZXdUeXBlUmVnZXggICA9IG5ldyBSZWdFeHAoJ14nICsgVmlld1RlbXBsYXRlLnByb3RvdHlwZS5fdmlld0Nzc1ByZWZpeCk7XG5cbnZhciBzdWJ2aWV3ID0gZnVuY3Rpb24obmFtZSwgcHJvdG9WaWV3UG9vbCwgY29uZmlnKSB7XG4gICAgdmFyIFZpZXdQcm90b3R5cGU7XG5cbiAgICAvL1JldHVybiBWaWV3IG9iamVjdCBmcm9tIERPTSBlbGVtZW50XG4gICAgaWYobmFtZS5ub2RlVHlwZSB8fCBuYW1lLmpxdWVyeSkge1xuICAgICAgICByZXR1cm4gKG5hbWUuanF1ZXJ5ID8gbmFtZVswXSA6IG5hbWUpW3N1YnZpZXcuX2RvbVByb3BlcnR5TmFtZV0gfHwgbnVsbDtcbiAgICB9XG4gICAgLy9EZWZpbmUgYSBzdWJ2aWV3XG4gICAgZWxzZSB7XG4gICAgICAgIC8vQXJndW1lbnQgc3VyZ2VyeVxuICAgICAgICBpZihwcm90b1ZpZXdQb29sICYmIHByb3RvVmlld1Bvb2wuaXNWaWV3UG9vbCkge1xuICAgICAgICAgICAgVmlld1Byb3RvdHlwZSA9IHByb3RvVmlld1Bvb2wuVmlldztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbmZpZyAgICAgICAgICA9IHByb3RvVmlld1Bvb2w7XG4gICAgICAgICAgICBWaWV3UHJvdG90eXBlICAgPSBWaWV3VGVtcGxhdGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25maWcgPSBjb25maWcgfHwge307XG5cbiAgICAgICAgLy9WYWxpZGF0ZSBOYW1lXG4gICAgICAgIGlmKHN1YnZpZXcuX3ZhbGlkYXRlTmFtZShuYW1lKSkge1xuXG4gICAgICAgICAgICAvL0NyZWF0ZSB0aGUgbmV3IFZpZXdcbiAgICAgICAgICAgIHZhciBWaWV3ID0gZnVuY3Rpb24oKSB7fSxcbiAgICAgICAgICAgICAgICBzdXBlckNsYXNzID0gbmV3IFZpZXdQcm90b3R5cGUoKTtcblxuICAgICAgICAgICAgLy9FeHRlbmQgdGhlIGV4aXN0aW5nIGluaXQsIGNvbmZpZyAmIGNsZWFuIGZ1bmN0aW9ucyByYXRoZXIgdGhhbiBvdmVyd3JpdGluZyB0aGVtXG4gICAgICAgICAgICBfLmVhY2goWydpbml0JywgJ2NvbmZpZycsICdjbGVhbiddLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uZmlnW25hbWUrJ0Z1bmN0aW9ucyddID0gc3VwZXJDbGFzc1tuYW1lKydGdW5jdGlvbnMnXS5zbGljZSgwKTsgLy9DbG9uZSBzdXBlckNsYXNzIGluaXRcbiAgICAgICAgICAgICAgICBpZihjb25maWdbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnW25hbWUrJ0Z1bmN0aW9ucyddLnB1c2goY29uZmlnW25hbWVdKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGNvbmZpZ1tuYW1lXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUgICAgICAgPSBfLmV4dGVuZChzdXBlckNsYXNzLCBjb25maWcpO1xuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUudHlwZSAgPSBuYW1lO1xuICAgICAgICAgICAgVmlldy5wcm90b3R5cGUuc3VwZXIgPSBWaWV3UHJvdG90eXBlLnByb3RvdHlwZTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy9TYXZlIHRoZSBOZXcgVmlld1xuICAgICAgICAgICAgdmFyIHZpZXdQb29sID0gbmV3IFZpZXdQb29sKFZpZXcpO1xuICAgICAgICAgICAgc3Vidmlldy52aWV3c1tuYW1lXSA9IHZpZXdQb29sO1xuXG4gICAgICAgICAgICByZXR1cm4gdmlld1Bvb2w7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnN1YnZpZXcudmlld3MgPSB7fTtcblxuLy9PYnNjdXJlIERPTSBwcm9wZXJ0eSBuYW1lIGZvciBzdWJ2aWV3IHdyYXBwZXJzXG5zdWJ2aWV3Ll9kb21Qcm9wZXJ0eU5hbWUgPSBcInN1YnZpZXcxMjM0NVwiO1xuXG4vKioqIEFQSSAqKiovXG5zdWJ2aWV3LmxvYWQgPSBmdW5jdGlvbihzY29wZSkge1xuICAgIHZhciAkc2NvcGUgPSBzY29wZSA/ICQoc2NvcGUpIDogJCgnYm9keScpLFxuICAgICAgICAkdmlld3MgPSAkc2NvcGUuZmluZChcIltjbGFzc149J3ZpZXctJ11cIiksXG4gICAgICAgIGZpbmRlciA9IGZ1bmN0aW9uKGMpIHtcbiAgICAgICAgICAgIHJldHVybiBjLm1hdGNoKHZpZXdUeXBlUmVnZXgpO1xuICAgICAgICB9O1xuXG4gICAgZm9yKHZhciBpPTA7IGk8JHZpZXdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBlbCA9ICR2aWV3c1tpXSxcbiAgICAgICAgICAgIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoL1xccysvKTtcblxuICAgICAgICB0eXBlID0gIF8uZmluZChjbGFzc2VzLCBmaW5kZXIpLnJlcGxhY2Uodmlld1R5cGVSZWdleCwgJycpO1xuXG4gICAgICAgIGlmKHR5cGUgJiYgdGhpcy52aWV3c1t0eXBlXSkge1xuICAgICAgICAgICAgdGhpcy52aWV3c1t0eXBlXS5zcGF3bigkdmlld3NbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgbG9nLmVycm9yKFwic3VidmlldyAnXCIrdHlwZStcIicgaXMgbm90IGRlZmluZWQuXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG59O1xuXG5zdWJ2aWV3Lmxvb2t1cCA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZih0eXBlb2YgbmFtZSA9PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gdGhpcy52aWV3c1tuYW1lXTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmKG5hbWUuaXNWaWV3UG9vbCkge1xuICAgICAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihuYW1lLmlzVmlldykge1xuICAgICAgICAgICAgcmV0dXJuIG5hbWUucG9vbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zdWJ2aWV3Ll92YWxpZGF0ZU5hbWUgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgaWYoIW5hbWUubWF0Y2goL15bYS16QS1aMC05XFwtX10rJC8pKSB7XG4gICAgICAgIGxvZy5lcnJvcihcInN1YnZpZXcgbmFtZSAnXCIgKyBuYW1lICsgXCInIGlzIG5vdCBhbHBoYW51bWVyaWMuXCIpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYoc3Vidmlldy52aWV3c1tuYW1lXSkge1xuICAgICAgICBsb2cuZXJyb3IoXCJzdWJ2aWV3ICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkLlwiKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xufTtcblxuLyoqKiBFeHBvcnQgKioqL1xud2luZG93LnN1YnZpZXcgPSBtb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXc7XG5cbi8qKiogU3RhcnR1cCBBY3Rpb25zICoqKi9cbiQoZnVuY3Rpb24oKSB7XG4gICAgaWYoIXN1YnZpZXcubm9Jbml0KSB7XG4gICAgICAgIHN1YnZpZXcubG9hZCgpO1xuICAgIH1cbn0pO1xuXG4iLCJ2YXIgdGVtcGxhdGVyID0gcmVxdWlyZShcImhhbmRsZWJhcnMvcnVudGltZVwiKS5kZWZhdWx0LnRlbXBsYXRlO21vZHVsZS5leHBvcnRzID0gdGVtcGxhdGVyKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiO1xuXG5cbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLlRvb2xiYXIpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCJcXG5cIjtcbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmNvZGUpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICBidWZmZXIgKz0gXCJcXG5cIjtcbiAgc3RhY2sxID0gKChzdGFjazEgPSAoKHN0YWNrMSA9IChkZXB0aDAgJiYgZGVwdGgwLnN1YnZpZXcpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLlRyYXkpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICByZXR1cm4gYnVmZmVyO1xuICB9KTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKTtcbnJlcXVpcmUoJy4vRWRpdG9yLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdFZGl0b3InLCB7XG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoJy4vRWRpdG9yLmhhbmRsZWJhcnMnKSxcbiAgICBzdWJ2aWV3czoge1xuICAgICAgICBUb29sYmFyOiAgICByZXF1aXJlKCcuL1Rvb2xiYXIvVG9vbGJhcicpLFxuICAgICAgICBjb2RlOiAgICAgICByZXF1aXJlKCcuL2NvZGUnKSxcbiAgICAgICAgVHJheTogICAgICAgcmVxdWlyZSgnLi9UcmF5L1RyYXknKVxuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctVG9vbGJhcntwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6NTBweDt3aWR0aDoxMDAlfS52aWV3LUNvZGV7cG9zaXRpb246YWJzb2x1dGU7Ym90dG9tOjE1MHB4O3RvcDo1MHB4O3dpZHRoOjEwMCV9LnZpZXctVHJheXtwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTUwcHg7Ym90dG9tOjA7d2lkdGg6MTAwJX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciB0ZW1wbGF0ZXIgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpLmRlZmF1bHQudGVtcGxhdGU7bW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZXIoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIFxuXG5cbiAgcmV0dXJuIFwiPGJ1dHRvbiBjbGFzcz0nRWRpdG9yLVRvb2xiYXItb3Blbic+T3BlbjwvYnV0dG9uPlxcblxcbjxidXR0b24gY2xhc3M9J0VkaXRvci1Ub29sYmFyLXJ1bic+JiM5NjU4OzwvYnV0dG9uPlwiO1xuICB9KTsiLCJ2YXIgVG9vbGJhciAgPSByZXF1aXJlKCcuLi8uLi9VSS9Ub29sYmFyL1Rvb2xiYXInKSxcbiAgICBjbGljayAgICA9IHJlcXVpcmUoJ29uY2xpY2snKSxcbiAgICBjb2RlICAgICA9IHJlcXVpcmUoJy4uL2NvZGUnKSxcbiAgICB0ZXJtaW5hbCA9IHJlcXVpcmUoJy4uLy4uL1J1bi90ZXJtaW5hbCcpO1xuXG5yZXF1aXJlKCcuL1Rvb2xiYXIubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRvb2xiYXIuZXh0ZW5kKCdFZGl0b3ItVG9vbGJhcicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGNsaWNrKHtcbiAgICAgICAgICAgICcuRWRpdG9yLVRvb2xiYXItcnVuJzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdGVybWluYWwuY2xlYXIoKTtcblxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYudHJpZ2dlcigncnVuJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2RlLnJ1bigpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnLkVkaXRvci1Ub29sYmFyLW9wZW4nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnRyaWdnZXIoJ29wZW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9Ub29sYmFyLmhhbmRsZWJhcnMnKVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIuRWRpdG9yLVRvb2xiYXItcnVue2Zsb2F0OnJpZ2h0fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIHN0YWNrMSwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIiwgZXNjYXBlRXhwcmVzc2lvbj10aGlzLmVzY2FwZUV4cHJlc3Npb24sIHNlbGY9dGhpcztcblxuZnVuY3Rpb24gcHJvZ3JhbTEoZGVwdGgwLGRhdGEpIHtcbiAgXG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGhlbHBlcjtcbiAgYnVmZmVyICs9IFwiXFxuICAgIDxkaXYgY2xhc3M9J1RyYXktQnV0dG9uJyBkYXRhLXR5cGU9J1wiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy50eXBlKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLnR5cGUpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiJz5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMubmFtZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5uYW1lKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBpZihzdGFjazEgfHwgc3RhY2sxID09PSAwKSB7IGJ1ZmZlciArPSBzdGFjazE7IH1cbiAgYnVmZmVyICs9IFwiPC9kaXY+XFxuXCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH1cblxuICBzdGFjazEgPSBoZWxwZXJzLmVhY2guY2FsbChkZXB0aDAsIChkZXB0aDAgJiYgZGVwdGgwLmJ1dHRvbnMpLCB7aGFzaDp7fSxpbnZlcnNlOnNlbGYubm9vcCxmbjpzZWxmLnByb2dyYW0oMSwgcHJvZ3JhbTEsIGRhdGEpLGRhdGE6ZGF0YX0pO1xuICBpZihzdGFjazEgfHwgc3RhY2sxID09PSAwKSB7IHJldHVybiBzdGFjazE7IH1cbiAgZWxzZSB7IHJldHVybiAnJzsgfVxuICB9KTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKSxcbiAgICBidXR0b25zID0gcmVxdWlyZSgnLi4vLi4vVUkvQ29kZS9Ub2tlbnMvaW5kZXgnKSxcbiAgICBkcmFnICAgID0gcmVxdWlyZSgnb25kcmFnJyksXG4gICAgY2xpY2sgICA9IHJlcXVpcmUoJ29uY2xpY2snKSxcbiAgICBjdXJzb3IgID0gcmVxdWlyZSgnLi4vLi4vVUkvQ29kZS9jdXJzb3InKTtcblxucmVxdWlyZSgnLi9UcmF5Lmxlc3MnKTtcblxuLyoqKiBTZXR1cCBEcmFnZ2luZyAqKiovXG5cbmRyYWcoJy5UcmF5LUJ1dHRvbicsIHtcbiAgICBoZWxwZXI6IFwiY2xvbmVcIixcbiAgICBzdGFydDogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgbW92ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgc3RvcDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB0eXBlID0gdGhpcy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScpO1xuICAgIH1cbn0pO1xuXG5jbGljaygnLlRyYXktQnV0dG9uJywgZnVuY3Rpb24oZSkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBcbiAgICB2YXIgdHlwZSA9IHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXR5cGUnKTtcbiAgICBjdXJzb3IucGFzdGUodHlwZSk7XG59KTtcblxuLyoqKiBEZWZpbmUgdGhlIFN1YnZpZXcgKioqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ1RyYXknLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgIH0sXG4gICAgdGVtcGxhdGU6IHJlcXVpcmUoXCIuL1RyYXkuaGFuZGxlYmFyc1wiKSxcbiAgICBkYXRhOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGRhdGEgPSBbXTtcblxuICAgICAgICB2YXIgaSA9IGJ1dHRvbnMubGVuZ3RoO1xuICAgICAgICB3aGlsZShpLS0pIHtcbiAgICAgICAgICAgIHZhciBCdXR0b24gPSBidXR0b25zW2ldO1xuXG4gICAgICAgICAgICBkYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IEJ1dHRvbi5WaWV3LnByb3RvdHlwZS5tZXRhLmRpc3BsYXkgfHwgQnV0dG9uLlZpZXcucHJvdG90eXBlLnRlbXBsYXRlLFxuICAgICAgICAgICAgICAgIHR5cGU6IEJ1dHRvbi50eXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBidXR0b25zOiBkYXRhXG4gICAgICAgIH07XG4gICAgfVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctVHJheXtiYWNrZ3JvdW5kOiNGMUYwRjA7cGFkZGluZzo1cHg7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94fS5UcmF5LUJ1dHRvbntkaXNwbGF5OmlubGluZS1ibG9jaztwYWRkaW5nOjJweCA1cHg7bWFyZ2luOjJweCAwOy13ZWJraXQtYm9yZGVyLXJhZGl1czozcHg7LW1vei1ib3JkZXItcmFkaXVzOjNweDtib3JkZXItcmFkaXVzOjNweDtiYWNrZ3JvdW5kOiMxMDc1RjY7Y29sb3I6I2ZmZjtjdXJzb3I6cG9pbnRlcn1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBjb2RlID0gcmVxdWlyZSgnLi4vVUkvQ29kZS9Db2RlJykuc3Bhd24oKTtcblxuY29kZS5jb25maWd1cmUoe1xuICAgIHRlcm1pbmFsOiByZXF1aXJlKCcuLi9SdW4vdGVybWluYWwnKSxcbiAgICBvbkVycm9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdlZGl0Jyk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gY29kZTtcbiIsInZhciB0ZW1wbGF0ZXIgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpLmRlZmF1bHQudGVtcGxhdGU7bW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZXIoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBzdGFjazEsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCI7XG5cblxuICBzdGFjazEgPSAoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAmJiBkZXB0aDAuc3VidmlldykpLHN0YWNrMSA9PSBudWxsIHx8IHN0YWNrMSA9PT0gZmFsc2UgPyBzdGFjazEgOiBzdGFjazEuVG9vbGJhcikpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyByZXR1cm4gc3RhY2sxOyB9XG4gIGVsc2UgeyByZXR1cm4gJyc7IH1cbiAgfSk7IiwidmFyIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3Jyk7XG5cbnJlcXVpcmUoJy4vRmlsZXMubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ0ZpbGVzJywge1xuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL0ZpbGVzLmhhbmRsZWJhcnMnKSxcbiAgICBzdWJ2aWV3czoge1xuICAgICAgICBUb29sYmFyOiByZXF1aXJlKCcuL1Rvb2xiYXIvVG9vbGJhcicpXG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCJcIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciB0ZW1wbGF0ZXIgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpLmRlZmF1bHQudGVtcGxhdGU7bW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZXIoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIFxuXG5cbiAgcmV0dXJuIFwiPGJ1dHRvbiBjbGFzcz0nRmlsZXMtVG9vbGJhci1uZXcnPk5ldzwvYnV0dG9uPlxcblxcbjxidXR0b24gY2xhc3M9J0ZpbGVzLVRvb2xiYXItZGVsZXRlJz5EZWxldGU8L2J1dHRvbj5cIjtcbiAgfSk7IiwidmFyIFRvb2xiYXIgID0gcmVxdWlyZSgnLi4vLi4vVUkvVG9vbGJhci9Ub29sYmFyJyksXG4gICAgY2xpY2sgICAgPSByZXF1aXJlKCdvbmNsaWNrJyk7XG5cbnJlcXVpcmUoJy4vVG9vbGJhci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gVG9vbGJhci5leHRlbmQoJ0ZpbGVzLVRvb2xiYXInLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICBjbGljayh7XG4gICAgICAgICAgICAnLkZpbGVzLVRvb2xiYXItbmV3JzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdlZGl0Jyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJy5GaWxlcy1Ub29sYmFyLWRlbGV0ZSc6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL1Rvb2xiYXIuaGFuZGxlYmFycycpXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5GaWxlcy1Ub29sYmFyLWRlbGV0ZXtmbG9hdDpyaWdodH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciB0ZW1wbGF0ZXIgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpLmRlZmF1bHQudGVtcGxhdGU7bW9kdWxlLmV4cG9ydHMgPSB0ZW1wbGF0ZXIoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCI7XG5cblxuICBzdGFjazEgPSAoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAmJiBkZXB0aDAuc3VidmlldykpLHN0YWNrMSA9PSBudWxsIHx8IHN0YWNrMSA9PT0gZmFsc2UgPyBzdGFjazEgOiBzdGFjazEuVG9vbGJhcikpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKTtcbiAgaWYoc3RhY2sxIHx8IHN0YWNrMSA9PT0gMCkgeyBidWZmZXIgKz0gc3RhY2sxOyB9XG4gIGJ1ZmZlciArPSBcIlxcblwiO1xuICBzdGFjazEgPSAoKHN0YWNrMSA9ICgoc3RhY2sxID0gKGRlcHRoMCAmJiBkZXB0aDAuc3VidmlldykpLHN0YWNrMSA9PSBudWxsIHx8IHN0YWNrMSA9PT0gZmFsc2UgPyBzdGFjazEgOiBzdGFjazEudGVybWluYWwpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSk7XG4gIGlmKHN0YWNrMSB8fCBzdGFjazEgPT09IDApIHsgYnVmZmVyICs9IHN0YWNrMTsgfVxuICByZXR1cm4gYnVmZmVyO1xuICB9KTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKTtcblxucmVxdWlyZSgnLi9SdW4ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ1J1bicsIHtcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9SdW4uaGFuZGxlYmFycycpLFxuICAgIHN1YnZpZXdzOiB7XG4gICAgICAgIFRvb2xiYXI6ICByZXF1aXJlKCcuL1Rvb2xiYXIvVG9vbGJhcicpLFxuICAgICAgICB0ZXJtaW5hbDogcmVxdWlyZSgnLi90ZXJtaW5hbCcpXG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1SdW4tVGVybWluYWx7cG9zaXRpb246YWJzb2x1dGU7dG9wOjUwcHg7Ym90dG9tOjA7d2lkdGg6MTAwJX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGtleSAgICAgPSByZXF1aXJlKCdvbmtleScpO1xuXG5yZXF1aXJlKCcuL1Rlcm1pbmFsLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KFwiUnVuLVRlcm1pbmFsXCIsIHtcbiAgICBwcmludDogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKFwiPGRpdiBjbGFzcz0nVGVybWluYWwtbGluZSc+XCIrc3RyaW5nK1wiPC9kaXY+XCIpO1xuICAgIH0sXG4gICAgcHJvbXB0OiBmdW5jdGlvbihzdHJpbmcsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciAkaW5wdXQgPSAkKFwiPGlucHV0IHR5cGU9J3RleHQnIGNsYXNzPSdUZXJtaW5hbC1wcm9tcHQtaW5wdXQnIC8+XCIpO1xuXG4gICAgICAgICQoXCI8ZGl2IGNsYXNzPSdUZXJtaW5hbC1wcm9tcHQnPlwiK3N0cmluZytcIjogPC9kaXY+XCIpXG4gICAgICAgICAgICAuYXBwZW5kKCRpbnB1dClcbiAgICAgICAgICAgIC5hcHBlbmRUbyh0aGlzLiR3cmFwcGVyKTtcbiAgICAgICAgXG4gICAgICAgIGtleSgkaW5wdXQpLmRvd24oe1xuICAgICAgICAgICAgJ2VudGVyJzogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soJGlucHV0LnZhbCgpKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBjbGVhcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaHRtbCgnJyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn0pO1xuIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgXG5cblxuICByZXR1cm4gXCI8YnV0dG9uIGNsYXNzPSdSdW4tVG9vbGJhci1leGl0Jz5FeGl0PC9idXR0b24+XFxuXCI7XG4gIH0pOyIsInZhciBUb29sYmFyICA9IHJlcXVpcmUoJy4uLy4uL1VJL1Rvb2xiYXIvVG9vbGJhcicpLFxuICAgIGNsaWNrICAgID0gcmVxdWlyZSgnb25jbGljaycpO1xuXG5yZXF1aXJlKCcuL1Rvb2xiYXIubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRvb2xiYXIuZXh0ZW5kKCdSdW4tVG9vbGJhcicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGNsaWNrKHtcbiAgICAgICAgICAgICcuUnVuLVRvb2xiYXItZXhpdCc6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNlbGYudHJpZ2dlcignZWRpdCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHRlbXBsYXRlOiByZXF1aXJlKCcuL1Rvb2xiYXIuaGFuZGxlYmFycycpXG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9UZXJtaW5hbC9UZXJtaW5hbCcpLnNwYXduKCk7XG4iLCJ2YXIgQmxvY2sgPSByZXF1aXJlKCcuL0NvbXBvbmVudHMvQmxvY2snKTtcbnJlcXVpcmUoJy4vQ29kZS5sZXNzJyk7XG5cbnZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBCbG9jay5leHRlbmQoJ0NvZGUnLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZm9jdXMoKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyZTogZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIHRoaXMudGVybWluYWwgPSBjb25maWcudGVybWluYWwgfHwgbnVsbDtcbiAgICAgICAgdGhpcy5vbkVycm9yICA9IGNvbmZpZy5vbkVycm9yICB8fCBub29wO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGJlZm9yZVJ1bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnQuY2xlYXIoKTtcbiAgICB9LFxuXG4gICAgLyoqKiBFdmVudHMgKioqL1xuICAgIG9uRXJyb3I6IG5vb3Bcbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29kZXtvdmVyZmxvdzpoaWRkZW59XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgc3VidmlldyAgICAgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgY3Vyc29yICAgICAgPSByZXF1aXJlKCcuLi9jdXJzb3InKSxcbiAgICBMaW5lICAgICAgICA9IHJlcXVpcmUoJy4vTGluZScpLFxuICAgIEVudmlyb25tZW50ID0gcmVxdWlyZSgnLi9FbnZpcm9ubWVudE1vZGVsJyk7XG5cbnJlcXVpcmUoJy4vQmxvY2subGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ0NvZGUtQmxvY2snLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB0aGlzLmVudmlyb25tZW50ID0gbmV3IEVudmlyb25tZW50KCk7XG4gICAgICAgIHRoaXMuZW1wdHkoKTtcblxuICAgICAgICB0aGlzLmxpc3RlbkRvd24oJ0NvZGUtQ3Vyc29yOnBhc3RlJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgbGFzdCA9IHN1YnZpZXcoc2VsZi4kd3JhcHBlci5jaGlsZHJlbigpLmxhc3QoKSk7XG5cbiAgICAgICAgICAgIGlmKCFsYXN0LmlzRW1wdHkoKSkge1xuICAgICAgICAgICAgICAgIHNlbGYuYWRkTGluZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZW1wdHk6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmh0bWwoJycpO1xuICAgICAgICB0aGlzLmFkZExpbmUoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGFkZExpbmU6IGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgdmFyIGxpbmUgPSBMaW5lLnNwYXduKCk7XG4gICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKGxpbmUuJHdyYXBwZXIpO1xuICAgICAgICByZXR1cm4gbGluZTtcbiAgICB9LFxuICAgIGZvY3VzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgc3Vidmlldyh0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCkubGFzdCgpKS5mb2N1cygpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGJlZm9yZVJ1bjogZnVuY3Rpb24oKSB7fSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmJlZm9yZVJ1bigpO1xuXG4gICAgICAgIC8vUnVuIGV2ZXJ5IGxpbmVcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy4kd3JhcHBlci5jaGlsZHJlbigpO1xuICAgICAgICBmb3IodmFyIGk9MDsgaTxjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc3VidmlldyhjaGlsZHJlbltpXSkucnVuKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUNvZGUtQmxvY2t7YmFja2dyb3VuZDojZmZmOy13ZWJraXQtYm9yZGVyLXJhZGl1czoycHg7LW1vei1ib3JkZXItcmFkaXVzOjJweDtib3JkZXItcmFkaXVzOjJweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBFbnZpcm9ubWVudCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY2xlYXIoKTtcbn07XG5cbkVudmlyb25tZW50LnByb3RvdHlwZSA9IHtcbiAgICBjbGVhcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudmFycyA9IHt9O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgICAgICB0aGlzLnZhcnNbbmFtZV0gPSB2YWx1ZTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy52YXJzW25hbWVdO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW52aXJvbm1lbnQ7IiwidmFyIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgY3Vyc29yICA9IHJlcXVpcmUoJy4uL2N1cnNvcicpO1xuXG5yZXF1aXJlKCcuL0ZpZWxkLmxlc3MnKTtcblxuJChkb2N1bWVudCkub24oJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgJy52aWV3LUNvZGUtRmllbGQnLCBmdW5jdGlvbihlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBzdWJ2aWV3KHRoaXMpLmZvY3VzKCk7XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBzdWJ2aWV3KCdDb2RlLUZpZWxkJywge1xuICAgIGR1bXA6IGZ1bmN0aW9uKCkge1xuXG4gICAgfSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIGN1cnNvci5hcHBlbmRUbyh0aGlzLiR3cmFwcGVyKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RhY2sgPSBbXSxcbiAgICAgICAgICAgIHRva2VuO1xuXG4gICAgICAgIC8vR2V0IFRva2Vuc1xuICAgICAgICB2YXIgdG9rZW5zID0gdGhpcy4kd3JhcHBlci5jaGlsZHJlbigpO1xuXG4gICAgICAgIC8vSWdub3JlIEVtcHR5IExpbmVzXG4gICAgICAgIGlmKHRva2Vucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQnVpbGQgU3RhY2tcbiAgICAgICAgZm9yKHZhciBpPTA7IGk8dG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHN1YnZpZXcodG9rZW5zW2ldKTtcblxuICAgICAgICAgICAgaWYodG9rZW4uaXNPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0b2tlbi5pc0xpdGVyYWwpIHtcbiAgICAgICAgICAgICAgICBzdGFjay5wdXNoKHRva2VuLnZhbCgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYodG9rZW4uaXNUb2tlbikge1xuICAgICAgICAgICAgICAgIHN0YWNrLnB1c2godG9rZW4ucnVuKCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZih0b2tlbi50eXBlICE9ICdDb2RlLUN1cnNvcicpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiVG9rZW4gbm90IHJlY29nbml6ZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvL1JlZHVjZSBvcGVyYXRvcnNcbiAgICAgICAgdmFyIG1heFByZWNlZGVuY2UgPSA1ICsgMTtcbiAgICAgICAgd2hpbGUobWF4UHJlY2VkZW5jZS0tICYmIHN0YWNrLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGZvcihpPTA7IGk8c3RhY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IHN0YWNrW2ldO1xuXG4gICAgICAgICAgICAgICAgLy9OdWxsIHRva2VucyBzaG91bGQgYmUgZGlzY2FyZGVkXG4gICAgICAgICAgICAgICAgLy9UaGV5IGFyZSByZXR1cm5lZCB3aGVuIGEgc3RhdGVtZW50IGNhbmNlbHMgaXRzIHNlbGYgb3V0IGxpa2UgTk9UIE5PVCBvciAtLTRcbiAgICAgICAgICAgICAgICBpZih0b2tlbiAmJiB0b2tlbi5pc051bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhY2suc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICBpLS07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYodG9rZW4gJiYgdG9rZW4uaXNPcGVyYXRvciAmJiAodHlwZW9mIHRva2VuLnByZWNlZGVuY2UgPT0gJ2Z1bmN0aW9uJyA/IHRva2VuLnByZWNlZGVuY2Uoc3RhY2ssIGkpIDogdG9rZW4ucHJlY2VkZW5jZSkgPT0gbWF4UHJlY2VkZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAvL09wZXJhdG9ycyBsaWtlIE5PVCB0aGF0IG9ubHkgb3BlcmF0ZSBvbiB0aGUgdG9rZW4gYWZ0ZXJcbiAgICAgICAgICAgICAgICAgICAgaWYodG9rZW4uaXNTaW5nbGVPcGVyYXRvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RhY2suc3BsaWNlKGksIDIsIHRva2VuLnJ1bihzdGFja1tpICsgMV0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGktLTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvL1N0YW5kYXJkIG9wZXJhdG9ycyB0aGF0IG9wZXJhdGUgb24gdG9rZW4gYmVmb3JlIGFuZCBhZnRlclxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBwcmV2ID0gc3RhY2tbaSAtIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHQgPSBzdGFja1tpICsgMV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2tlbi5lcnJvcignTm8gbGVmdC1zaWRlIGZvciAnICsgdG9rZW4udGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVsc2UgaWYoaSA9PSBzdGFjay5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9rZW4uZXJyb3IoJ05vIHJpZ2h0LXNpZGUgZm9yICcgKyB0b2tlbi50ZW1wbGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZihwcmV2LmlzT3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2tlbi5lcnJvcignSW52YWxpZCByaWdodC1zaWRlIGZvciAnICsgdG9rZW4udGVtcGxhdGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSBpZihuZXh0LmlzT3BlcmF0b3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b2tlbi5lcnJvcignSW52YWxpZCBsZWZ0LXNpZGUgZm9yICcgKyB0b2tlbi50ZW1wbGF0ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGFjay5zcGxpY2UoaSAtIDEsIDMsIHRva2VuLnJ1bihwcmV2LCBuZXh0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaS0tO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9UaGUgc3RhY2sgc2hvdWxkIHJlZHVjZSB0byBleGFjdGx5IG9uZSBsaXRlcmFsXG4gICAgICAgIGlmKHN0YWNrLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgICAgdGhpcy5lcnJvcihcIlN5bnRheCBFcnJvclwiKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzdGFja1swXTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZXJyb3I6IHJlcXVpcmUoJy4vZXJyb3InKVxufSk7XG4iLCJ2YXIgRmllbGQgPSByZXF1aXJlKCcuL0ZpZWxkJyk7XG5cbnJlcXVpcmUoJy4vTGluZS5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmllbGQuZXh0ZW5kKCdDb2RlLUxpbmUnLCB7XG4gICAgaXNFbXB0eTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiR3cmFwcGVyLmNoaWxkcmVuKCcudmlldy1Db2RlLVRva2VuJykubGVuZ3RoID09PSAwO1xuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29kZXtjb3VudGVyLXJlc2V0OmxpbmVOdW1iZXJ9LnZpZXctQ29kZS1MaW5le3Bvc2l0aW9uOnJlbGF0aXZlO21pbi1oZWlnaHQ6MS4yZW07cGFkZGluZy1sZWZ0OjMwcHg7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94fS52aWV3LUNvZGUtTGluZTpiZWZvcmV7Zm9udC1mYW1pbHk6Q29uc29sYXMsbW9uYWNvLG1vbm9zcGFjZTtjb3VudGVyLWluY3JlbWVudDpsaW5lTnVtYmVyO2NvbnRlbnQ6Y291bnRlcihsaW5lTnVtYmVyKTtwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6MTAwJTt3aWR0aDozNHB4O2xlZnQ6LTRweDtwYWRkaW5nLWxlZnQ6OHB4O3BhZGRpbmctdG9wOi4xZW07YmFja2dyb3VuZDojRjFGMEYwO2JvcmRlci1yaWdodDoxcHggc29saWQgI0NDQztjb2xvcjojNTU1Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBUb29sdGlwID0gcmVxdWlyZSgnLi4vLi4vVG9vbHRpcC9Ub29sdGlwJyksXG4gICAgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKTtcblxucmVxdWlyZShcIi4vZXJyb3IubGVzc1wiKTtcblxudmFyIEVyciA9IFRvb2x0aXAuZXh0ZW5kKCdDb2RlLUVycm9yJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obXNnKSB7XG4gICAgdGhpcy5wYXJlbnQoJ0NvZGUnKS5vbkVycm9yKCk7XG5cbiAgICByZXR1cm4gRXJyLnNwYXduKHtcbiAgICAgICAgbXNnOiAgbXNnLFxuICAgICAgICAkZWw6ICB0aGlzLiR3cmFwcGVyXG4gICAgfSk7XG59O1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29kZS1FcnJvcntiYWNrZ3JvdW5kOiNGNzAwMDA7Y29sb3I6I2ZmZjstd2Via2l0LWJvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm9yZGVyLXJhZGl1czozcHg7Ym9yZGVyLXJhZGl1czozcHg7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmJvcmRlci1ib3g7Ym94LXNpemluZzpib3JkZXItYm94O3BhZGRpbmc6MnB4IDZweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBGaWVsZCA9IHJlcXVpcmUoJy4uL0NvbXBvbmVudHMvRmllbGQnKTtcbnJlcXVpcmUoJy4vQXJndW1lbnQubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZpZWxkLmV4dGVuZCgnQXJndW1lbnQnLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oY29uZmlnKSB7XG4gICAgICAgIGNvbmZpZyA9IGNvbmZpZyB8fCB7fTtcbiAgICAgICAgXG4gICAgICAgIHRoaXMubmFtZSA9IGNvbmZpZy5uYW1lIHx8IFwiXCI7XG4gICAgICAgIHRoaXMudHlwZSA9IGNvbmZpZy50eXBlIHx8IG51bGw7XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogXCJcXHUyMDBCXCIsXG4gICAgdGFnTmFtZTogJ3NwYW4nXG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUFyZ3VtZW50e2JhY2tncm91bmQ6I2ZmZjttaW4td2lkdGg6MTVweDttaW4taGVpZ2h0OjEuMmVtO21hcmdpbjowIDJweDtwYWRkaW5nOi4xZW0gMnB4Oy13ZWJraXQtYm9yZGVyLXJhZGl1czoycHg7LW1vei1ib3JkZXItcmFkaXVzOjJweDtib3JkZXItcmFkaXVzOjJweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBUb2tlbiAgICAgICA9IHJlcXVpcmUoJy4uL1Rva2VuJyksXG4gICAgQXJndW1lbnQgICAgPSByZXF1aXJlKCcuLi9Bcmd1bWVudCcpO1xuXG5yZXF1aXJlKCcuL0Fzc2lnbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gVG9rZW4uZXh0ZW5kKCdDb2RlLUFzc2lnbicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kbmFtZSA9ICQoXCI8aW5wdXQgdHlwZT0ndGV4dCcgLz5cIik7XG4gICAgICAgIHRoaXMudmFsdWUgPSBBcmd1bWVudC5zcGF3bigpO1xuXG4gICAgICAgIHRoaXMuJHdyYXBwZXJcbiAgICAgICAgICAgIC5hcHBlbmQodGhpcy4kbmFtZSlcbiAgICAgICAgICAgIC5hcHBlbmQoJyA9ICcpXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMudmFsdWUuJHdyYXBwZXIpO1xuICAgIH0sXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiBcIkFzc2lnblwiXG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWUgPSB0aGlzLnZhbHVlLnJ1bigpO1xuICAgICAgICBjb25zb2xlLmxvZyh2YWx1ZSk7XG4gICAgICAgIHRoaXMucGFyZW50KCdDb2RlLUJsb2NrJykuZW52aXJvbm1lbnQuc2V0KHRoaXMuJG5hbWUudmFsKCksIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRuYW1lLmZvY3VzKCk7XG4gICAgfVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29kZS1Bc3NpZ257YmFja2dyb3VuZDojODdGMDhCO2Rpc3BsYXk6aW5saW5lLWJsb2NrO3BhZGRpbmc6MnB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIENvbnRyb2wgID0gcmVxdWlyZSgnLi4vQ29udHJvbCcpLFxuICAgIEFyZ3VtZW50ID0gcmVxdWlyZSgnLi4vLi4vQXJndW1lbnQnKSxcbiAgICBCbG9jayAgICA9IHJlcXVpcmUoJy4uLy4uLy4uL0NvbXBvbmVudHMvQmxvY2snKTtcblxucmVxdWlyZSgnLi9Db25kaXRpb25hbC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29udHJvbC5leHRlbmQoJ0NvbmRpdGlvbmFsJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvL0RlZmluZSBzdGF0ZSB2YXJpYWJsZXNcbiAgICAgICAgdGhpcy5jb25kaXRpb25zID0gW107XG4gICAgICAgIHRoaXMuZWxzZUNvbmRpdGlvbiA9IG51bGw7XG5cbiAgICAgICAgLy9BZGQgaW5pdGlhbCBjb25kaXRpb25hbFxuICAgICAgICB0aGlzLmFkZENvbmRpdGlvbignaWYnKTtcbiAgICB9LFxuICAgIG1ldGE6IHtcbiAgICAgICAgZGlzcGxheTogJ2lmJ1xuICAgIH0sXG4gICAgYWRkQ29uZGl0aW9uOiBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgIHZhciBjb25kaXRpb24gPSB7XG4gICAgICAgICAgICBibG9jazogQmxvY2suc3Bhd24oKVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vQnVpbGQgQ29uZGl0aW9uXG4gICAgICAgIGlmKHR5cGUgPT0gXCJlbHNlXCIpIHtcbiAgICAgICAgICAgIHRoaXMuZWxzZUNvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbmRpdGlvbi5hcmcgPSBBcmd1bWVudC5zcGF3bih7XG4gICAgICAgICAgICAgICAgdHlwZTogXCJDb25kaXRpb25hbFwiXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5jb25kaXRpb25zLnB1c2goY29uZGl0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy9BcHBlbmQgdG8gV3JhcHBlclxuICAgICAgICB2YXIgJGNvbmRpdGlvbiA9ICQoXCI8ZGl2IGNsYXNzPSdjb25kaXRpb25hbC1ibG9jayc+PC9kaXY+XCIpO1xuXG4gICAgICAgICRjb25kaXRpb24uYXBwZW5kKFxuICAgICAgICAgICAgdHlwZSA9PSBcImVsc2VcIiA/IFwiZWxzZTpcIiA6XG4gICAgICAgICAgICB0eXBlID09IFwiZWxzZSBpZlwiID8gXCJlbHNlIGlmIFwiIDpcbiAgICAgICAgICAgIHR5cGUgPT0gXCJpZlwiID8gXCJpZiBcIiA6IFwiXCJcbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIGlmKHR5cGUgIT0gXCJlbHNlXCIpIHtcbiAgICAgICAgICAgICRjb25kaXRpb25cbiAgICAgICAgICAgICAgICAuYXBwZW5kKGNvbmRpdGlvbi5hcmcuJHdyYXBwZXIpXG4gICAgICAgICAgICAgICAgLmFwcGVuZChcIiB0aGVuOlwiKTtcbiAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICRjb25kaXRpb24uYXBwZW5kKGNvbmRpdGlvbi5ibG9jay4kd3JhcHBlcik7XG5cbiAgICAgICAgdGhpcy4kd3JhcHBlci5hcHBlbmQoJGNvbmRpdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLmNvbmRpdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBjb25kaXRpb24gPSB0aGlzLmNvbmRpdGlvbnNbaV07XG5cbiAgICAgICAgICAgIGlmKGNvbmRpdGlvbi5hcmcucnVuKCkpIHtcbiAgICAgICAgICAgICAgICBjb25kaXRpb24uYmxvY2sucnVuKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYodGhpcy5lbHNlQ29uZGl0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmVsc2VDb25kaXRpb24uYmxvY2sucnVuKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgfSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uc1swXS5hcmcuZm9jdXMoKTtcbiAgICB9XG59KTtcbiIsInJlcXVpcmUoJy4vQ29udHJvbC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi4vVG9rZW4nKS5leHRlbmQoJ0NvbnRyb2wnLCB7XG4gICAgaXNDb250cm9sOiB0cnVlLFxuICAgIFxuICAgIC8qKiogU2hvdWxkIEJlIE92ZXJ3cml0dGVuICoqKi9cbiAgICBydW46ICAgIGZ1bmN0aW9uKCkge30sXG4gICAgZm9jdXM6ICBmdW5jdGlvbigpIHt9LFxuXG4gICAgLyoqKiBGdW5jdGlvbnMgKioqL1xuICAgIHZhbGlkYXRlUG9zaXRpb246IGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICBpZihzdWJ2aWV3KGN1cnNvci4kd3JhcHBlci5wYXJlbnQoKSkudHlwZSA9PSAnQ29kZS1MaW5lJykge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjdXJzb3IuZXJyb3IodGhpcy50eXBlICsgJyBtdXN0IGdvIG9uIGl0cyBvd24gbGluZS4nKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29udHJvbHtiYWNrZ3JvdW5kOm9yYW5nZTtwYWRkaW5nOjJweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBDb250cm9sICA9IHJlcXVpcmUoJy4uL0NvbnRyb2wnKSxcbiAgICBBcmd1bWVudCA9IHJlcXVpcmUoJy4uLy4uL0FyZ3VtZW50JyksXG4gICAgQmxvY2sgICAgPSByZXF1aXJlKCcuLi8uLi8uLi9Db21wb25lbnRzL0Jsb2NrJyk7XG5cbnJlcXVpcmUoJy4vV2hpbGUubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnRyb2wuZXh0ZW5kKCdDb2RlLVdoaWxlJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmNvbmRpdGlvbiA9IEFyZ3VtZW50LnNwYXduKHtcbiAgICAgICAgICAgIHR5cGU6IFwiQ29uZGl0aW9uXCJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5ibG9jayA9IEJsb2NrLnNwYXduKCk7XG5cbiAgICAgICAgLy9CdWlsZCB0aGUgV3JhcHBlclxuICAgICAgICB0aGlzLiR3cmFwcGVyXG4gICAgICAgICAgICAuYXBwZW5kKFwid2hpbGUgXCIpXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMuY29uZGl0aW9uLiR3cmFwcGVyKVxuICAgICAgICAgICAgLmFwcGVuZCgnOicpXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMuYmxvY2suJHdyYXBwZXIpO1xuICAgIH0sXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnd2hpbGUnXG4gICAgfSxcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB3aGlsZSh0aGlzLmNvbmRpdGlvbi5ydW4oKSkge1xuICAgICAgICAgICAgdGhpcy5ibG9jay5ydW4oKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmNvbmRpdGlvbi5mb2N1cygpO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZShcIi4vQ29uZGl0aW9uYWwvQ29uZGl0aW9uYWxcIiksXG4gICAgcmVxdWlyZShcIi4vTG9vcC9XaGlsZVwiKVxuXTsiLCJ2YXIgQXJndW1lbnQgPSByZXF1aXJlKCcuLi9Bcmd1bWVudCcpLFxuICAgIGN1cnNvciAgID0gcmVxdWlyZSgnLi4vLi4vY3Vyc29yJyk7XG5cbnJlcXVpcmUoJy4vRnVuY3Rpb24ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4uL1Rva2VuJykuZXh0ZW5kKCdGdW5jdGlvbicsIHtcbiAgICBpc0Z1bmN0aW9uOiB0cnVlLFxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZCh0aGlzLm5hbWUrXCIoXCIpO1xuXG4gICAgICAgIHRoaXMuYXJndW1lbnRJbnN0YW5jZXMgPSBbXTtcblxuICAgICAgICAvL1BhcnNlIEFyZ3VtZW50c1xuICAgICAgICB2YXIgaSA9IHRoaXMuYXJndW1lbnRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUoaS0tKSB7XG4gICAgICAgICAgICB2YXIgYXJnID0gQXJndW1lbnQuc3Bhd24odGhpcy5hcmd1bWVudHNbaV0pO1xuICAgICAgICAgICAgdGhpcy5hcmd1bWVudEluc3RhbmNlcy5wdXNoKGFyZyk7XG5cbiAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKGFyZy4kd3JhcHBlcik7XG4gICAgICAgICAgICBpZihpID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKFwiLCBcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHRoaXMuJHdyYXBwZXIuYXBwZW5kKFwiKVwiKTtcbiAgICB9LFxuXG4gICAgLyoqKiBTaG91bGQgQmUgT3ZlcndyaXR0ZW4gKioqL1xuICAgIG5hbWU6ICcnLFxuICAgIC8vUnVucyB3aGVuIHRoZSBmdW5jdGlvbiBpcyBjYWxsZWRcbiAgICBydW46IGZ1bmN0aW9uKCkge1xuICAgICAgICBcbiAgICB9LFxuICAgIGFyZ3VtZW50OiBmdW5jdGlvbihpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmFyZ3VtZW50SW5zdGFuY2VzW2ldLnJ1bigpO1xuICAgIH0sXG4gICAgYXJndW1lbnRzOiBbXSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmKHRoaXMuYXJndW1lbnRJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5hcmd1bWVudEluc3RhbmNlc1swXS5mb2N1cygpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5hZnRlcihjdXJzb3IpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1GdW5jdGlvbntkaXNwbGF5OmlubGluZS1ibG9jazstd2Via2l0LWJvcmRlci1yYWRpdXM6M3B4Oy1tb3otYm9yZGVyLXJhZGl1czozcHg7Ym9yZGVyLXJhZGl1czozcHg7YmFja2dyb3VuZDojMTA3NUY2O21hcmdpbjoycHg7cGFkZGluZzozcHggNXB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIEZ1bmMgPSByZXF1aXJlKCcuLi9GdW5jdGlvbicpO1xuXG5yZXF1aXJlKCcuL1BhcmVudGhlc2VzLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBGdW5jLmV4dGVuZCgnUGFyZW50aGVzZXMnLCB7XG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnKCApJ1xuICAgIH0sXG4gICAgcnVuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXJndW1lbnQoMCk7XG4gICAgfSxcbiAgICBhcmd1bWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogXCJFeHByZXNzaW9uXCJcbiAgICAgICAgfVxuICAgIF1cbn0pOyIsInZhciBGdW5jID0gcmVxdWlyZSgnLi4vRnVuY3Rpb24nKTtcblxucmVxdWlyZSgnLi9QcmludC5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gRnVuYy5leHRlbmQoJ3ByaW50Jywge1xuICAgIHJ1bjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB0ZXJtaW5hbCA9IHRoaXMuZWRpdG9yKCkudGVybWluYWw7XG4gICAgICAgIFxuICAgICAgICBpZih0ZXJtaW5hbCkge1xuICAgICAgICAgICAgdGVybWluYWwucHJpbnQodGhpcy5hcmd1bWVudCgwKSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGFyZ3VtZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiBcIlN0cmluZ1wiLFxuICAgICAgICAgICAgbmFtZTogXCJNZXNzYWdlXCJcbiAgICAgICAgfVxuICAgIF0sXG4gICAgbmFtZTogJ3ByaW50JyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICdwcmludCggKSdcbiAgICB9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LVBhcmVudGhlc2Vze2NvbG9yOiM3NDc0NzQ7YmFja2dyb3VuZDojRkZGOUI2fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZSgnLi9QcmludC9QcmludCcpLFxuICAgIHJlcXVpcmUoJy4vUGFyZW50aGVzZXMvUGFyZW50aGVzZXMnKVxuXTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LWZhbHNlLC52aWV3LXRydWV7Y29sb3I6I2ZmZjtiYWNrZ3JvdW5kOiNEMzJDRDN9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgTGl0ZXJhbCA9IHJlcXVpcmUoJy4uL0xpdGVyYWwnKTtcbnJlcXVpcmUoJy4vQm9vbGVhbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ2ZhbHNlJywge1xuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICdmYWxzZSdcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcImZhbHNlXCIsXG4gICAgdmFsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5yZXF1aXJlKCcuL0Jvb2xlYW4ubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVyYWwuZXh0ZW5kKCd0cnVlJywge1xuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICd0cnVlJ1xuICAgIH0sXG4gICAgdGVtcGxhdGU6IFwidHJ1ZVwiLFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbn0pO1xuIiwicmVxdWlyZSgnLi9MaXRlcmFsLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9Ub2tlbicpLmV4dGVuZCgnTGl0ZXJhbCcsIHtcbiAgICBpc0xpdGVyYWw6IHRydWUsXG4gICAgdmFsOiBmdW5jdGlvbigpIHt9XG59KTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUxpdGVyYWx7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjJweDstbW96LWJvcmRlci1yYWRpdXM6MnB4O2JvcmRlci1yYWRpdXM6MnB4O3BhZGRpbmc6MCA0cHg7bWFyZ2luOjAgMXB4O2Rpc3BsYXk6aW5saW5lLWJsb2NrfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIExpdGVyYWwgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyk7XG5yZXF1aXJlKCcuL051bWJlci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ051bWJlcicsIHtcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kaW5wdXQgPSB0aGlzLiR3cmFwcGVyLmZpbmQoJy5udW1iZXItaW5wdXQnKTtcbiAgICB9LFxuICAgIHRhZ05hbWU6ICdzcGFuJyxcbiAgICBtZXRhOiB7XG4gICAgICAgIGRpc3BsYXk6ICcxMjMnXG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogXCI8aW5wdXQgdHlwZT0nbnVtYmVyJyBjbGFzcz0nbnVtYmVyLWlucHV0Jy8+XCIsXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5mb2N1cygpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5odG1sKCcnKTtcbiAgICB9LFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwYXJzZUZsb2F0KHRoaXMuJGlucHV0LnZhbCgpKTtcbiAgICB9XG59KTtcbiIsInZhciBMaXRlcmFsID0gcmVxdWlyZSgnLi4vTGl0ZXJhbCcpO1xucmVxdWlyZSgnLi9TdHJpbmcubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpdGVyYWwuZXh0ZW5kKCdTdHJpbmcnLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJGlucHV0ID0gdGhpcy4kd3JhcHBlci5maW5kKCcuc3RyaW5nLWlucHV0Jyk7XG4gICAgfSxcbiAgICB0YWdOYW1lOiAnc3BhbicsXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiAnXCJhYmNcIidcbiAgICB9LFxuICAgIHRlbXBsYXRlOiBcIiZsZHF1bzs8c3BhbiBjb250ZW50ZWRpdGFibGU9J3RydWUnIGNsYXNzPSdzdHJpbmctaW5wdXQnPjwvc3Bhbj4mcmRxdW87XCIsXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5mb2N1cygpO1xuICAgIH0sXG4gICAgY2xlYW46IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRpbnB1dC5odG1sKCcnKTtcbiAgICB9LFxuICAgIHZhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRpbnB1dC50ZXh0KCk7XG4gICAgfVxufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1TdHJpbmd7Y29sb3I6IzAwMDtiYWNrZ3JvdW5kOiNGRkZGQTE7cGFkZGluZzowO2Rpc3BsYXk6aW5saW5lfS5zdHJpbmctaW5wdXR7LW1vei11c2VyLXNlbGVjdDp0ZXh0Oy1tcy11c2VyLXNlbGVjdDp0ZXh0Oy1raHRtbC11c2VyLXNlbGVjdDp0ZXh0Oy13ZWJraXQtdXNlci1zZWxlY3Q6dGV4dDstby11c2VyLXNlbGVjdDp0ZXh0O3VzZXItc2VsZWN0OnRleHR9LnN0cmluZy1pbnB1dDpmb2N1c3tvdXRsaW5lOjB9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJ2YXIgTGl0ZXJhbCAgICAgPSByZXF1aXJlKCcuLi9MaXRlcmFsJyksXG4gICAgQXJndW1lbnQgICAgPSByZXF1aXJlKCcuLi8uLi9Bcmd1bWVudCcpO1xuXG5yZXF1aXJlKCcuL1Zhci5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gTGl0ZXJhbC5leHRlbmQoJ0NvZGUtVmFyJywge1xuICAgIGlzVmFyOiB0cnVlLFxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRuYW1lID0gJChcIjxpbnB1dCB0eXBlPSd0ZXh0JyAvPlwiKTtcblxuICAgICAgICB0aGlzLiR3cmFwcGVyXG4gICAgICAgICAgICAuYXBwZW5kKHRoaXMuJG5hbWUpO1xuICAgIH0sXG4gICAgbWV0YToge1xuICAgICAgICBkaXNwbGF5OiBcIlZhclwiXG4gICAgfSxcbiAgICB2YWw6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJlbnQoJ0NvZGUtQmxvY2snKS5lbnZpcm9ubWVudC5nZXQodGhpcy4kbmFtZS52YWwoKSk7XG4gICAgfSxcbiAgICBmb2N1czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJG5hbWUuZm9jdXMoKTtcbiAgICB9XG59KTsiLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCIudmlldy1Db2RlLVZhcntiYWNrZ3JvdW5kOiMwMGZ9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKCcuL1N0cmluZy9TdHJpbmcnKSxcbiAgICByZXF1aXJlKCcuL051bWJlci9OdW1iZXInKSxcbiAgICByZXF1aXJlKCcuL0Jvb2xlYW5zL1RydWUnKSxcbiAgICByZXF1aXJlKCcuL0Jvb2xlYW5zL0ZhbHNlJyksXG4gICAgcmVxdWlyZSgnLi9WYXIvVmFyJylcbl07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQm9vbGVhbicpLmV4dGVuZCgnQU5EJywge1xuICAgIHRlbXBsYXRlOiBcIkFORFwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgJiYgc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwidmFyIE9wZXJhdG9yID0gcmVxdWlyZSgnLi4vT3BlcmF0b3InKTtcbnJlcXVpcmUoJy4vQm9vbGVhbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gT3BlcmF0b3IuZXh0ZW5kKCdCb29sZWFuJywge1xuICAgIHByZWNlZGVuY2U6IDBcbn0pOyIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LUJvb2xlYW57YmFja2dyb3VuZDojRjUzOTM5O2ZvbnQtc3R5bGU6aXRhbGljfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Jvb2xlYW4nKS5leHRlbmQoJ05PVCcsIHtcbiAgICBpc1NpbmdsZU9wZXJhdG9yOiAgIHRydWUsXG4gICAgdGVtcGxhdGU6ICAgICAgICAgICBcIk5PVFwiLFxuICAgIHByZWNlZGVuY2U6ICAgICAgICAgNSxcbiAgICBydW46IGZ1bmN0aW9uKGV4cCkge1xuICAgICAgICBpZihleHAudHlwZSA9PSAnTk9UJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpc051bGw6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gIWV4cDtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Jvb2xlYW4nKS5leHRlbmQoJ09SJywge1xuICAgIHRlbXBsYXRlOiBcIk9SXCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCB8fCBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQm9vbGVhbicpLmV4dGVuZCgnWE9SJywge1xuICAgIHRlbXBsYXRlOiBcIlhPUlwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gIWZpcnN0ICE9ICFzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFtcbiAgICByZXF1aXJlKCcuL0FORCcpLFxuICAgIHJlcXVpcmUoJy4vT1InKSxcbiAgICByZXF1aXJlKCcuL1hPUicpLFxuICAgIHJlcXVpcmUoJy4vTk9UJylcbl07XG4iLCJ2YXIgT3BlcmF0b3IgPSByZXF1aXJlKCcuLi9PcGVyYXRvcicpO1xucmVxdWlyZSgnLi9Db21wYXJhdG9yLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBPcGVyYXRvci5leHRlbmQoJ0NvbXBhcmF0b3InLCB7XG4gICAgcHJlY2VkZW5jZTogMVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29tcGFyYXRvcntiYWNrZ3JvdW5kOiMzNUMwNjJ9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQ29tcGFyYXRvcicpLmV4dGVuZCgnRXF1YWxzJywge1xuICAgIHRlbXBsYXRlOiBcIj1cIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0ID09IHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9yJykuZXh0ZW5kKCdHcmVhdGVyVGhhbicsIHtcbiAgICB0ZW1wbGF0ZTogXCI+XCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCA+IHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9Db21wYXJhdG9yJykuZXh0ZW5kKCdHcmVhdGVyVGhhbkVxdWFscycsIHtcbiAgICB0ZW1wbGF0ZTogXCImZ2U7XCIsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCA+PSBzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vQ29tcGFyYXRvcicpLmV4dGVuZCgnTGVzc1RoYW4nLCB7XG4gICAgdGVtcGxhdGU6IFwiPFwiLFxuICAgIHJ1bjogZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkge1xuICAgICAgICByZXR1cm4gZmlyc3QgPCBzZWNvbmQ7XG4gICAgfVxufSk7IiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0NvbXBhcmF0b3InKS5leHRlbmQoJ0xlc3NUaGFuRXF1YWxzJywge1xuICAgIHRlbXBsYXRlOiBcIiZsZTtcIixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0IDw9IHNlY29uZDtcbiAgICB9XG59KTtcbiIsIm1vZHVsZS5leHBvcnRzID0gW1xuICAgIHJlcXVpcmUoJy4vR3JlYXRlclRoYW4nKSxcbiAgICByZXF1aXJlKCcuL0dyZWF0ZXJUaGFuRXF1YWxzJyksXG4gICAgcmVxdWlyZSgnLi9FcXVhbHMnKSxcbiAgICByZXF1aXJlKCcuL0xlc3NUaGFuRXF1YWxzJyksXG4gICAgcmVxdWlyZSgnLi9MZXNzVGhhbicpXG5dOyIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9NYXRoJykuZXh0ZW5kKCdEaXZpZGUnLCB7XG4gICAgdGVtcGxhdGU6IFwiJmZyYXNsO1wiLFxuICAgIHByZWNlZGVuY2U6IDMsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdC9zZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vTWF0aCcpLmV4dGVuZCgnRXhwJywge1xuICAgIHRlbXBsYXRlOiBcIl5cIixcbiAgICBwcmVjZWRlbmNlOiA0LFxuICAgIHJ1bjogTWF0aC5wb3dcbn0pOyIsInZhciBPcGVyYXRvciA9IHJlcXVpcmUoJy4uL09wZXJhdG9yJyk7XG5yZXF1aXJlKCcuL01hdGgubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9wZXJhdG9yLmV4dGVuZCgnTWF0aCcsIHtcbiAgICBcbn0pOyIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi52aWV3LU1hdGh7YmFja2dyb3VuZDojRjUzOTM5fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL01hdGgnKS5leHRlbmQoJ01pbnVzJywge1xuICAgIHRlbXBsYXRlOiBcIi1cIixcbiAgICBwcmVjZWRlbmNlOiBmdW5jdGlvbihzdGFjaywgaSkge1xuICAgICAgICBpZihpID09PSAwIHx8IHN0YWNrW2kgLSAxXS5pc09wZXJhdG9yKSB7XG4gICAgICAgICAgICB0aGlzLmlzU2luZ2xlT3BlcmF0b3IgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuIDU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG5cbiAgICAgICAgLy9OZWdhdGlvbiBPcGVyYXRvclxuICAgICAgICBpZih0eXBlb2Ygc2Vjb25kID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZihmaXJzdC50eXBlID09ICdNaW51cycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBpc051bGw6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC1maXJzdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vTWludXMgT3BlcmF0b3JcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmlyc3QgLSBzZWNvbmQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmlzU2luZ2xlT3BlcmF0b3IgPSBmYWxzZTtcbiAgICB9LFxuICAgIGNsZWFuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5pc1NpbmdsZU9wZXJhdG9yID0gZmFsc2U7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vTWF0aCcpLmV4dGVuZCgnTXVsdGlwbHknLCB7XG4gICAgdGVtcGxhdGU6IFwiJnRpbWVzO1wiLFxuICAgIHByZWNlZGVuY2U6IDMsXG4gICAgcnVuOiBmdW5jdGlvbihmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIHJldHVybiBmaXJzdCpzZWNvbmQ7XG4gICAgfVxufSk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vTWF0aCcpLmV4dGVuZCgnUGx1cycsIHtcbiAgICB0ZW1wbGF0ZTogXCIrXCIsXG4gICAgcHJlY2VkZW5jZTogMixcbiAgICBydW46IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHtcbiAgICAgICAgcmV0dXJuIGZpcnN0ICsgc2Vjb25kO1xuICAgIH1cbn0pO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG4gICAgcmVxdWlyZSgnLi9FeHAnKSxcbiAgICByZXF1aXJlKCcuL0RpdmlkZScpLFxuICAgIHJlcXVpcmUoJy4vTXVsdGlwbHknKSxcbiAgICByZXF1aXJlKCcuL01pbnVzJyksXG4gICAgcmVxdWlyZSgnLi9QbHVzJylcbl07XG4iLCJyZXF1aXJlKCcuL09wZXJhdG9yLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuLi9Ub2tlbicpLmV4dGVuZCgnT3BlcmF0b3InLCB7XG4gICAgaXNPcGVyYXRvcjogdHJ1ZSxcbiAgICB0YWdOYW1lOiAnc3Bhbidcbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctT3BlcmF0b3J7LXdlYmtpdC1ib3JkZXItcmFkaXVzOjNweDstbW96LWJvcmRlci1yYWRpdXM6M3B4O2JvcmRlci1yYWRpdXM6M3B4O3BhZGRpbmc6MCA0cHg7bWFyZ2luOjAgMXB4O2Rpc3BsYXk6aW5saW5lLWJsb2NrfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0NvbXBhcmF0b3JzL2luZGV4JykuY29uY2F0KFxuICAgIHJlcXVpcmUoJy4vTWF0aC9pbmRleCcpLFxuICAgIHJlcXVpcmUoJy4vQm9vbGVhbi9pbmRleCcpXG4pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGN1cnNvciAgPSByZXF1aXJlKCcuLi9jdXJzb3InKTtcblxucmVxdWlyZSgnLi9Ub2tlbi5sZXNzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VidmlldygnQ29kZS1Ub2tlbicsIHtcbiAgICBpc1Rva2VuOiB0cnVlLFxuICAgIGluaXQ6IGZ1bmN0aW9uKCkge30sXG4gICAgbWV0YToge30sXG4gICAgZm9jdXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFmdGVyKGN1cnNvcik7XG4gICAgfSxcbiAgICBlcnJvcjogcmVxdWlyZSgnLi4vQ29tcG9uZW50cy9lcnJvcicpLFxuICAgIHZhbGlkYXRlUG9zaXRpb246IGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuICAgIGVkaXRvcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudCgnQ29kZScpO1xuICAgIH1cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctQ29kZS1Ub2tlbntjb2xvcjojRkZGfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL0Z1bmN0aW9ucy9pbmRleCcpLmNvbmNhdChcbiAgICByZXF1aXJlKCcuL0xpdGVyYWxzL2luZGV4JyksXG4gICAgcmVxdWlyZSgnLi9PcGVyYXRvcnMvaW5kZXgnKSxcbiAgICByZXF1aXJlKCcuL0NvbnRyb2wvaW5kZXgnKSxcbiAgICByZXF1aXJlKCcuL0Fzc2lnbi9Bc3NpZ24nKVxuKTsiLCJ2YXIgc3VidmlldyA9IHJlcXVpcmUoJ3N1YnZpZXcnKTtcblxucmVxdWlyZSgnLi9jdXJzb3IubGVzcycpO1xuXG52YXIgQ3Vyc29yID0gc3VidmlldygnQ29kZS1DdXJzb3InLCB7XG4gICAgaW5pdDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkKGRvY3VtZW50KS5vbignZm9jdXMnLCAnaW5wdXQsIGRpdicsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5oaWRlKCk7XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgcGFzdGU6IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgdGhpcy5zaG93KCk7XG5cbiAgICAgICAgLy9HZXQgdGhlIHR5cGVcbiAgICAgICAgdmFyIFR5cGUgPSBzdWJ2aWV3Lmxvb2t1cCh0eXBlKTtcblxuICAgICAgICBpZighVHlwZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlR5cGUgJ1wiK3R5cGUrXCInIGRvZXMgbm90IGV4aXN0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9WYWxpZGF0ZSBQb3NpdGlvblxuICAgICAgICBpZihUeXBlLlZpZXcucHJvdG90eXBlLnZhbGlkYXRlUG9zaXRpb24odGhpcykpIHtcblxuICAgICAgICAgICAgLy9QYXN0ZSB0aGUgZnVuY3Rpb25cbiAgICAgICAgICAgIHZhciBjb21tYW5kID0gVHlwZS5zcGF3bigpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmJlZm9yZShjb21tYW5kLiR3cmFwcGVyKTtcbiAgICAgICAgICAgIGNvbW1hbmQuZm9jdXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vRXZlbnRcbiAgICAgICAgdGhpcy50cmlnZ2VyKCdwYXN0ZScpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBzaG93OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ2Rpc3BsYXknLCAnaW5saW5lLWJsb2NrJyk7XG4gICAgICAgICQoJzpmb2N1cycpLmJsdXIoKTtcbiAgICB9LFxuICAgIGhpZGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgfSxcbiAgICBhcHBlbmRUbzogZnVuY3Rpb24oJGVsKSB7XG4gICAgICAgIHRoaXMuc2hvdygpO1xuICAgICAgICAkZWwuYXBwZW5kKHRoaXMuJHdyYXBwZXIpO1xuICAgIH0sXG4gICAgZXJyb3I6IHJlcXVpcmUoJy4vQ29tcG9uZW50cy9lcnJvcicpXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDdXJzb3Iuc3Bhd24oKTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIkAtd2Via2l0LWtleWZyYW1lcyBmbGFzaHswJSwxMDAle29wYWNpdHk6MX01MCV7b3BhY2l0eTowfX0udmlldy1Db2RlLUN1cnNvcntwb3NpdGlvbjpyZWxhdGl2ZTtkaXNwbGF5OmlubGluZS1ibG9jazt3aWR0aDoycHg7aGVpZ2h0OjEuMWVtO21hcmdpbjotLjA1ZW0gLTFweDt0b3A6LjA1ZW07YmFja2dyb3VuZDojMTI3OUZDOy13ZWJraXQtYW5pbWF0aW9uOmZsYXNoIDFzIGluZmluaXRlfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHN1YnZpZXcgPSByZXF1aXJlKCdzdWJ2aWV3JyksXG4gICAgcHJlZml4ICA9IHJlcXVpcmUoJ3ByZWZpeCcpLFxuICAgICQgICAgICAgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcjtcblxucmVxdWlyZSgnLi9TbGlkZXIubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ1NsaWRlcicsIHtcblxuICAgIC8qKiogQ29uZmlndXJhdGlvbiAqKiovXG4gICAgcGFuZWxzOiAgICAgICAgIFtdLFxuICAgIGRlZmF1bHRQYW5lbDogICAwLFxuICAgIHNwZWVkOiAgICAgICAgICAzMDAsXG5cbiAgICAvKioqIENvcmUgRnVuY3Rpb25hbGl0eSAqKiovXG4gICAgY29uZmlnOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy4kc2xpZGVyID0gJChcIjxkaXYgY2xhc3M9J1NsaWRlci1TbGlkZXInPlwiKVxuICAgICAgICAgICAgLmFwcGVuZFRvKHRoaXMuJHdyYXBwZXIpO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5wYW5lbFdpZHRoID0gMTAwL3RoaXMucGFuZWxzLmxlbmd0aDtcbiAgICAgICAgXG4gICAgICAgIC8vQnVpbGQgdGhlIHBhbmVsc1xuICAgICAgICBmb3IodmFyIGk9MDsgaTx0aGlzLnBhbmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHBhbmVsID0gdGhpcy5wYW5lbHNbaV0sXG4gICAgICAgICAgICAgICAgc3VidmlldyA9IHBhbmVsLmNvbnRlbnQuaXNWaWV3UG9vbCA/IHBhbmVsLmNvbnRlbnQuc3Bhd24oKSA6IHBhbmVsLmNvbnRlbnQ7XG5cbiAgICAgICAgICAgIC8vQ29uZmlndXJlIHRoZSBQYW5lbFxuICAgICAgICAgICAgcGFuZWwuY29udGVudCAgID0gc3VidmlldztcbiAgICAgICAgICAgIHBhbmVsLiR3cmFwcGVyICA9IHN1YnZpZXcuJHdyYXBwZXI7XG5cbiAgICAgICAgICAgIC8vQWRkIENsYXNzXG4gICAgICAgICAgICBwYW5lbC4kd3JhcHBlclxuICAgICAgICAgICAgICAgIC5hZGRDbGFzcygnU2xpZGVyLVBhbmVsJylcbiAgICAgICAgICAgICAgICAuY3NzKCd3aWR0aCcsIHRoaXMucGFuZWxXaWR0aCArICclJyk7XG5cbiAgICAgICAgICAgIC8vQXBwZW5kXG4gICAgICAgICAgICB0aGlzLiRzbGlkZXIuYXBwZW5kKHBhbmVsLiR3cmFwcGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vU2V0IFNsaWRlciBXaWR0aFxuICAgICAgICB0aGlzLiRzbGlkZXIuY3NzKCd3aWR0aCcsICh0aGlzLnBhbmVscy5sZW5ndGgqMTAwKSArICclJyk7XG4gICAgfSxcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vU2hvdyB0aGUgZGVmYXVsdCBwYW5lbFxuICAgICAgICB0aGlzLnNob3codGhpcy5kZWZhdWx0UGFuZWwpO1xuXG4gICAgICAgIC8vQ29uZmlndXJlIFRyYW5zaXRpb25zXG4gICAgICAgIHRoaXMuX3NldHVwVHJhbnNpdGlvbnMoKTtcbiAgICB9LFxuICAgIGNsZWFuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5wYW5lbHMgICAgICAgICA9IHt9O1xuICAgICAgICB0aGlzLmRlZmF1bHRQYW5lbCAgID0gMDtcbiAgICAgICAgdGhpcy4kd3JhcHBlci5odG1sKCcnKTtcbiAgICAgICAgdGhpcy5fcmVtb3ZlVHJhbnNpdGlvbnMoKTtcbiAgICB9LFxuXG4gICAgLyoqKiBNZXRob2RzICoqKi9cbiAgICBzaG93OiBmdW5jdGlvbihpLCBjYWxsYmFjaykge1xuICAgICAgICBpZih0eXBlb2YgaSA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaSA9IHRoaXMuX2dldFBhbmVsTnVtKGkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy4kc2xpZGVyLmNzcyhcbiAgICAgICAgICAgIHByZWZpeC5kYXNoKCd0cmFuc2Zvcm0nKSwgXG4gICAgICAgICAgICAndHJhbnNsYXRlKC0nICsgKGkqdGhpcy5wYW5lbFdpZHRoKSArICclKSdcbiAgICAgICAgKTtcblxuICAgICAgICBpZihjYWxsYmFjaykge1xuICAgICAgICAgICAgc2V0VGltZW91dChjYWxsYmFjaywgdGhpcy5zcGVlZCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqKiBJbnRlcm5hbCBNZXRob2RzICoqKi9cbiAgICBfZ2V0UGFuZWxOdW06IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdmFyIGkgPSB0aGlzLnBhbmVscy5sZW5ndGg7XG4gICAgICAgIHdoaWxlKGktLSkge1xuICAgICAgICAgICAgaWYodGhpcy5wYW5lbHNbaV0ubmFtZSA9PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLmVycm9yKCdQYW5lbCBcIicrbmFtZSsnXCIgaXMgbm90IGRlZmluZWQuJyk7XG4gICAgICAgIHJldHVybiAwO1xuICAgIH0sXG4gICAgX3NldHVwVHJhbnNpdGlvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLiRzbGlkZXIuY3NzKHByZWZpeC5kYXNoKCd0cmFuc2l0aW9uJyksIHByZWZpeC5kYXNoKCd0cmFuc2Zvcm0nKSArICcgJyArICh0aGlzLnNwZWVkLzEwMDApICsgJ3MnKTtcbiAgICB9LFxuICAgIF9yZW1vdmVUcmFuc2l0aW9uczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJHNsaWRlci5jc3MocHJlZml4LmRhc2goJ3RyYW5zaXRpb24nKSwgJ25vbmUnKTtcbiAgICB9XG5cbn0pO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctU2xpZGVye3Bvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7b3ZlcmZsb3c6aGlkZGVufS5TbGlkZXItU2xpZGVye3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6MDt0b3A6MDtoZWlnaHQ6MTAwJTt3aGl0ZS1zcGFjZTpub3dyYXB9LlNsaWRlci1QYW5lbHtkaXNwbGF5OmlubGluZS1ibG9jaztwb3NpdGlvbjpyZWxhdGl2ZTtoZWlnaHQ6MTAwJTt2ZXJ0aWNhbC1hbGlnbjp0b3A7d2hpdGUtc3BhY2U6bm9ybWFsfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHN1YnZpZXcgICAgID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgIGNsaWNrICAgID0gcmVxdWlyZSgnb25jbGljaycpO1xuXG5yZXF1aXJlKCcuL1Rvb2xiYXIubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoXCJUb29sYmFyXCIpO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctVG9vbGJhcntwb3NpdGlvbjphYnNvbHV0ZTtoZWlnaHQ6NTBweDt3aWR0aDoxMDAlO2JhY2tncm91bmQ6I0YxRjBGMDtib3JkZXItYm90dG9tOnNvbGlkIDFweCAjQ0NDOy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O2JveC1zaXppbmc6Ym9yZGVyLWJveDtwYWRkaW5nLXRvcDoyMHB4fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwidmFyIHRlbXBsYXRlciA9IHJlcXVpcmUoXCJoYW5kbGViYXJzL3J1bnRpbWVcIikuZGVmYXVsdC50ZW1wbGF0ZTttb2R1bGUuZXhwb3J0cyA9IHRlbXBsYXRlcihmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLm1zZykgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5tc2cpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIHJldHVybiBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSk7XG4gIH0pOyIsInZhciBzdWJ2aWV3ID0gcmVxdWlyZSgnc3VidmlldycpLFxuICAgICQgICAgICAgPSByZXF1aXJlKCd1bm9waW5pb25hdGUnKS5zZWxlY3RvcjtcblxudmFyICRib2R5ID0gJCgnYm9keScpO1xuXG5yZXF1aXJlKCcuL1Rvb2x0aXAubGVzcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHN1YnZpZXcoJ1Rvb2x0aXAnLCB7XG4gICAgY29uZmlnOiBmdW5jdGlvbihjb25maWcpIHtcbiAgICAgICAgdGhpcy5tc2cgPSBjb25maWcubXNnO1xuICAgICAgICB0aGlzLiRlbCA9IGNvbmZpZy4kZWw7XG4gICAgICAgIHRoaXMuJGNvbnN0cmFpbiA9IGNvbmZpZy4kY29uc3RyYWluIHx8ICRib2R5OyAvL0NvbnN0cmFpbnQgc2hvdWxkIGFsd2F5cyBoYXZlIHJlbGF0aXZlIG9yIGFic29sdXRlIHBvc2l0aW9uaW5nXG4gICAgfSxcbiAgICBpbml0OiBmdW5jdGlvbigpIHtcblxuICAgICAgICAvKioqIEFwcGVuZCB0byBEb2N1bWVudCAqKiovXG4gICAgICAgIC8vIERvIHRoaXMgaGVyZSBzbyB0aGF0IHRoZSBkZWZhdWx0IGRpbWVuc2lvbnMgc2hvdyB1cFxuICAgICAgICB0aGlzLiRjb25zdHJhaW4uYXBwZW5kKHRoaXMuJHdyYXBwZXIpO1xuICAgICAgICB0aGlzLiR3cmFwcGVyLmFwcGVuZCh0aGlzLiRhcnJvdyk7XG5cbiAgICAgICAgLyoqKiBHZXQgcG9zaXRpb24gZGF0YSAqKiovXG4gICAgICAgIHZhciBlbCAgICAgID0gdGhpcy4kZWwucG9zaXRpb24oKSxcbiAgICAgICAgICAgIGNvbiAgICAgPSB0aGlzLiRjb25zdHJhaW4ucG9zaXRpb24oKTtcblxuICAgICAgICBlbC53aWR0aCAgICA9IHRoaXMuJGVsLm91dGVyV2lkdGgoKTtcbiAgICAgICAgZWwuaGVpZ2h0ICAgPSB0aGlzLiRlbC5vdXRlckhlaWdodCgpO1xuXG4gICAgICAgIGNvbi53aWR0aCAgID0gdGhpcy4kY29uc3RyYWluLm91dGVyV2lkdGgoKTtcbiAgICAgICAgY29uLmhlaWdodCAgPSB0aGlzLiRjb25zdHJhaW4ub3V0ZXJIZWlnaHQoKTtcblxuICAgICAgICB2YXIgd3JhcEggICA9IHRoaXMuJHdyYXBwZXIub3V0ZXJIZWlnaHQoKSxcbiAgICAgICAgICAgIHdyYXBXICAgPSB0aGlzLiR3cmFwcGVyLm91dGVyV2lkdGgoKTtcblxuICAgICAgICAvL0dldCBkZXJpdmVkIHBvc2l0aW9uIGRhdGFcbiAgICAgICAgZWwubWlkID0gZWwubGVmdCArIGVsLndpZHRoLzI7XG5cbiAgICAgICAgLyoqKiBEZXRlcm1pbmUgdmVydGljYWwgcG9zaXRpb24gKioqL1xuICAgICAgICB2YXIgdG9wU3BhY2UgICAgPSBlbC50b3AgLSBjb24udG9wLFxuICAgICAgICAgICAgYm90dG9tU3BhY2UgPSAoY29uLnRvcCArIGNvbi5oZWlnaHQpIC0gKGVsLnRvcCArIGVsLmhlaWdodCk7XG5cbiAgICAgICAgY29uc29sZS5sb2coZWwpO1xuICAgICAgICBjb25zb2xlLmxvZyhjb24pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKHRvcFNwYWNlKTtcbiAgICAgICAgY29uc29sZS5sb2coYm90dG9tU3BhY2UpO1xuXG4gICAgICAgIC8vUHV0IGl0IGFib3ZlIHRoZSBlbGVtZW50XG4gICAgICAgIGlmKHRvcFNwYWNlID4gYm90dG9tU3BhY2UpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdhYm92ZScpO1xuICAgICAgICAgICAgaWYod3JhcEggPiB0b3BTcGFjZSkge1xuICAgICAgICAgICAgICAgIHdyYXBIID0gdG9wU3BhY2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuY3NzKCd0b3AnLCBlbC50b3AgLSB3cmFwSCk7XG4gICAgICAgIH1cblxuICAgICAgICAvL1B1dCBpdCBiZWxvdyB0aGUgZWxlbWVudFxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdiZWxvdycpO1xuICAgICAgICAgICAgY29uc29sZS5sb2cod3JhcEgpO1xuICAgICAgICAgICAgaWYod3JhcEggPiBib3R0b21TcGFjZSkge1xuICAgICAgICAgICAgICAgIHdyYXBIID0gdG9wU3BhY2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuY3NzKCd0b3AnLCBlbC50b3AgKyBlbC5oZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ2hlaWdodCcsIHdyYXBIKTtcblxuICAgICAgICAvKioqIERldGVybWluZSBIb3Jpem9udGFsIFBvc2l0aW9uICoqKi9cbiAgICAgICAgdmFyIGNlbnRlckxlZnQgPSBlbC5taWQgLSB3cmFwVy8yO1xuICAgICAgICBcbiAgICAgICAgaWYoY2VudGVyTGVmdCA8IGNvbi5sZWZ0KSB7XG4gICAgICAgICAgICB0aGlzLiR3cmFwcGVyLmNzcygnbGVmdCcsIDApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYoY2VudGVyTGVmdCArIHdyYXBXID4gY29uLmxlZnQgKyBjb24ud2lkdGgpIHtcbiAgICAgICAgICAgIHRoaXMuJHdyYXBwZXIuY3NzKCdyaWdodCcsIGNlbnRlckxlZnQpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy4kd3JhcHBlci5jc3MoJ2xlZnQnLCBjZW50ZXJMZWZ0KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgXG4gICAgfSxcbiAgICBjbGVhbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuJHdyYXBwZXJcbiAgICAgICAgICAgIC5jc3MoJ2hlaWdodCcsICdhdXRvJylcbiAgICAgICAgICAgIC5jc3MoJ2xlZnQnLCAnYXV0bycpXG4gICAgICAgICAgICAuY3NzKCdyaWdodCcsICdhdXRvJyk7XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVxdWlyZSgnLi9Ub29sdGlwLmhhbmRsZWJhcnMnKSxcbiAgICBkYXRhOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1zZzogdGhpcy5tc2dcbiAgICAgICAgfTtcbiAgICB9LFxuICAgICRhcnJvdzogJChcIjxkaXYgY2xhc3M9J1Rvb2x0aXAtYXJyb3cnPlwiKVxufSk7IiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLnZpZXctVG9vbHRpcHtwb3NpdGlvbjphYnNvbHV0ZTttYXgtd2lkdGg6MTAwJTttYXgtaGVpZ2h0OjEwMCU7b3ZlcmZsb3c6YXV0b31cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsInZhciBTbGlkZXIgPSByZXF1aXJlKCcuL1VJL1NsaWRlci9TbGlkZXInKTtcblxucmVxdWlyZSgnLi9tYWluLmxlc3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTbGlkZXIuZXh0ZW5kKCdtYWluJywge1xuICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5saXN0ZW5Eb3duKHtcbiAgICAgICAgICAgIG9wZW46IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHNlbGYuc2hvdygnZmlsZXMnKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlZGl0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNob3coJ2VkaXRvcicpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJ1bjogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBzZWxmLnNob3coJ3J1bicsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBwYW5lbHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogICAgICAgJ2ZpbGVzJyxcbiAgICAgICAgICAgIGNvbnRlbnQ6ICAgIHJlcXVpcmUoJy4vRmlsZXMvRmlsZXMnKVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAgICAgICAnZWRpdG9yJyxcbiAgICAgICAgICAgIGNvbnRlbnQ6ICAgIHJlcXVpcmUoJy4vRWRpdG9yL0VkaXRvcicpXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICAgICAgICdydW4nLFxuICAgICAgICAgICAgY29udGVudDogICAgcmVxdWlyZSgnLi9SdW4vUnVuJylcbiAgICAgICAgfVxuICAgIF0sXG4gICAgZGVmYXVsdFBhbmVsOiAnZWRpdG9yJ1xufSk7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCJib2R5LGh0bWx7aGVpZ2h0OjEwMCU7d2lkdGg6MTAwJX1ib2R5ey1tb3otdXNlci1zZWxlY3Q6bm9uZTstbXMtdXNlci1zZWxlY3Q6bm9uZTsta2h0bWwtdXNlci1zZWxlY3Q6bm9uZTstd2Via2l0LXVzZXItc2VsZWN0Om5vbmU7LW8tdXNlci1zZWxlY3Q6bm9uZTt1c2VyLXNlbGVjdDpub25lO21hcmdpbjowO3Bvc2l0aW9uOmFic29sdXRlO2ZvbnQtZmFtaWx5OkF2ZW5pcixcXFwiSGVsdmV0aWNhIE5ldWVcXFwiLEhlbHZldGljYSxzYW5zLXNlcmlmfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIl19
