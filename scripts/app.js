(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
Waypoints - 4.0.0
Copyright © 2011-2015 Caleb Troughton
Licensed under the MIT license.
https://github.com/imakewebthings/waypoints/blob/master/licenses.txt
*/
'use strict';

(function () {
  'use strict';

  var keyCounter = 0;
  var allWaypoints = {};

  /* http://imakewebthings.com/waypoints/api/waypoint */
  function Waypoint(options) {
    if (!options) {
      throw new Error('No options passed to Waypoint constructor');
    }
    if (!options.element) {
      throw new Error('No element option passed to Waypoint constructor');
    }
    if (!options.handler) {
      throw new Error('No handler option passed to Waypoint constructor');
    }

    this.key = 'waypoint-' + keyCounter;
    this.options = Waypoint.Adapter.extend({}, Waypoint.defaults, options);
    this.element = this.options.element;
    this.adapter = new Waypoint.Adapter(this.element);
    this.callback = options.handler;
    this.axis = this.options.horizontal ? 'horizontal' : 'vertical';
    this.enabled = this.options.enabled;
    this.triggerPoint = null;
    this.group = Waypoint.Group.findOrCreate({
      name: this.options.group,
      axis: this.axis
    });
    this.context = Waypoint.Context.findOrCreateByElement(this.options.context);

    if (Waypoint.offsetAliases[this.options.offset]) {
      this.options.offset = Waypoint.offsetAliases[this.options.offset];
    }
    this.group.add(this);
    this.context.add(this);
    allWaypoints[this.key] = this;
    keyCounter += 1;
  }

  /* Private */
  Waypoint.prototype.queueTrigger = function (direction) {
    this.group.queueTrigger(this, direction);
  };

  /* Private */
  Waypoint.prototype.trigger = function (args) {
    if (!this.enabled) {
      return;
    }
    if (this.callback) {
      this.callback.apply(this, args);
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/destroy */
  Waypoint.prototype.destroy = function () {
    this.context.remove(this);
    this.group.remove(this);
    delete allWaypoints[this.key];
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/disable */
  Waypoint.prototype.disable = function () {
    this.enabled = false;
    return this;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/enable */
  Waypoint.prototype.enable = function () {
    this.context.refresh();
    this.enabled = true;
    return this;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/next */
  Waypoint.prototype.next = function () {
    return this.group.next(this);
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/previous */
  Waypoint.prototype.previous = function () {
    return this.group.previous(this);
  };

  /* Private */
  Waypoint.invokeAll = function (method) {
    var allWaypointsArray = [];
    for (var waypointKey in allWaypoints) {
      allWaypointsArray.push(allWaypoints[waypointKey]);
    }
    for (var i = 0, end = allWaypointsArray.length; i < end; i++) {
      allWaypointsArray[i][method]();
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/destroy-all */
  Waypoint.destroyAll = function () {
    Waypoint.invokeAll('destroy');
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/disable-all */
  Waypoint.disableAll = function () {
    Waypoint.invokeAll('disable');
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/enable-all */
  Waypoint.enableAll = function () {
    Waypoint.invokeAll('enable');
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/refresh-all */
  Waypoint.refreshAll = function () {
    Waypoint.Context.refreshAll();
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/viewport-height */
  Waypoint.viewportHeight = function () {
    return window.innerHeight || document.documentElement.clientHeight;
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/viewport-width */
  Waypoint.viewportWidth = function () {
    return document.documentElement.clientWidth;
  };

  Waypoint.adapters = [];

  Waypoint.defaults = {
    context: window,
    continuous: true,
    enabled: true,
    group: 'default',
    horizontal: false,
    offset: 0
  };

  Waypoint.offsetAliases = {
    'bottom-in-view': function bottomInView() {
      return this.context.innerHeight() - this.adapter.outerHeight();
    },
    'right-in-view': function rightInView() {
      return this.context.innerWidth() - this.adapter.outerWidth();
    }
  };

  window.Waypoint = Waypoint;
})();(function () {
  'use strict';

  function requestAnimationFrameShim(callback) {
    window.setTimeout(callback, 1000 / 60);
  }

  var keyCounter = 0;
  var contexts = {};
  var Waypoint = window.Waypoint;
  var oldWindowLoad = window.onload;

  /* http://imakewebthings.com/waypoints/api/context */
  function Context(element) {
    this.element = element;
    this.Adapter = Waypoint.Adapter;
    this.adapter = new this.Adapter(element);
    this.key = 'waypoint-context-' + keyCounter;
    this.didScroll = false;
    this.didResize = false;
    this.oldScroll = {
      x: this.adapter.scrollLeft(),
      y: this.adapter.scrollTop()
    };
    this.waypoints = {
      vertical: {},
      horizontal: {}
    };

    element.waypointContextKey = this.key;
    contexts[element.waypointContextKey] = this;
    keyCounter += 1;

    this.createThrottledScrollHandler();
    this.createThrottledResizeHandler();
  }

  /* Private */
  Context.prototype.add = function (waypoint) {
    var axis = waypoint.options.horizontal ? 'horizontal' : 'vertical';
    this.waypoints[axis][waypoint.key] = waypoint;
    this.refresh();
  };

  /* Private */
  Context.prototype.checkEmpty = function () {
    var horizontalEmpty = this.Adapter.isEmptyObject(this.waypoints.horizontal);
    var verticalEmpty = this.Adapter.isEmptyObject(this.waypoints.vertical);
    if (horizontalEmpty && verticalEmpty) {
      this.adapter.off('.waypoints');
      delete contexts[this.key];
    }
  };

  /* Private */
  Context.prototype.createThrottledResizeHandler = function () {
    var self = this;

    function resizeHandler() {
      self.handleResize();
      self.didResize = false;
    }

    this.adapter.on('resize.waypoints', function () {
      if (!self.didResize) {
        self.didResize = true;
        Waypoint.requestAnimationFrame(resizeHandler);
      }
    });
  };

  /* Private */
  Context.prototype.createThrottledScrollHandler = function () {
    var self = this;
    function scrollHandler() {
      self.handleScroll();
      self.didScroll = false;
    }

    this.adapter.on('scroll.waypoints', function () {
      if (!self.didScroll || Waypoint.isTouch) {
        self.didScroll = true;
        Waypoint.requestAnimationFrame(scrollHandler);
      }
    });
  };

  /* Private */
  Context.prototype.handleResize = function () {
    Waypoint.Context.refreshAll();
  };

  /* Private */
  Context.prototype.handleScroll = function () {
    var triggeredGroups = {};
    var axes = {
      horizontal: {
        newScroll: this.adapter.scrollLeft(),
        oldScroll: this.oldScroll.x,
        forward: 'right',
        backward: 'left'
      },
      vertical: {
        newScroll: this.adapter.scrollTop(),
        oldScroll: this.oldScroll.y,
        forward: 'down',
        backward: 'up'
      }
    };

    for (var axisKey in axes) {
      var axis = axes[axisKey];
      var isForward = axis.newScroll > axis.oldScroll;
      var direction = isForward ? axis.forward : axis.backward;

      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        var wasBeforeTriggerPoint = axis.oldScroll < waypoint.triggerPoint;
        var nowAfterTriggerPoint = axis.newScroll >= waypoint.triggerPoint;
        var crossedForward = wasBeforeTriggerPoint && nowAfterTriggerPoint;
        var crossedBackward = !wasBeforeTriggerPoint && !nowAfterTriggerPoint;
        if (crossedForward || crossedBackward) {
          waypoint.queueTrigger(direction);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }

    for (var groupKey in triggeredGroups) {
      triggeredGroups[groupKey].flushTriggers();
    }

    this.oldScroll = {
      x: axes.horizontal.newScroll,
      y: axes.vertical.newScroll
    };
  };

  /* Private */
  Context.prototype.innerHeight = function () {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return Waypoint.viewportHeight();
    }
    /*eslint-enable eqeqeq */
    return this.adapter.innerHeight();
  };

  /* Private */
  Context.prototype.remove = function (waypoint) {
    delete this.waypoints[waypoint.axis][waypoint.key];
    this.checkEmpty();
  };

  /* Private */
  Context.prototype.innerWidth = function () {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return Waypoint.viewportWidth();
    }
    /*eslint-enable eqeqeq */
    return this.adapter.innerWidth();
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-destroy */
  Context.prototype.destroy = function () {
    var allWaypoints = [];
    for (var axis in this.waypoints) {
      for (var waypointKey in this.waypoints[axis]) {
        allWaypoints.push(this.waypoints[axis][waypointKey]);
      }
    }
    for (var i = 0, end = allWaypoints.length; i < end; i++) {
      allWaypoints[i].destroy();
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-refresh */
  Context.prototype.refresh = function () {
    /*eslint-disable eqeqeq */
    var isWindow = this.element == this.element.window;
    /*eslint-enable eqeqeq */
    var contextOffset = isWindow ? undefined : this.adapter.offset();
    var triggeredGroups = {};
    var axes;

    this.handleScroll();
    axes = {
      horizontal: {
        contextOffset: isWindow ? 0 : contextOffset.left,
        contextScroll: isWindow ? 0 : this.oldScroll.x,
        contextDimension: this.innerWidth(),
        oldScroll: this.oldScroll.x,
        forward: 'right',
        backward: 'left',
        offsetProp: 'left'
      },
      vertical: {
        contextOffset: isWindow ? 0 : contextOffset.top,
        contextScroll: isWindow ? 0 : this.oldScroll.y,
        contextDimension: this.innerHeight(),
        oldScroll: this.oldScroll.y,
        forward: 'down',
        backward: 'up',
        offsetProp: 'top'
      }
    };

    for (var axisKey in axes) {
      var axis = axes[axisKey];
      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        var adjustment = waypoint.options.offset;
        var oldTriggerPoint = waypoint.triggerPoint;
        var elementOffset = 0;
        var freshWaypoint = oldTriggerPoint == null;
        var contextModifier, wasBeforeScroll, nowAfterScroll;
        var triggeredBackward, triggeredForward;

        if (waypoint.element !== waypoint.element.window) {
          elementOffset = waypoint.adapter.offset()[axis.offsetProp];
        }

        if (typeof adjustment === 'function') {
          adjustment = adjustment.apply(waypoint);
        } else if (typeof adjustment === 'string') {
          adjustment = parseFloat(adjustment);
          if (waypoint.options.offset.indexOf('%') > -1) {
            adjustment = Math.ceil(axis.contextDimension * adjustment / 100);
          }
        }

        contextModifier = axis.contextScroll - axis.contextOffset;
        waypoint.triggerPoint = elementOffset + contextModifier - adjustment;
        wasBeforeScroll = oldTriggerPoint < axis.oldScroll;
        nowAfterScroll = waypoint.triggerPoint >= axis.oldScroll;
        triggeredBackward = wasBeforeScroll && nowAfterScroll;
        triggeredForward = !wasBeforeScroll && !nowAfterScroll;

        if (!freshWaypoint && triggeredBackward) {
          waypoint.queueTrigger(axis.backward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (!freshWaypoint && triggeredForward) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (freshWaypoint && axis.oldScroll >= waypoint.triggerPoint) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }

    Waypoint.requestAnimationFrame(function () {
      for (var groupKey in triggeredGroups) {
        triggeredGroups[groupKey].flushTriggers();
      }
    });

    return this;
  };

  /* Private */
  Context.findOrCreateByElement = function (element) {
    return Context.findByElement(element) || new Context(element);
  };

  /* Private */
  Context.refreshAll = function () {
    for (var contextId in contexts) {
      contexts[contextId].refresh();
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/context-find-by-element */
  Context.findByElement = function (element) {
    return contexts[element.waypointContextKey];
  };

  window.onload = function () {
    if (oldWindowLoad) {
      oldWindowLoad();
    }
    Context.refreshAll();
  };

  Waypoint.requestAnimationFrame = function (callback) {
    var requestFn = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || requestAnimationFrameShim;
    requestFn.call(window, callback);
  };
  Waypoint.Context = Context;
})();(function () {
  'use strict';

  function byTriggerPoint(a, b) {
    return a.triggerPoint - b.triggerPoint;
  }

  function byReverseTriggerPoint(a, b) {
    return b.triggerPoint - a.triggerPoint;
  }

  var groups = {
    vertical: {},
    horizontal: {}
  };
  var Waypoint = window.Waypoint;

  /* http://imakewebthings.com/waypoints/api/group */
  function Group(options) {
    this.name = options.name;
    this.axis = options.axis;
    this.id = this.name + '-' + this.axis;
    this.waypoints = [];
    this.clearTriggerQueues();
    groups[this.axis][this.name] = this;
  }

  /* Private */
  Group.prototype.add = function (waypoint) {
    this.waypoints.push(waypoint);
  };

  /* Private */
  Group.prototype.clearTriggerQueues = function () {
    this.triggerQueues = {
      up: [],
      down: [],
      left: [],
      right: []
    };
  };

  /* Private */
  Group.prototype.flushTriggers = function () {
    for (var direction in this.triggerQueues) {
      var waypoints = this.triggerQueues[direction];
      var reverse = direction === 'up' || direction === 'left';
      waypoints.sort(reverse ? byReverseTriggerPoint : byTriggerPoint);
      for (var i = 0, end = waypoints.length; i < end; i += 1) {
        var waypoint = waypoints[i];
        if (waypoint.options.continuous || i === waypoints.length - 1) {
          waypoint.trigger([direction]);
        }
      }
    }
    this.clearTriggerQueues();
  };

  /* Private */
  Group.prototype.next = function (waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    var isLast = index === this.waypoints.length - 1;
    return isLast ? null : this.waypoints[index + 1];
  };

  /* Private */
  Group.prototype.previous = function (waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    return index ? this.waypoints[index - 1] : null;
  };

  /* Private */
  Group.prototype.queueTrigger = function (waypoint, direction) {
    this.triggerQueues[direction].push(waypoint);
  };

  /* Private */
  Group.prototype.remove = function (waypoint) {
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    if (index > -1) {
      this.waypoints.splice(index, 1);
    }
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/first */
  Group.prototype.first = function () {
    return this.waypoints[0];
  };

  /* Public */
  /* http://imakewebthings.com/waypoints/api/last */
  Group.prototype.last = function () {
    return this.waypoints[this.waypoints.length - 1];
  };

  /* Private */
  Group.findOrCreate = function (options) {
    return groups[options.axis][options.name] || new Group(options);
  };

  Waypoint.Group = Group;
})();(function () {
  'use strict';

  var Waypoint = window.Waypoint;

  function isWindow(element) {
    return element === element.window;
  }

  function getWindow(element) {
    if (isWindow(element)) {
      return element;
    }
    return element.defaultView;
  }

  function NoFrameworkAdapter(element) {
    this.element = element;
    this.handlers = {};
  }

  NoFrameworkAdapter.prototype.innerHeight = function () {
    var isWin = isWindow(this.element);
    return isWin ? this.element.innerHeight : this.element.clientHeight;
  };

  NoFrameworkAdapter.prototype.innerWidth = function () {
    var isWin = isWindow(this.element);
    return isWin ? this.element.innerWidth : this.element.clientWidth;
  };

  NoFrameworkAdapter.prototype.off = function (event, handler) {
    function removeListeners(element, listeners, handler) {
      for (var i = 0, end = listeners.length - 1; i < end; i++) {
        var listener = listeners[i];
        if (!handler || handler === listener) {
          element.removeEventListener(listener);
        }
      }
    }

    var eventParts = event.split('.');
    var eventType = eventParts[0];
    var namespace = eventParts[1];
    var element = this.element;

    if (namespace && this.handlers[namespace] && eventType) {
      removeListeners(element, this.handlers[namespace][eventType], handler);
      this.handlers[namespace][eventType] = [];
    } else if (eventType) {
      for (var ns in this.handlers) {
        removeListeners(element, this.handlers[ns][eventType] || [], handler);
        this.handlers[ns][eventType] = [];
      }
    } else if (namespace && this.handlers[namespace]) {
      for (var type in this.handlers[namespace]) {
        removeListeners(element, this.handlers[namespace][type], handler);
      }
      this.handlers[namespace] = {};
    }
  };

  /* Adapted from jQuery 1.x offset() */
  NoFrameworkAdapter.prototype.offset = function () {
    if (!this.element.ownerDocument) {
      return null;
    }

    var documentElement = this.element.ownerDocument.documentElement;
    var win = getWindow(this.element.ownerDocument);
    var rect = {
      top: 0,
      left: 0
    };

    if (this.element.getBoundingClientRect) {
      rect = this.element.getBoundingClientRect();
    }

    return {
      top: rect.top + win.pageYOffset - documentElement.clientTop,
      left: rect.left + win.pageXOffset - documentElement.clientLeft
    };
  };

  NoFrameworkAdapter.prototype.on = function (event, handler) {
    var eventParts = event.split('.');
    var eventType = eventParts[0];
    var namespace = eventParts[1] || '__default';
    var nsHandlers = this.handlers[namespace] = this.handlers[namespace] || {};
    var nsTypeList = nsHandlers[eventType] = nsHandlers[eventType] || [];

    nsTypeList.push(handler);
    this.element.addEventListener(eventType, handler);
  };

  NoFrameworkAdapter.prototype.outerHeight = function (includeMargin) {
    var height = this.innerHeight();
    var computedStyle;

    if (includeMargin && !isWindow(this.element)) {
      computedStyle = window.getComputedStyle(this.element);
      height += parseInt(computedStyle.marginTop, 10);
      height += parseInt(computedStyle.marginBottom, 10);
    }

    return height;
  };

  NoFrameworkAdapter.prototype.outerWidth = function (includeMargin) {
    var width = this.innerWidth();
    var computedStyle;

    if (includeMargin && !isWindow(this.element)) {
      computedStyle = window.getComputedStyle(this.element);
      width += parseInt(computedStyle.marginLeft, 10);
      width += parseInt(computedStyle.marginRight, 10);
    }

    return width;
  };

  NoFrameworkAdapter.prototype.scrollLeft = function () {
    var win = getWindow(this.element);
    return win ? win.pageXOffset : this.element.scrollLeft;
  };

  NoFrameworkAdapter.prototype.scrollTop = function () {
    var win = getWindow(this.element);
    return win ? win.pageYOffset : this.element.scrollTop;
  };

  NoFrameworkAdapter.extend = function () {
    var args = Array.prototype.slice.call(arguments);

    function merge(target, obj) {
      if (typeof target === 'object' && typeof obj === 'object') {
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            target[key] = obj[key];
          }
        }
      }

      return target;
    }

    for (var i = 1, end = args.length; i < end; i++) {
      merge(args[0], args[i]);
    }
    return args[0];
  };

  NoFrameworkAdapter.inArray = function (element, array, i) {
    return array == null ? -1 : array.indexOf(element, i);
  };

  NoFrameworkAdapter.isEmptyObject = function (obj) {
    /* eslint no-unused-vars: 0 */
    for (var name in obj) {
      return false;
    }
    return true;
  };

  Waypoint.adapters.push({
    name: 'noframework',
    Adapter: NoFrameworkAdapter
  });
  Waypoint.Adapter = NoFrameworkAdapter;
})();

},{}],2:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _vendorAnimatescrollMinJs = require('./vendor/animatescroll.min.js');

var _vendorAnimatescrollMinJs2 = _interopRequireDefault(_vendorAnimatescrollMinJs);

var _rockNSlideJs = require("./rock-n-slide.js");

require('./common.js');
require('./mobile-menu.js');
require('./slider.js');
require('./vendor/gradientmaps.min.js');

// dependencies and configuration rockNslide
require('./rock-n-slide.js');

var config = {
  lazyLoad: false
};

var dependency = {
  animateScroll: _vendorAnimatescrollMinJs2['default'],
  waypoints: require("./../../bower_components/waypoints/lib/noframework.waypoints.js"),
  gradientMaps: require('./vendor/gradientmaps.min.js')
};

_rockNSlideJs.rockNslide.init(config, dependency);

},{"./../../bower_components/waypoints/lib/noframework.waypoints.js":1,"./common.js":3,"./mobile-menu.js":4,"./rock-n-slide.js":5,"./slider.js":6,"./vendor/animatescroll.min.js":7,"./vendor/gradientmaps.min.js":8}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.toggleVisibility = toggleVisibility;
exports.getOffsetY = getOffsetY;
require('./vendor/gradientmaps.min.js'); // Generator of gradientmap

var scrollText = document.getElementsByClassName('slide__scrolling-text')[0];
var body = document.getElementsByTagName('body')[0];

// Is it IE?
(function () {
  var ieRegex = new RegExp("MSIE ([0-9]{1,}[\.0-9]{0,})");
  if (ieRegex.exec(navigator.userAgent) != null) {
    body.classList.add('ie');
  }
})();

// Add target=_blank to all links except menu links generated from json
var links = document.getElementsByTagName('a');
for (var elem = 0; elem < links.length; exports.elem = elem += 1, elem - 1) {
  if (!links[elem].classList.contains('menu__nav-anchor')) links[elem].setAttribute('target', '_blank');
}

function toggleVisibility(elem) {
  if (typeof elem !== "undefined" && elem !== null) {
    elem.style.opacity = getOffsetY() > 0 ? 0 : 1;
  }
}

;

function getOffsetY() {
  return window.scrollY || window.pageYOffset;
}

;

// Apply Gradient Maps
var elemsWithGradients = document.querySelectorAll('[data-gradient]');
for (var elem = 0; elem < elemsWithGradients.length; exports.elem = elem += 1, elem - 1) {
  var gradient = elemsWithGradients[elem].getAttribute('data-gradient');
  GradientMaps.applyGradientMap(elemsWithGradients[elem], gradient);
}
toggleVisibility(scrollText);

exports['default'] = body;

},{"./vendor/gradientmaps.min.js":8}],4:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _commonJs = require("./common.js");

var _commonJs2 = _interopRequireDefault(_commonJs);

var isMenuOpen = false;
var mobileMenuTrigger = document.getElementsByClassName('menu-nav__trigger')[0];
var mobileMenu = document.getElementsByClassName('slide--menu')[0];
var menuItem = document.getElementsByClassName('menu__nav-anchor');
var scrollText = document.getElementsByClassName('slide__scrolling-text')[0];

var toggleMobileMenu = function toggleMobileMenu() {
  isMenuOpen = !isMenuOpen;
  mobileMenuTrigger.classList.toggle('menu-nav__trigger--active');
  mobileMenu.classList.toggle('slide--menu-active');
  (0, _commonJs.toggleVisibility)(scrollText);
  _commonJs2['default'].classList.toggle('overflow--hide');
};

mobileMenuTrigger.addEventListener('click', function (e) {
  e.preventDefault();
  toggleMobileMenu();
});

for (var i = 0; i < menuItem.length; i++) {
  menuItem[i].addEventListener('click', toggleMobileMenu);
}

},{"./common.js":3}],5:[function(require,module,exports){
// Load dependencies in parameter
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var rockNslide = (function () {
  // CONFIG and VARIABLES
  var DEFAULT_CONFIG = {
    speed: 400,
    animationType: 'easeInOutQuad',
    lazyLoad: true,
    help: true,
    classList: {
      slidesWrapper: "frame",
      slide: "slide",
      menuTrigger: "menu-nav__trigger",
      menuTriggerActive: "menu-nav__trigger--active",
      menuSlide: "slide--menu",
      menuSlideActive: "slide--menu-active",
      menuItem: "menu__nav-anchor",
      scrollText: "slide__scrolling-text"
    }
  };
  var CONFIG = {};
  var animationInProgress = false;
  var elemsWithGradients = [];
  var dependency = {};
  var isMenuOpen = false;
  var slides = [];
  var slidesWrapper = undefined;
  var mobileMenuTrigger = undefined;
  var mobileMenu = undefined;
  var menuItem = undefined;
  var scrollText = undefined;

  // Check dependencies
  var checkDependencies = function checkDependencies() {
    if (dependency.animateScroll == null || dependency.animateScroll == undefined) {
      dependency.animateScroll = false;
      if (CONFIG.help == true) {
        console.info("rockNslide: AnimationScroll is missing \n" + "Disabling sliding animations.");
      }
    }
    if (dependency.waypoints == null || dependency.waypoints == undefined) {
      dependency.waypoints = false;
      CONFIG.lazyLoad = false;
      if (CONFIG.help == true) {
        console.info("rockNslide: Waypoint is missing \n" + "Disabling lazy load.");
      }
    }
    if (dependency.gradientMaps == null || dependency.gradientMaps == undefined) {
      dependency.gradientMaps = false;
      if (CONFIG.help == true) {
        console.info("rockNslide: GradientMaps is missing \n" + "Disabling gradient maps.");
      }
    }
  };

  // Helpers
  var getOffsetY = function getOffsetY() {
    return window.scrollY || window.pageYOffset;
  };

  var generateSlides = function generateSlides() {
    var slidesWrapper = document.getElementsByClassName(CONFIG.classList.slidesWrapper)[0];
    var slides = slidesWrapper.getElementsByClassName(CONFIG.classList.slide);

    assignSnapValues();
    applyGradientMaps(slidesWrapper);
  };

  var generateDOMReferences = function generateDOMReferences() {
    slidesWrapper = document.getElementsByClassName(CONFIG.classList.slidesWrapper)[0];
    mobileMenuTrigger = document.getElementsByClassName(CONFIG.classList.menuTrigger)[0];
    mobileMenu = document.getElementsByClassName(CONFIG.classList.menuSlide)[0];
    menuItem = document.getElementsByClassName(CONFIG.classList.menuItem);
    scrollText = document.getElementsByClassName(CONFIG.classList.scrollText)[0];
  };

  var assignSnapValues = function assignSnapValues() {
    if (dependency.waypoints) {
      for (var i = 0; i < slides.length; i++) {
        new Waypoint({
          element: slides[i],
          handler: lazyImage,
          offset: '200%'
        });
      }
    }
  };

  var applyGradientMaps = function applyGradientMaps(wrapper) {
    if (dependency.gradientMaps) {
      var _elemsWithGradients = wrapper.querySelectorAll('[data-gradient]');
      for (var elem = 0; elem < _elemsWithGradients.length; elem++) {
        var gradient = _elemsWithGradients[elem].getAttribute('data-gradient');
        GradientMaps.applyGradientMap(_elemsWithGradients[elem], gradient);
      }
    }
  };

  var calculateNearestSlide = function calculateNearestSlide(dir) {
    var documentHeight = document.body.clientHeight;
    var windowHeight = window.innerHeight;
    var offsetTop = getOffsetY();
    var passSlides = Math.round(offsetTop / windowHeight);
    var currentSlide = slides[passSlides];

    switch (dir) {
      case "up":
        return offsetTop <= windowHeight / 2 ? currentSlide : slides[passSlides - 1];
      case "down":
        return offsetTop >= documentHeight - windowHeight * 1.5 ? currentSlide : slides[passSlides + 1];
      default:
        return currentSlide;
    }
  };

  // Sliding
  var slideTo = function slideTo(dir) {
    if (animationInProgress) {
      return;
    }
    animationInProgress = true;
    animateScroll(calculateNearestSlide(dir), 400, 'easeInOutQuad', 0, 0, function () {
      animationInProgress = false;
    });
  };

  // showMenu
  var toggleMobileMenu = function toggleMobileMenu() {
    isMenuOpen = !isMenuOpen;
    mobileMenuTrigger.classList.toggle(CONFIG.classList.menuTriggerActive);
    mobileMenu.classList.toggle(CONFIG.classList.menuSlideActive);
    if (body.style.overflow == "hidden") {
      body.style.overflow = "";
    } else {
      body.style.overflow = "hidden";
    }
  };

  // scrollToTop
  var scrollToTop = function scrollToTop() {
    if (animationInProgress) {
      return;
    }
    animationInProgress = true;
    animateScroll(slides[0], CONFIG.speed, CONFIG.animationType, 0, 0, function () {
      animationInProgress = false;
    });
  };

  // prevSlide
  var prevSlide = function prevSlide() {
    slideTo("up");
  };

  // nextSlide
  var nextSlide = function nextSlide() {
    slideTo("down");
  };

  // Watchers
  var initWatchers = function initWatchers() {
    if (CONFIG.lazyLoad) {
      window.onresize = function () {
        assignSnapValues();
      };
    }
  };

  // Initialization
  // externalStuff should be an object containing
  // animateScroll, Waypoints and GradientMaps
  var init = function init(config, externalStuff) {
    CONFIG = Object.assign({}, DEFAULT_CONFIG, config);
    dependency = externalStuff;
    checkDependencies();
    initWatchers();
    generateDOMReferences();
    generateSlides();
  };

  return {
    scrollToTop: scrollToTop,
    prevSlide: prevSlide,
    nextSlide: nextSlide,
    toggleMenu: toggleMobileMenu,
    init: init
  };
})();
exports.rockNslide = rockNslide;

},{}],6:[function(require,module,exports){
'use strict';

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

// Generator of gradientmap

var _vendorAnimatescrollMinJs = require('./vendor/animatescroll.min.js');

var _vendorAnimatescrollMinJs2 = _interopRequireDefault(_vendorAnimatescrollMinJs);

// Pure JS animate scroll

var _commonJs = require("./common.js");

var _commonJs2 = _interopRequireDefault(_commonJs);

require('./vendor/gradientmaps.min.js');require("./../../bower_components/waypoints/lib/noframework.waypoints.js"); // Waypoints for lazy load animations
require('./mobile-menu.js');
require('./common.js');

var frame = document.getElementsByClassName('frame')[0];
var slides = frame.getElementsByClassName('slide');

// Mobile
var bodyBorder = Number(window.getComputedStyle(_commonJs2['default'], ':after').getPropertyValue('height').replace(/px$/, ''));
var scrollText = document.getElementsByClassName('slide__scrolling-text')[0];
var windowHeight = window.innerHeight;
var documentHeight = window.innerHeight;
var offsetTop = undefined;
var slideIndex = 0;

var lazyImage = function lazyImage() {
  var backgroundImage = this.element.getElementsByClassName('slide-background__image')[0];
  if (backgroundImage) {
    var newAttributes = backgroundImage.getAttribute('style') + ' ' + backgroundImage.getAttribute('data-style');
    backgroundImage.setAttribute('style', newAttributes);
    backgroundImage.removeAttribute('data-style');
  }
};

function assignSnapVariables() {
  for (var i = 0; i < slides.length; i++) {
    new Waypoint({
      element: slides[i],
      handler: lazyImage,
      offset: '200%'
    });
  }
}
assignSnapVariables();

var calculateNearestSlide = function calculateNearestSlide(dir) {
  var passSlides = Math.round(offsetTop / windowHeight);
  var currentSlide = slides[passSlides];

  switch (dir) {
    case "up":
      return offsetTop <= windowHeight / 2 ? currentSlide : slides[passSlides - 1];
    case "down":
      return offsetTop >= documentHeight - windowHeight * 1.5 ? currentSlide : slides[passSlides + 1];
    default:
      return currentSlide;
  }
};

window.onscroll = function () {
  (0, _commonJs.toggleVisibility)(scrollText);
};

window.onresize = function () {
  assignSnapVariables();
};

var animationInProgress = false;

window.onkeydown = function (e) {
  function doAnimate(dir) {
    if (animationInProgress) {
      return;
    }
    animationInProgress = true;

    (0, _vendorAnimatescrollMinJs2['default'])(calculateNearestSlide(dir), 400, 'easeInOutQuad', 0, 0, function () {
      animationInProgress = false;
    });
  }

  documentHeight = document.body.clientHeight;
  windowHeight = window.innerHeight;
  offsetTop = (0, _commonJs.getOffsetY)();
  if (e.keyCode == 38) {
    e.preventDefault();
    doAnimate('up');
  } else if (e.keyCode == 40 || e.keyCode == 32) {
    e.preventDefault();
    doAnimate('down');
  }
};

},{"./../../bower_components/waypoints/lib/noframework.waypoints.js":1,"./common.js":3,"./mobile-menu.js":4,"./vendor/animatescroll.min.js":7,"./vendor/gradientmaps.min.js":8}],7:[function(require,module,exports){
"use strict";

var animateScroll = function animateScroll(n, t, i, e, a, o) {
  var r = document.documentElement,
      s = r.clientHeight,
      u = "scrollMaxY" in window ? window.scrollMaxY : r.scrollHeight - s,
      l = window.scrollY || window.pageYOffset,
      c = l,
      h = n.getBoundingClientRect(),
      d = 0;"center" == a ? (d = h.top + h.height / 2, c -= s / 2) : "bottom" == a ? (d = h.bottom, c -= s, c += e ? e : 0) : (d = h.top, c -= e ? e : 0), c += d, c = Math.max(Math.min(u, c), 0);var m = c - l,
      w = { targetY: c, deltaY: m, duration: t ? t : 0, easing: i in animateScroll.Easing ? animateScroll.Easing[i] : animateScroll.Easing.linear, onFinish: o, startTime: Date.now(), lastY: l, step: animateScroll.step };window.requestAnimationFrame(w.step.bind(w));
};animateScroll.Easing = { linear: function linear(n) {
    return n;
  }, easeInQuad: function easeInQuad(n) {
    return n * n;
  }, easeOutQuad: function easeOutQuad(n) {
    return n * (2 - n);
  }, easeInOutQuad: function easeInOutQuad(n) {
    return .5 > n ? 2 * n * n : -1 + (4 - 2 * n) * n;
  }, easeInCubic: function easeInCubic(n) {
    return n * n * n;
  }, easeOutCubic: function easeOutCubic(n) {
    return --n * n * n + 1;
  }, easeInOutCubic: function easeInOutCubic(n) {
    return .5 > n ? 4 * n * n * n : (n - 1) * (2 * n - 2) * (2 * n - 2) + 1;
  }, easeInQuart: function easeInQuart(n) {
    return n * n * n * n;
  }, easeOutQuart: function easeOutQuart(n) {
    return 1 - --n * n * n * n;
  }, easeInOutQuart: function easeInOutQuart(n) {
    return .5 > n ? 8 * n * n * n * n : 1 - 8 * --n * n * n * n;
  }, easeInQuint: function easeInQuint(n) {
    return n * n * n * n * n;
  }, easeOutQuint: function easeOutQuint(n) {
    return 1 + --n * n * n * n * n;
  }, easeInOutQuint: function easeInOutQuint(n) {
    return .5 > n ? 16 * n * n * n * n * n : 1 + 16 * --n * n * n * n * n;
  } }, animateScroll.step = function () {
  if (this.lastY != window.scrollY && this.onFinish) return void this.onFinish();var n = Math.min((Date.now() - this.startTime) / this.duration, 1),
      t = this.targetY - (1 - this.easing(n)) * this.deltaY;window.scrollTo(window.scrollX, t), 1 != n ? (this.lastY = window.scrollY, window.requestAnimationFrame(this.step.bind(this))) : this.onFinish && this.onFinish();
}, module.exports = animateScroll;

},{}],8:[function(require,module,exports){
"use strict";

function clamp_css_byte(e) {
  return e = Math.round(e), 0 > e ? 0 : e > 255 ? 255 : e;
}function clamp_css_float(e) {
  return 0 > e ? 0 : e > 1 ? 1 : e;
}function parse_css_int(e) {
  return clamp_css_byte("%" === e[e.length - 1] ? parseFloat(e) / 100 * 255 : parseInt(e));
}function parse_css_float(e) {
  return clamp_css_float("%" === e[e.length - 1] ? parseFloat(e) / 100 : parseFloat(e));
}function css_hue_to_rgb(e, r, t) {
  return 0 > t ? t += 1 : t > 1 && (t -= 1), 1 > 6 * t ? e + (r - e) * t * 6 : 1 > 2 * t ? r : 2 > 3 * t ? e + (r - e) * (2 / 3 - t) * 6 : e;
}function parseCSSColor(e) {
  var r = e.replace(/ /g, "").toLowerCase();if (r in kCSSColorTable) return kCSSColorTable[r].slice();if ("#" === r[0]) {
    if (4 === r.length) {
      var t = parseInt(r.substr(1), 16);return t >= 0 && 4095 >= t ? [(3840 & t) >> 4 | (3840 & t) >> 8, 240 & t | (240 & t) >> 4, 15 & t | (15 & t) << 4, 1] : null;
    }if (7 === r.length) {
      var t = parseInt(r.substr(1), 16);return t >= 0 && 16777215 >= t ? [(16711680 & t) >> 16, (65280 & t) >> 8, 255 & t, 1] : null;
    }return null;
  }var a = r.indexOf("("),
      l = r.indexOf(")");if (-1 !== a && l + 1 === r.length) {
    var n = r.substr(0, a),
        o = r.substr(a + 1, l - (a + 1)).split(","),
        s = 1;switch (n) {case "rgba":
        if (4 !== o.length) return null;s = parse_css_float(o.pop());case "rgb":
        return 3 !== o.length ? null : [parse_css_int(o[0]), parse_css_int(o[1]), parse_css_int(o[2]), s];case "hsla":
        if (4 !== o.length) return null;s = parse_css_float(o.pop());case "hsl":
        if (3 !== o.length) return null;var i = (parseFloat(o[0]) % 360 + 360) % 360 / 360,
            u = parse_css_float(o[1]),
            d = parse_css_float(o[2]),
            p = .5 >= d ? d * (u + 1) : d + u - d * u,
            g = 2 * d - p;return [clamp_css_byte(255 * css_hue_to_rgb(g, p, i + 1 / 3)), clamp_css_byte(255 * css_hue_to_rgb(g, p, i)), clamp_css_byte(255 * css_hue_to_rgb(g, p, i - 1 / 3)), s];default:
        return null;}
  }return null;
}window.GradientMaps = (function (e) {
  function r() {
    this.init();
  }return r.prototype = { init: function init() {}, generateID: function generateID() {
      return this.previousID = this.previousID + 1 || 0, this.previousID;
    }, calcStopsArray: function calcStopsArray(e) {
      var r = e.match(/(((rgb|hsl)a?\(\d{1,3},\s*\d{1,3},\s*\d{1,3}(?:,\s*0?\.?\d+)?\)|\w+|#[0-9a-fA-F]{1,6})(\s+(0?\.\d+|\d{1,3}%))?)/g),
          t = (e.split(","), []);if ((r.forEach(function (e) {
        var r = e.match(/(?:((rgb|hsl)a?\(\d{1,3},\s*\d{1,3},\s*\d{1,3}(?:,\s*0?\.?\d+)?\)|\w+|#[0-9a-fA-F]{1,6})(\s+(?:0?\.\d+|\d{1,3}%))?)/);if (r && r.length >= 4) {
          var a = r[3];t.push({ color: parseCSSColor(r[1]), pos: a ? 100 * parse_css_float(a) : null });
        }
      }), t.length >= 1)) {
        var a = t[0];a.pos ? a.pos = Math.min(100, Math.max(0, a.pos)) : a.pos = 0;var l = a.pos;a = t[t.length - 1], a.pos ? a.pos = Math.min(100, Math.max(0, a.pos)) : a.pos = 100;for (var n = 1; n < t.length - 1; n++) a = t[n], a.pos && a.pos < l && (a.pos = l), a.pos > 100 && (a.pos = 100), l = a.pos;for (var n = 1; n < t.length - 1;) {
          if (!t[n].pos) {
            for (var o = n + 1; o < t.length && !t[o].pos; o++);for (var s = t[n - 1].pos, i = t[o].pos, u = o - 1 + 1, d = Math.round((i - s) / u); o > n;) t[n].pos = t[n - 1].pos + d, n++;
          }n++;
        }0 != t[0].pos && t.unshift({ color: t[0].color, pos: 0 }), 100 != t[t.length - 1].pos && t.push({ color: t[t.length - 1].color, pos: 100 });
      }return t;
    }, findMatchingDistributedNSegs: function findMatchingDistributedNSegs(e) {
      for (var r = 100, t = !1, a = 1; !t && r >= a; a++) {
        var l = r / a;t = !0;for (var n = 1; n < e.length - 1; n++) {
          var o = e[n].pos;if (l > o) {
            t = !1;break;
          }var s = o % l,
              i = 1;if (!(i > s || i > l - s)) {
            t = !1;break;
          }
        }if (t) return a;
      }return a;
    }, calcDistributedColors: function calcDistributedColors(e, r) {
      for (var t = [e[0].color], a = 100 / r, l = 1; l < e.length - 1; l++) {
        var n = e[l],
            o = Math.round(n.pos / a);t[o] = n.color;
      }t[r] = e[e.length - 1].color;for (var l = 1; l < t.length;) {
        if (!t[l]) {
          for (var s = l + 1; s < t.length && !t[s]; s++);for (var i = t[l - 1], u = i[0], d = i[1], p = i[2], g = i[3], h = t[s], r = s - l + 1, c = (h[0] - u) / r, f = (h[1] - d) / r, m = (h[2] - p) / r, b = (h[3] - g) / r; s > l;) u += c, d += f, p += m, g += b, t[l] = [u, d, p, g], l++;
        }l++;
      }return t;
    }, addElement: function addElement(e, r, t, a, l) {
      var n = a ? e.createElementNS(a, t) : e.createElement(t);return l && Object.keys(l).forEach(function (e, r, t) {
        n.setAttribute(e, l[e]);
      }), r && r.appendChild(n), n;
    }, addSVGComponentTransferFilter: function addSVGComponentTransferFilter(e, r) {
      var t = null,
          a = null,
          l = "http://www.w3.org/2000/svg",
          n = e.getAttribute("data-gradientmap-filter"),
          o = !1,
          s = e.ownerDocument;if (n && (t = s.getElementById(n))) {
        var i = t.getElementsByTagNameNS(l, "feComponentTransfer");if (i) {
          for (var u = i.length - 1; u >= 0; --u) t.removeChild(i[u]);a = t.parentElement;
        }
      }if (!a) {
        var a = this.addElement(s, null, "svg", l, { version: "1.1", width: 0, height: 0 });n = "filter-" + this.generateID(), t = this.addElement(s, a, "filter", l, { id: n }), e.setAttribute("data-gradientmap-filter", n);this.addElement(s, t, "feColorMatrix", l, { type: "matrix", values: "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0", result: "gray" });o = !0;
      }var d = this.addElement(s, t, "feComponentTransfer", l, { "color-interpolation-filters": "sRGB" }),
          p = "",
          g = "",
          h = "",
          c = "";r.forEach(function (e, r, t) {
        p += e[0] / 255 + " ", g += e[1] / 255 + " ", h += e[2] / 255 + " ", c += e[3] + " ";
      }), this.addElement(s, d, "feFuncR", l, { type: "table", tableValues: p.trim() }), this.addElement(s, d, "feFuncG", l, { type: "table", tableValues: g.trim() }), this.addElement(s, d, "feFuncB", l, { type: "table", tableValues: h.trim() }), this.addElement(s, d, "feFuncA", l, { type: "table", tableValues: c.trim() }), o && e.parentElement.insertBefore(a, e);var f = "url(#" + n + ")";e.style["-webkit-filter"] = f, e.style.filter = f;
    }, applyGradientMap: function applyGradientMap(e, r) {
      var t = this.calcStopsArray(r),
          a = this.findMatchingDistributedNSegs(t),
          l = this.calcDistributedColors(t, a);this.addSVGComponentTransferFilter(e, l);
    }, removeGradientMap: function removeGradientMap(e) {
      var r = e.getAttribute("data-gradientmap-filter");if (r) {
        var t = e.ownerDocument,
            a = t.getElementById(r);if (a) {
          var l = a.parentElement;if ((l.removeChild(a), l.childNodes.length <= 0)) {
            var n = l.parentElement;n.removeChild(l);
          }
        }e.removeAttribute("data-gradientmap-filter"), e.style["-webkit-filter"] = "", e.style.filter = "";
      }
    } }, new r();
})(window);var kCSSColorTable = { transparent: [0, 0, 0, 0], aliceblue: [240, 248, 255, 1], antiquewhite: [250, 235, 215, 1], aqua: [0, 255, 255, 1], aquamarine: [127, 255, 212, 1], azure: [240, 255, 255, 1], beige: [245, 245, 220, 1], bisque: [255, 228, 196, 1], black: [0, 0, 0, 1], blanchedalmond: [255, 235, 205, 1], blue: [0, 0, 255, 1], blueviolet: [138, 43, 226, 1], brown: [165, 42, 42, 1], burlywood: [222, 184, 135, 1], cadetblue: [95, 158, 160, 1], chartreuse: [127, 255, 0, 1], chocolate: [210, 105, 30, 1], coral: [255, 127, 80, 1], cornflowerblue: [100, 149, 237, 1], cornsilk: [255, 248, 220, 1], crimson: [220, 20, 60, 1], cyan: [0, 255, 255, 1], darkblue: [0, 0, 139, 1], darkcyan: [0, 139, 139, 1], darkgoldenrod: [184, 134, 11, 1], darkgray: [169, 169, 169, 1], darkgreen: [0, 100, 0, 1], darkgrey: [169, 169, 169, 1], darkkhaki: [189, 183, 107, 1], darkmagenta: [139, 0, 139, 1], darkolivegreen: [85, 107, 47, 1], darkorange: [255, 140, 0, 1], darkorchid: [153, 50, 204, 1], darkred: [139, 0, 0, 1], darksalmon: [233, 150, 122, 1], darkseagreen: [143, 188, 143, 1], darkslateblue: [72, 61, 139, 1], darkslategray: [47, 79, 79, 1], darkslategrey: [47, 79, 79, 1], darkturquoise: [0, 206, 209, 1], darkviolet: [148, 0, 211, 1], deeppink: [255, 20, 147, 1], deepskyblue: [0, 191, 255, 1], dimgray: [105, 105, 105, 1], dimgrey: [105, 105, 105, 1], dodgerblue: [30, 144, 255, 1], firebrick: [178, 34, 34, 1], floralwhite: [255, 250, 240, 1], forestgreen: [34, 139, 34, 1], fuchsia: [255, 0, 255, 1], gainsboro: [220, 220, 220, 1], ghostwhite: [248, 248, 255, 1], gold: [255, 215, 0, 1], goldenrod: [218, 165, 32, 1], gray: [128, 128, 128, 1], green: [0, 128, 0, 1], greenyellow: [173, 255, 47, 1], grey: [128, 128, 128, 1], honeydew: [240, 255, 240, 1], hotpink: [255, 105, 180, 1], indianred: [205, 92, 92, 1], indigo: [75, 0, 130, 1], ivory: [255, 255, 240, 1], khaki: [240, 230, 140, 1], lavender: [230, 230, 250, 1], lavenderblush: [255, 240, 245, 1], lawngreen: [124, 252, 0, 1], lemonchiffon: [255, 250, 205, 1], lightblue: [173, 216, 230, 1], lightcoral: [240, 128, 128, 1], lightcyan: [224, 255, 255, 1], lightgoldenrodyellow: [250, 250, 210, 1], lightgray: [211, 211, 211, 1], lightgreen: [144, 238, 144, 1], lightgrey: [211, 211, 211, 1], lightpink: [255, 182, 193, 1], lightsalmon: [255, 160, 122, 1], lightseagreen: [32, 178, 170, 1], lightskyblue: [135, 206, 250, 1], lightslategray: [119, 136, 153, 1], lightslategrey: [119, 136, 153, 1], lightsteelblue: [176, 196, 222, 1], lightyellow: [255, 255, 224, 1], lime: [0, 255, 0, 1], limegreen: [50, 205, 50, 1], linen: [250, 240, 230, 1], magenta: [255, 0, 255, 1], maroon: [128, 0, 0, 1], mediumaquamarine: [102, 205, 170, 1], mediumblue: [0, 0, 205, 1], mediumorchid: [186, 85, 211, 1], mediumpurple: [147, 112, 219, 1], mediumseagreen: [60, 179, 113, 1], mediumslateblue: [123, 104, 238, 1], mediumspringgreen: [0, 250, 154, 1], mediumturquoise: [72, 209, 204, 1], mediumvioletred: [199, 21, 133, 1], midnightblue: [25, 25, 112, 1], mintcream: [245, 255, 250, 1], mistyrose: [255, 228, 225, 1], moccasin: [255, 228, 181, 1], navajowhite: [255, 222, 173, 1], navy: [0, 0, 128, 1], oldlace: [253, 245, 230, 1], olive: [128, 128, 0, 1], olivedrab: [107, 142, 35, 1], orange: [255, 165, 0, 1], orangered: [255, 69, 0, 1], orchid: [218, 112, 214, 1], palegoldenrod: [238, 232, 170, 1], palegreen: [152, 251, 152, 1], paleturquoise: [175, 238, 238, 1], palevioletred: [219, 112, 147, 1], papayawhip: [255, 239, 213, 1], peachpuff: [255, 218, 185, 1], peru: [205, 133, 63, 1], pink: [255, 192, 203, 1], plum: [221, 160, 221, 1], powderblue: [176, 224, 230, 1], purple: [128, 0, 128, 1], red: [255, 0, 0, 1], rosybrown: [188, 143, 143, 1], royalblue: [65, 105, 225, 1], saddlebrown: [139, 69, 19, 1], salmon: [250, 128, 114, 1], sandybrown: [244, 164, 96, 1], seagreen: [46, 139, 87, 1], seashell: [255, 245, 238, 1], sienna: [160, 82, 45, 1], silver: [192, 192, 192, 1], skyblue: [135, 206, 235, 1], slateblue: [106, 90, 205, 1], slategray: [112, 128, 144, 1], slategrey: [112, 128, 144, 1], snow: [255, 250, 250, 1], springgreen: [0, 255, 127, 1], steelblue: [70, 130, 180, 1], tan: [210, 180, 140, 1], teal: [0, 128, 128, 1], thistle: [216, 191, 216, 1], tomato: [255, 99, 71, 1], turquoise: [64, 224, 208, 1], violet: [238, 130, 238, 1], wheat: [245, 222, 179, 1], white: [255, 255, 255, 1], whitesmoke: [245, 245, 245, 1], yellow: [255, 255, 0, 1], yellowgreen: [154, 205, 50, 1] };try {
  exports.parseCSSColor = parseCSSColor;
} catch (e) {}

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvYWxpbmFtZWxueWsvZGV2L3JvY2stbi1zbGlkZS9ib3dlcl9jb21wb25lbnRzL3dheXBvaW50cy9saWIvbm9mcmFtZXdvcmsud2F5cG9pbnRzLmpzIiwiL1VzZXJzL2FsaW5hbWVsbnlrL2Rldi9yb2NrLW4tc2xpZGUvc3JjL3NjcmlwdHMvYXBwLmpzIiwiL1VzZXJzL2FsaW5hbWVsbnlrL2Rldi9yb2NrLW4tc2xpZGUvc3JjL3NjcmlwdHMvY29tbW9uLmpzIiwiL1VzZXJzL2FsaW5hbWVsbnlrL2Rldi9yb2NrLW4tc2xpZGUvc3JjL3NjcmlwdHMvbW9iaWxlLW1lbnUuanMiLCIvVXNlcnMvYWxpbmFtZWxueWsvZGV2L3JvY2stbi1zbGlkZS9zcmMvc2NyaXB0cy9yb2NrLW4tc2xpZGUuanMiLCIvVXNlcnMvYWxpbmFtZWxueWsvZGV2L3JvY2stbi1zbGlkZS9zcmMvc2NyaXB0cy9zbGlkZXIuanMiLCIvVXNlcnMvYWxpbmFtZWxueWsvZGV2L3JvY2stbi1zbGlkZS9zcmMvc2NyaXB0cy92ZW5kb3IvYW5pbWF0ZXNjcm9sbC5taW4uanMiLCIvVXNlcnMvYWxpbmFtZWxueWsvZGV2L3JvY2stbi1zbGlkZS9zcmMvc2NyaXB0cy92ZW5kb3IvZ3JhZGllbnRtYXBzLm1pbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7O0FDTUEsQUFBQyxDQUFBLFlBQVc7QUFDVixjQUFZLENBQUE7O0FBRVosTUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFBO0FBQ2xCLE1BQUksWUFBWSxHQUFHLEVBQUUsQ0FBQTs7O0FBR3JCLFdBQVMsUUFBUSxDQUFDLE9BQU8sRUFBRTtBQUN6QixRQUFJLENBQUMsT0FBTyxFQUFFO0FBQ1osWUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFBO0tBQzdEO0FBQ0QsUUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7QUFD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QUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDO01BQUMsQ0FBQyxHQUFDLEVBQUMsT0FBTyxFQUFDLENBQUMsRUFBQyxNQUFNLEVBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsRUFBQyxNQUFNLEVBQUMsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxNQUFNLEdBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBQyxRQUFRLEVBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUMsS0FBSyxFQUFDLENBQUMsRUFBQyxJQUFJLEVBQUMsYUFBYSxDQUFDLElBQUksRUFBQyxDQUFDLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0NBQUMsQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFDLEVBQUMsTUFBTSxFQUFDLGdCQUFTLENBQUMsRUFBQztBQUFDLFdBQU8sQ0FBQyxDQUFBO0dBQUMsRUFBQyxVQUFVLEVBQUMsb0JBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxXQUFXLEVBQUMscUJBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTyxDQUFDLElBQUUsQ0FBQyxHQUFDLENBQUMsQ0FBQSxBQUFDLENBQUE7R0FBQyxFQUFDLGFBQWEsRUFBQyx1QkFBUyxDQUFDLEVBQUM7QUFBQyxXQUFNLEVBQUUsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQSxHQUFFLENBQUMsQ0FBQTtHQUFDLEVBQUMsV0FBVyxFQUFDLHFCQUFTLENBQUMsRUFBQztBQUFDLFdBQU8sQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUE7R0FBQyxFQUFDLFlBQVksRUFBQyxzQkFBUyxDQUFDLEVBQUM7QUFBQyxXQUFNLEVBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxjQUFjLEVBQUMsd0JBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTSxFQUFFLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUEsSUFBRyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQSxBQUFDLElBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUEsQUFBQyxHQUFDLENBQUMsQ0FBQTtHQUFDLEVBQUMsV0FBVyxFQUFDLHFCQUFTLENBQUMsRUFBQztBQUFDLFdBQU8sQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxZQUFZLEVBQUMsc0JBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTyxDQUFDLEdBQUUsRUFBRSxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUE7R0FBQyxFQUFDLGNBQWMsRUFBQyx3QkFBUyxDQUFDLEVBQUM7QUFBQyxXQUFNLEVBQUUsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLEVBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxXQUFXLEVBQUMscUJBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxZQUFZLEVBQUMsc0JBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTyxDQUFDLEdBQUMsRUFBRSxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxjQUFjLEVBQUMsd0JBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBTSxFQUFFLEdBQUMsQ0FBQyxHQUFDLEVBQUUsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxFQUFFLEdBQUMsRUFBRSxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0dBQUMsRUFBQyxFQUFDLGFBQWEsQ0FBQyxJQUFJLEdBQUMsWUFBVTtBQUFDLE1BQUcsSUFBSSxDQUFDLEtBQUssSUFBRSxNQUFNLENBQUMsT0FBTyxJQUFFLElBQUksQ0FBQyxRQUFRLEVBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFDLElBQUksQ0FBQyxTQUFTLENBQUEsR0FBRSxJQUFJLENBQUMsUUFBUSxFQUFDLENBQUMsQ0FBQztNQUFDLENBQUMsR0FBQyxJQUFJLENBQUMsT0FBTyxHQUFDLENBQUMsQ0FBQyxHQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUEsR0FBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLElBQUUsQ0FBQyxJQUFFLElBQUksQ0FBQyxLQUFLLEdBQUMsTUFBTSxDQUFDLE9BQU8sRUFBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQSxHQUFFLElBQUksQ0FBQyxRQUFRLElBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFBO0NBQUMsRUFBQyxNQUFNLENBQUMsT0FBTyxHQUFDLGFBQWEsQ0FBQzs7Ozs7QUNBeGxELFNBQVMsY0FBYyxDQUFDLENBQUMsRUFBQztBQUFDLFNBQU8sQ0FBQyxHQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxHQUFHLEdBQUMsQ0FBQyxDQUFBO0NBQUMsU0FBUyxlQUFlLENBQUMsQ0FBQyxFQUFDO0FBQUMsU0FBTyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUE7Q0FBQyxTQUFTLGFBQWEsQ0FBQyxDQUFDLEVBQUM7QUFBQyxTQUFPLGNBQWMsQ0FBQyxHQUFHLEtBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxDQUFDLEdBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxHQUFHLEdBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7Q0FBQyxTQUFTLGVBQWUsQ0FBQyxDQUFDLEVBQUM7QUFBQyxTQUFPLGVBQWUsQ0FBQyxHQUFHLEtBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxDQUFDLEdBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtDQUFDLFNBQVMsY0FBYyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDO0FBQUMsU0FBTyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsSUFBRSxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsS0FBRyxDQUFDLElBQUUsQ0FBQyxDQUFBLEFBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBLEdBQUUsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQSxJQUFHLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBLEFBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBO0NBQUMsU0FBUyxhQUFhLENBQUMsQ0FBQyxFQUFDO0FBQUMsTUFBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUMsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsSUFBRyxDQUFDLElBQUksY0FBYyxFQUFDLE9BQU8sY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLElBQUcsR0FBRyxLQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQztBQUFDLFFBQUcsQ0FBQyxLQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFBQyxVQUFJLENBQUMsR0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBRSxDQUFDLElBQUUsSUFBSSxJQUFFLENBQUMsR0FBQyxDQUFDLENBQUMsSUFBSSxHQUFDLENBQUMsQ0FBQSxJQUFHLENBQUMsR0FBQyxDQUFDLElBQUksR0FBQyxDQUFDLENBQUEsSUFBRyxDQUFDLEVBQUMsR0FBRyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUcsR0FBQyxDQUFDLENBQUEsSUFBRyxDQUFDLEVBQUMsRUFBRSxHQUFDLENBQUMsR0FBQyxDQUFDLEVBQUUsR0FBQyxDQUFDLENBQUEsSUFBRyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEdBQUMsSUFBSSxDQUFBO0tBQUMsSUFBRyxDQUFDLEtBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBQztBQUFDLFVBQUksQ0FBQyxHQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFFLENBQUMsSUFBRSxRQUFRLElBQUUsQ0FBQyxHQUFDLENBQUMsQ0FBQyxRQUFRLEdBQUMsQ0FBQyxDQUFBLElBQUcsRUFBRSxFQUFDLENBQUMsS0FBSyxHQUFDLENBQUMsQ0FBQSxJQUFHLENBQUMsRUFBQyxHQUFHLEdBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxHQUFDLElBQUksQ0FBQTtLQUFDLE9BQU8sSUFBSSxDQUFBO0dBQUMsSUFBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7TUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFHLENBQUMsQ0FBQyxLQUFHLENBQUMsSUFBRSxDQUFDLEdBQUMsQ0FBQyxLQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUM7QUFBQyxRQUFJLENBQUMsR0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7UUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUMsQ0FBQyxFQUFDLENBQUMsSUFBRSxDQUFDLEdBQUMsQ0FBQyxDQUFBLEFBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUM7UUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLFFBQU8sQ0FBQyxHQUFFLEtBQUksTUFBTTtBQUFDLFlBQUcsQ0FBQyxLQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFJLEtBQUs7QUFBQyxlQUFPLENBQUMsS0FBRyxDQUFDLENBQUMsTUFBTSxHQUFDLElBQUksR0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUksTUFBTTtBQUFDLFlBQUcsQ0FBQyxLQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFJLEtBQUs7QUFBQyxZQUFHLENBQUMsS0FBRyxDQUFDLENBQUMsTUFBTSxFQUFDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxHQUFHLENBQUEsR0FBRSxHQUFHLEdBQUMsR0FBRztZQUFDLENBQUMsR0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQUMsQ0FBQyxHQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFBQyxDQUFDLEdBQUMsRUFBRSxJQUFFLENBQUMsR0FBQyxDQUFDLElBQUUsQ0FBQyxHQUFDLENBQUMsQ0FBQSxBQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQztZQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxPQUFNLENBQUMsY0FBYyxDQUFDLEdBQUcsR0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsY0FBYyxDQUFDLEdBQUcsR0FBQyxjQUFjLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLGNBQWMsQ0FBQyxHQUFHLEdBQUMsY0FBYyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDO0FBQVEsZUFBTyxJQUFJLENBQUEsQ0FBQztHQUFDLE9BQU8sSUFBSSxDQUFBO0NBQUMsTUFBTSxDQUFDLFlBQVksR0FBQyxDQUFBLFVBQVMsQ0FBQyxFQUFDO0FBQUMsV0FBUyxDQUFDLEdBQUU7QUFBQyxRQUFJLENBQUMsSUFBSSxFQUFFLENBQUE7R0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLEdBQUMsRUFBQyxJQUFJLEVBQUMsZ0JBQVUsRUFBRSxFQUFDLFVBQVUsRUFBQyxzQkFBVTtBQUFDLGFBQU8sSUFBSSxDQUFDLFVBQVUsR0FBQyxJQUFJLENBQUMsVUFBVSxHQUFDLENBQUMsSUFBRSxDQUFDLEVBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQTtLQUFDLEVBQUMsY0FBYyxFQUFDLHdCQUFTLENBQUMsRUFBQztBQUFDLFVBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsa0hBQWtILENBQUM7VUFBQyxDQUFDLElBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBQyxFQUFFLENBQUEsQUFBQyxDQUFDLEtBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFTLENBQUMsRUFBQztBQUFDLFlBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMscUhBQXFILENBQUMsQ0FBQyxJQUFHLENBQUMsSUFBRSxDQUFDLENBQUMsTUFBTSxJQUFFLENBQUMsRUFBQztBQUFDLGNBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsS0FBSyxFQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLEdBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQTtTQUFDO09BQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxNQUFNLElBQUUsQ0FBQyxDQUFBLEVBQUM7QUFBQyxZQUFJLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBQyxDQUFDLENBQUMsR0FBRyxHQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsR0FBRyxHQUFDLEdBQUcsQ0FBQyxLQUFJLElBQUksQ0FBQyxHQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFFLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsR0FBRyxJQUFFLENBQUMsQ0FBQyxHQUFHLEdBQUMsQ0FBQyxLQUFHLENBQUMsQ0FBQyxHQUFHLEdBQUMsQ0FBQyxDQUFBLEFBQUMsRUFBQyxDQUFDLENBQUMsR0FBRyxHQUFDLEdBQUcsS0FBRyxDQUFDLENBQUMsR0FBRyxHQUFDLEdBQUcsQ0FBQSxBQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSSxJQUFJLENBQUMsR0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxHQUFFO0FBQUMsY0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUM7QUFBQyxpQkFBSSxJQUFJLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsTUFBTSxJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUUsRUFBRSxLQUFJLElBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUEsR0FBRSxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxHQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxDQUFBO1dBQUMsQ0FBQyxFQUFFLENBQUE7U0FBQyxDQUFDLElBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUMsS0FBSyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUMsR0FBRyxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsR0FBRyxJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsS0FBSyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQTtPQUFDLE9BQU8sQ0FBQyxDQUFBO0tBQUMsRUFBQyw0QkFBNEIsRUFBQyxzQ0FBUyxDQUFDLEVBQUM7QUFBQyxXQUFJLElBQUksQ0FBQyxHQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsSUFBRSxDQUFDLElBQUUsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDO0FBQUMsWUFBSSxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSSxJQUFJLENBQUMsR0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFDO0FBQUMsY0FBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFHLENBQUMsR0FBQyxDQUFDLEVBQUM7QUFBQyxhQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSztXQUFDLElBQUksQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDO2NBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxJQUFHLEVBQUUsQ0FBQyxHQUFDLENBQUMsSUFBRSxDQUFDLEdBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQSxBQUFDLEVBQUM7QUFBQyxhQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsTUFBSztXQUFDO1NBQUMsSUFBRyxDQUFDLEVBQUMsT0FBTyxDQUFDLENBQUE7T0FBQyxPQUFPLENBQUMsQ0FBQTtLQUFDLEVBQUMscUJBQXFCLEVBQUMsK0JBQVMsQ0FBQyxFQUFDLENBQUMsRUFBQztBQUFDLFdBQUksSUFBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFFLEVBQUM7QUFBQyxZQUFJLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQUMsQ0FBQyxHQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQTtPQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSSxJQUFJLENBQUMsR0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUU7QUFBQyxZQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDO0FBQUMsZUFBSSxJQUFJLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsTUFBTSxJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBRSxFQUFFLEtBQUksSUFBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsR0FBQyxDQUFDLEdBQUMsQ0FBQyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUEsR0FBRSxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFDLENBQUMsQ0FBQSxHQUFFLENBQUMsRUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUMsQ0FBQyxDQUFBLEdBQUUsQ0FBQyxFQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUEsR0FBRSxDQUFDLEVBQUMsQ0FBQyxHQUFDLENBQUMsR0FBRSxDQUFDLElBQUUsQ0FBQyxFQUFDLENBQUMsSUFBRSxDQUFDLEVBQUMsQ0FBQyxJQUFFLENBQUMsRUFBQyxDQUFDLElBQUUsQ0FBQyxFQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMs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Q0FBQyxVQUFTLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDO0FBQUMsU0FBQyxJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxHQUFHLEdBQUMsR0FBRyxFQUFDLENBQUMsSUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUMsR0FBRyxHQUFDLEdBQUcsRUFBQyxDQUFDLElBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFDLEdBQUcsR0FBQyxHQUFHLEVBQUMsQ0FBQyxJQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxHQUFHLENBQUE7T0FBQyxDQUFDLEVBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEVBQUMsRUFBQyxJQUFJLEVBQUMsT0FBTyxFQUFDLFdBQVcsRUFBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUMsQ0FBQyxFQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFDLENBQUMsRUFBQyxTQUFTLEVBQUMsQ0FBQyxFQUFDLEVBQUMsSUFBSSxFQUFDLE9BQU8sRUFBQyxXQUFXLEVBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFDLENBQUMsRUFBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsU0FBUyxFQUFDLENBQUMsRUFBQyxFQUFDLElBQUksRUFBQyxPQUFPLEVBQUMsV0FBVyxFQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBQyxDQUFDLEVBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEVBQUMsRUFBQyxJQUFJLEVBQUMsT0FBTyxFQUFDLFdBQVcsRUFBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUMsQ0FBQyxFQUFDLENBQUMsSUFBRSxDQUFDLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUMsT0FBTyxHQUFDLENBQUMsR0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBQyxDQUFDLENBQUE7S0FBQyxFQUFDLGdCQUFnQixFQUFDLDBCQUFTLENBQUMsRUFBQyxDQUFDLEVBQUM7QUFBQyxVQUFJLENBQUMsR0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztVQUFDLENBQUMsR0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsQ0FBQyxDQUFDO1VBQUMsQ0FBQyxHQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUMsRUFBQyxDQUFDLENBQUMsQ0FBQTtLQUFDLEVBQUMsaUJBQWlCLEVBQUMsMkJBQVMsQ0FBQyxFQUFDO0FBQUMsVUFBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLElBQUcsQ0FBQyxFQUFDO0FBQUMsWUFBSSxDQUFDLEdBQUMsQ0FBQyxDQUFDLGFBQWE7WUFBQyxDQUFDLEdBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFHLENBQUMsRUFBQztBQUFDLGNBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsS0FBRyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsTUFBTSxJQUFFLENBQUMsQ0FBQSxFQUFDO0FBQUMsZ0JBQUksQ0FBQyxHQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtXQUFDO1NBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsR0FBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUMsRUFBRSxDQUFBO09BQUM7S0FBQyxFQUFDLEVBQUMsSUFBSSxDQUFDLEVBQUEsQ0FBQTtDQUFDLENBQUEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLGNBQWMsR0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFlBQVksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLGNBQWMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLGNBQWMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGNBQWMsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFlBQVksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFlBQVksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLG9CQUFvQixFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsU0FBUyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsVUFBVSxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsU0FBUyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsU0FBUyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsV0FBVyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsYUFBYSxFQUFDLENBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsWUFBWSxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsY0FBYyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsY0FBYyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsY0FBYyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsV0FBVyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsU0FBUyxFQUFDLENBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsQ0FBQyxDQUFDLEVBQUMsS0FBSyxFQUFDLENBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsT0FBTyxFQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsQ0FBQyxDQUFDLEVBQUMsTUFBTSxFQUFDLENBQUMsR0FBRyxFQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDLEVBQUMsZ0JBQWdCLEVBQUMsQ0FBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxVQUFVLEVBQUMsQ0FBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxZQUFZLEVBQUMsQ0FBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxZQUFZLEVBQUMsQ0FBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxjQUFjLEVBQUMsQ0FBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxlQUFlLEVBQUMsQ0FBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLEdBQUcsRUFBQyxDQUFDLENBQUMsRUFBQyxpQkFBaUIsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGVBQWUsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGVBQWUsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFlBQVksRUFBQyxDQUFDLEVBQUUsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLENBQUMsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLGFBQWEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUcsRUFBQyxDQUFDLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFFBQVEsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEdBQUcsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLElBQUksRUFBQyxDQUFDLENBQUMsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxFQUFFLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLFNBQVMsRUFBQyxDQUFDLEVBQUUsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLEtBQUssRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLFVBQVUsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxFQUFDLE1BQU0sRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQyxFQUFDLFdBQVcsRUFBQyxDQUFDLEdBQUcsRUFBQyxHQUFHLEVBQUMsRUFBRSxFQUFDLENBQUMsQ0FBQyxFQUFDLENBQUMsSUFBRztBQUFDLFNBQU8sQ0FBQyxhQUFhLEdBQUMsYUFBYSxDQUFBO0NBQUMsQ0FBQSxPQUFNLENBQUMsRUFBQyxFQUFFIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIVxuV2F5cG9pbnRzIC0gNC4wLjBcbkNvcHlyaWdodCDCqSAyMDExLTIwMTUgQ2FsZWIgVHJvdWdodG9uXG5MaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5odHRwczovL2dpdGh1Yi5jb20vaW1ha2V3ZWJ0aGluZ3Mvd2F5cG9pbnRzL2Jsb2IvbWFzdGVyL2xpY2Vuc2VzLnR4dFxuKi9cbihmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgdmFyIGtleUNvdW50ZXIgPSAwXG4gIHZhciBhbGxXYXlwb2ludHMgPSB7fVxuXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS93YXlwb2ludCAqL1xuICBmdW5jdGlvbiBXYXlwb2ludChvcHRpb25zKSB7XG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9wdGlvbnMgcGFzc2VkIHRvIFdheXBvaW50IGNvbnN0cnVjdG9yJylcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLmVsZW1lbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gZWxlbWVudCBvcHRpb24gcGFzc2VkIHRvIFdheXBvaW50IGNvbnN0cnVjdG9yJylcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLmhhbmRsZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTm8gaGFuZGxlciBvcHRpb24gcGFzc2VkIHRvIFdheXBvaW50IGNvbnN0cnVjdG9yJylcbiAgICB9XG5cbiAgICB0aGlzLmtleSA9ICd3YXlwb2ludC0nICsga2V5Q291bnRlclxuICAgIHRoaXMub3B0aW9ucyA9IFdheXBvaW50LkFkYXB0ZXIuZXh0ZW5kKHt9LCBXYXlwb2ludC5kZWZhdWx0cywgb3B0aW9ucylcbiAgICB0aGlzLmVsZW1lbnQgPSB0aGlzLm9wdGlvbnMuZWxlbWVudFxuICAgIHRoaXMuYWRhcHRlciA9IG5ldyBXYXlwb2ludC5BZGFwdGVyKHRoaXMuZWxlbWVudClcbiAgICB0aGlzLmNhbGxiYWNrID0gb3B0aW9ucy5oYW5kbGVyXG4gICAgdGhpcy5heGlzID0gdGhpcy5vcHRpb25zLmhvcml6b250YWwgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnXG4gICAgdGhpcy5lbmFibGVkID0gdGhpcy5vcHRpb25zLmVuYWJsZWRcbiAgICB0aGlzLnRyaWdnZXJQb2ludCA9IG51bGxcbiAgICB0aGlzLmdyb3VwID0gV2F5cG9pbnQuR3JvdXAuZmluZE9yQ3JlYXRlKHtcbiAgICAgIG5hbWU6IHRoaXMub3B0aW9ucy5ncm91cCxcbiAgICAgIGF4aXM6IHRoaXMuYXhpc1xuICAgIH0pXG4gICAgdGhpcy5jb250ZXh0ID0gV2F5cG9pbnQuQ29udGV4dC5maW5kT3JDcmVhdGVCeUVsZW1lbnQodGhpcy5vcHRpb25zLmNvbnRleHQpXG5cbiAgICBpZiAoV2F5cG9pbnQub2Zmc2V0QWxpYXNlc1t0aGlzLm9wdGlvbnMub2Zmc2V0XSkge1xuICAgICAgdGhpcy5vcHRpb25zLm9mZnNldCA9IFdheXBvaW50Lm9mZnNldEFsaWFzZXNbdGhpcy5vcHRpb25zLm9mZnNldF1cbiAgICB9XG4gICAgdGhpcy5ncm91cC5hZGQodGhpcylcbiAgICB0aGlzLmNvbnRleHQuYWRkKHRoaXMpXG4gICAgYWxsV2F5cG9pbnRzW3RoaXMua2V5XSA9IHRoaXNcbiAgICBrZXlDb3VudGVyICs9IDFcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgV2F5cG9pbnQucHJvdG90eXBlLnF1ZXVlVHJpZ2dlciA9IGZ1bmN0aW9uKGRpcmVjdGlvbikge1xuICAgIHRoaXMuZ3JvdXAucXVldWVUcmlnZ2VyKHRoaXMsIGRpcmVjdGlvbilcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgV2F5cG9pbnQucHJvdG90eXBlLnRyaWdnZXIgPSBmdW5jdGlvbihhcmdzKSB7XG4gICAgaWYgKCF0aGlzLmVuYWJsZWQpIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAodGhpcy5jYWxsYmFjaykge1xuICAgICAgdGhpcy5jYWxsYmFjay5hcHBseSh0aGlzLCBhcmdzKVxuICAgIH1cbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvZGVzdHJveSAqL1xuICBXYXlwb2ludC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5yZW1vdmUodGhpcylcbiAgICB0aGlzLmdyb3VwLnJlbW92ZSh0aGlzKVxuICAgIGRlbGV0ZSBhbGxXYXlwb2ludHNbdGhpcy5rZXldXG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2Rpc2FibGUgKi9cbiAgV2F5cG9pbnQucHJvdG90eXBlLmRpc2FibGUgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2VuYWJsZSAqL1xuICBXYXlwb2ludC5wcm90b3R5cGUuZW5hYmxlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LnJlZnJlc2goKVxuICAgIHRoaXMuZW5hYmxlZCA9IHRydWVcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9uZXh0ICovXG4gIFdheXBvaW50LnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZ3JvdXAubmV4dCh0aGlzKVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9wcmV2aW91cyAqL1xuICBXYXlwb2ludC5wcm90b3R5cGUucHJldmlvdXMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5ncm91cC5wcmV2aW91cyh0aGlzKVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBXYXlwb2ludC5pbnZva2VBbGwgPSBmdW5jdGlvbihtZXRob2QpIHtcbiAgICB2YXIgYWxsV2F5cG9pbnRzQXJyYXkgPSBbXVxuICAgIGZvciAodmFyIHdheXBvaW50S2V5IGluIGFsbFdheXBvaW50cykge1xuICAgICAgYWxsV2F5cG9pbnRzQXJyYXkucHVzaChhbGxXYXlwb2ludHNbd2F5cG9pbnRLZXldKVxuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMCwgZW5kID0gYWxsV2F5cG9pbnRzQXJyYXkubGVuZ3RoOyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIGFsbFdheXBvaW50c0FycmF5W2ldW21ldGhvZF0oKVxuICAgIH1cbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvZGVzdHJveS1hbGwgKi9cbiAgV2F5cG9pbnQuZGVzdHJveUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgIFdheXBvaW50Lmludm9rZUFsbCgnZGVzdHJveScpXG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2Rpc2FibGUtYWxsICovXG4gIFdheXBvaW50LmRpc2FibGVBbGwgPSBmdW5jdGlvbigpIHtcbiAgICBXYXlwb2ludC5pbnZva2VBbGwoJ2Rpc2FibGUnKVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9lbmFibGUtYWxsICovXG4gIFdheXBvaW50LmVuYWJsZUFsbCA9IGZ1bmN0aW9uKCkge1xuICAgIFdheXBvaW50Lmludm9rZUFsbCgnZW5hYmxlJylcbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvcmVmcmVzaC1hbGwgKi9cbiAgV2F5cG9pbnQucmVmcmVzaEFsbCA9IGZ1bmN0aW9uKCkge1xuICAgIFdheXBvaW50LkNvbnRleHQucmVmcmVzaEFsbCgpXG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL3ZpZXdwb3J0LWhlaWdodCAqL1xuICBXYXlwb2ludC52aWV3cG9ydEhlaWdodCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB3aW5kb3cuaW5uZXJIZWlnaHQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodFxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS92aWV3cG9ydC13aWR0aCAqL1xuICBXYXlwb2ludC52aWV3cG9ydFdpZHRoID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aFxuICB9XG5cbiAgV2F5cG9pbnQuYWRhcHRlcnMgPSBbXVxuXG4gIFdheXBvaW50LmRlZmF1bHRzID0ge1xuICAgIGNvbnRleHQ6IHdpbmRvdyxcbiAgICBjb250aW51b3VzOiB0cnVlLFxuICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgZ3JvdXA6ICdkZWZhdWx0JyxcbiAgICBob3Jpem9udGFsOiBmYWxzZSxcbiAgICBvZmZzZXQ6IDBcbiAgfVxuXG4gIFdheXBvaW50Lm9mZnNldEFsaWFzZXMgPSB7XG4gICAgJ2JvdHRvbS1pbi12aWV3JzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb250ZXh0LmlubmVySGVpZ2h0KCkgLSB0aGlzLmFkYXB0ZXIub3V0ZXJIZWlnaHQoKVxuICAgIH0sXG4gICAgJ3JpZ2h0LWluLXZpZXcnOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuaW5uZXJXaWR0aCgpIC0gdGhpcy5hZGFwdGVyLm91dGVyV2lkdGgoKVxuICAgIH1cbiAgfVxuXG4gIHdpbmRvdy5XYXlwb2ludCA9IFdheXBvaW50XG59KCkpXG47KGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCdcblxuICBmdW5jdGlvbiByZXF1ZXN0QW5pbWF0aW9uRnJhbWVTaGltKGNhbGxiYWNrKSB7XG4gICAgd2luZG93LnNldFRpbWVvdXQoY2FsbGJhY2ssIDEwMDAgLyA2MClcbiAgfVxuXG4gIHZhciBrZXlDb3VudGVyID0gMFxuICB2YXIgY29udGV4dHMgPSB7fVxuICB2YXIgV2F5cG9pbnQgPSB3aW5kb3cuV2F5cG9pbnRcbiAgdmFyIG9sZFdpbmRvd0xvYWQgPSB3aW5kb3cub25sb2FkXG5cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2NvbnRleHQgKi9cbiAgZnVuY3Rpb24gQ29udGV4dChlbGVtZW50KSB7XG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudFxuICAgIHRoaXMuQWRhcHRlciA9IFdheXBvaW50LkFkYXB0ZXJcbiAgICB0aGlzLmFkYXB0ZXIgPSBuZXcgdGhpcy5BZGFwdGVyKGVsZW1lbnQpXG4gICAgdGhpcy5rZXkgPSAnd2F5cG9pbnQtY29udGV4dC0nICsga2V5Q291bnRlclxuICAgIHRoaXMuZGlkU2Nyb2xsID0gZmFsc2VcbiAgICB0aGlzLmRpZFJlc2l6ZSA9IGZhbHNlXG4gICAgdGhpcy5vbGRTY3JvbGwgPSB7XG4gICAgICB4OiB0aGlzLmFkYXB0ZXIuc2Nyb2xsTGVmdCgpLFxuICAgICAgeTogdGhpcy5hZGFwdGVyLnNjcm9sbFRvcCgpXG4gICAgfVxuICAgIHRoaXMud2F5cG9pbnRzID0ge1xuICAgICAgdmVydGljYWw6IHt9LFxuICAgICAgaG9yaXpvbnRhbDoge31cbiAgICB9XG5cbiAgICBlbGVtZW50LndheXBvaW50Q29udGV4dEtleSA9IHRoaXMua2V5XG4gICAgY29udGV4dHNbZWxlbWVudC53YXlwb2ludENvbnRleHRLZXldID0gdGhpc1xuICAgIGtleUNvdW50ZXIgKz0gMVxuXG4gICAgdGhpcy5jcmVhdGVUaHJvdHRsZWRTY3JvbGxIYW5kbGVyKClcbiAgICB0aGlzLmNyZWF0ZVRocm90dGxlZFJlc2l6ZUhhbmRsZXIoKVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBDb250ZXh0LnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbih3YXlwb2ludCkge1xuICAgIHZhciBheGlzID0gd2F5cG9pbnQub3B0aW9ucy5ob3Jpem9udGFsID8gJ2hvcml6b250YWwnIDogJ3ZlcnRpY2FsJ1xuICAgIHRoaXMud2F5cG9pbnRzW2F4aXNdW3dheXBvaW50LmtleV0gPSB3YXlwb2ludFxuICAgIHRoaXMucmVmcmVzaCgpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmNoZWNrRW1wdHkgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaG9yaXpvbnRhbEVtcHR5ID0gdGhpcy5BZGFwdGVyLmlzRW1wdHlPYmplY3QodGhpcy53YXlwb2ludHMuaG9yaXpvbnRhbClcbiAgICB2YXIgdmVydGljYWxFbXB0eSA9IHRoaXMuQWRhcHRlci5pc0VtcHR5T2JqZWN0KHRoaXMud2F5cG9pbnRzLnZlcnRpY2FsKVxuICAgIGlmIChob3Jpem9udGFsRW1wdHkgJiYgdmVydGljYWxFbXB0eSkge1xuICAgICAgdGhpcy5hZGFwdGVyLm9mZignLndheXBvaW50cycpXG4gICAgICBkZWxldGUgY29udGV4dHNbdGhpcy5rZXldXG4gICAgfVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBDb250ZXh0LnByb3RvdHlwZS5jcmVhdGVUaHJvdHRsZWRSZXNpemVIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG5cbiAgICBmdW5jdGlvbiByZXNpemVIYW5kbGVyKCkge1xuICAgICAgc2VsZi5oYW5kbGVSZXNpemUoKVxuICAgICAgc2VsZi5kaWRSZXNpemUgPSBmYWxzZVxuICAgIH1cblxuICAgIHRoaXMuYWRhcHRlci5vbigncmVzaXplLndheXBvaW50cycsIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCFzZWxmLmRpZFJlc2l6ZSkge1xuICAgICAgICBzZWxmLmRpZFJlc2l6ZSA9IHRydWVcbiAgICAgICAgV2F5cG9pbnQucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlc2l6ZUhhbmRsZXIpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuY3JlYXRlVGhyb3R0bGVkU2Nyb2xsSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpc1xuICAgIGZ1bmN0aW9uIHNjcm9sbEhhbmRsZXIoKSB7XG4gICAgICBzZWxmLmhhbmRsZVNjcm9sbCgpXG4gICAgICBzZWxmLmRpZFNjcm9sbCA9IGZhbHNlXG4gICAgfVxuXG4gICAgdGhpcy5hZGFwdGVyLm9uKCdzY3JvbGwud2F5cG9pbnRzJywgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXNlbGYuZGlkU2Nyb2xsIHx8IFdheXBvaW50LmlzVG91Y2gpIHtcbiAgICAgICAgc2VsZi5kaWRTY3JvbGwgPSB0cnVlXG4gICAgICAgIFdheXBvaW50LnJlcXVlc3RBbmltYXRpb25GcmFtZShzY3JvbGxIYW5kbGVyKVxuICAgICAgfVxuICAgIH0pXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmhhbmRsZVJlc2l6ZSA9IGZ1bmN0aW9uKCkge1xuICAgIFdheXBvaW50LkNvbnRleHQucmVmcmVzaEFsbCgpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmhhbmRsZVNjcm9sbCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0cmlnZ2VyZWRHcm91cHMgPSB7fVxuICAgIHZhciBheGVzID0ge1xuICAgICAgaG9yaXpvbnRhbDoge1xuICAgICAgICBuZXdTY3JvbGw6IHRoaXMuYWRhcHRlci5zY3JvbGxMZWZ0KCksXG4gICAgICAgIG9sZFNjcm9sbDogdGhpcy5vbGRTY3JvbGwueCxcbiAgICAgICAgZm9yd2FyZDogJ3JpZ2h0JyxcbiAgICAgICAgYmFja3dhcmQ6ICdsZWZ0J1xuICAgICAgfSxcbiAgICAgIHZlcnRpY2FsOiB7XG4gICAgICAgIG5ld1Njcm9sbDogdGhpcy5hZGFwdGVyLnNjcm9sbFRvcCgpLFxuICAgICAgICBvbGRTY3JvbGw6IHRoaXMub2xkU2Nyb2xsLnksXG4gICAgICAgIGZvcndhcmQ6ICdkb3duJyxcbiAgICAgICAgYmFja3dhcmQ6ICd1cCdcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBheGlzS2V5IGluIGF4ZXMpIHtcbiAgICAgIHZhciBheGlzID0gYXhlc1theGlzS2V5XVxuICAgICAgdmFyIGlzRm9yd2FyZCA9IGF4aXMubmV3U2Nyb2xsID4gYXhpcy5vbGRTY3JvbGxcbiAgICAgIHZhciBkaXJlY3Rpb24gPSBpc0ZvcndhcmQgPyBheGlzLmZvcndhcmQgOiBheGlzLmJhY2t3YXJkXG5cbiAgICAgIGZvciAodmFyIHdheXBvaW50S2V5IGluIHRoaXMud2F5cG9pbnRzW2F4aXNLZXldKSB7XG4gICAgICAgIHZhciB3YXlwb2ludCA9IHRoaXMud2F5cG9pbnRzW2F4aXNLZXldW3dheXBvaW50S2V5XVxuICAgICAgICB2YXIgd2FzQmVmb3JlVHJpZ2dlclBvaW50ID0gYXhpcy5vbGRTY3JvbGwgPCB3YXlwb2ludC50cmlnZ2VyUG9pbnRcbiAgICAgICAgdmFyIG5vd0FmdGVyVHJpZ2dlclBvaW50ID0gYXhpcy5uZXdTY3JvbGwgPj0gd2F5cG9pbnQudHJpZ2dlclBvaW50XG4gICAgICAgIHZhciBjcm9zc2VkRm9yd2FyZCA9IHdhc0JlZm9yZVRyaWdnZXJQb2ludCAmJiBub3dBZnRlclRyaWdnZXJQb2ludFxuICAgICAgICB2YXIgY3Jvc3NlZEJhY2t3YXJkID0gIXdhc0JlZm9yZVRyaWdnZXJQb2ludCAmJiAhbm93QWZ0ZXJUcmlnZ2VyUG9pbnRcbiAgICAgICAgaWYgKGNyb3NzZWRGb3J3YXJkIHx8IGNyb3NzZWRCYWNrd2FyZCkge1xuICAgICAgICAgIHdheXBvaW50LnF1ZXVlVHJpZ2dlcihkaXJlY3Rpb24pXG4gICAgICAgICAgdHJpZ2dlcmVkR3JvdXBzW3dheXBvaW50Lmdyb3VwLmlkXSA9IHdheXBvaW50Lmdyb3VwXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBncm91cEtleSBpbiB0cmlnZ2VyZWRHcm91cHMpIHtcbiAgICAgIHRyaWdnZXJlZEdyb3Vwc1tncm91cEtleV0uZmx1c2hUcmlnZ2VycygpXG4gICAgfVxuXG4gICAgdGhpcy5vbGRTY3JvbGwgPSB7XG4gICAgICB4OiBheGVzLmhvcml6b250YWwubmV3U2Nyb2xsLFxuICAgICAgeTogYXhlcy52ZXJ0aWNhbC5uZXdTY3JvbGxcbiAgICB9XG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmlubmVySGVpZ2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgLyplc2xpbnQtZGlzYWJsZSBlcWVxZXEgKi9cbiAgICBpZiAodGhpcy5lbGVtZW50ID09IHRoaXMuZWxlbWVudC53aW5kb3cpIHtcbiAgICAgIHJldHVybiBXYXlwb2ludC52aWV3cG9ydEhlaWdodCgpXG4gICAgfVxuICAgIC8qZXNsaW50LWVuYWJsZSBlcWVxZXEgKi9cbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmlubmVySGVpZ2h0KClcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24od2F5cG9pbnQpIHtcbiAgICBkZWxldGUgdGhpcy53YXlwb2ludHNbd2F5cG9pbnQuYXhpc11bd2F5cG9pbnQua2V5XVxuICAgIHRoaXMuY2hlY2tFbXB0eSgpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmlubmVyV2lkdGggPSBmdW5jdGlvbigpIHtcbiAgICAvKmVzbGludC1kaXNhYmxlIGVxZXFlcSAqL1xuICAgIGlmICh0aGlzLmVsZW1lbnQgPT0gdGhpcy5lbGVtZW50LndpbmRvdykge1xuICAgICAgcmV0dXJuIFdheXBvaW50LnZpZXdwb3J0V2lkdGgoKVxuICAgIH1cbiAgICAvKmVzbGludC1lbmFibGUgZXFlcWVxICovXG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlci5pbm5lcldpZHRoKClcbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvY29udGV4dC1kZXN0cm95ICovXG4gIENvbnRleHQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYWxsV2F5cG9pbnRzID0gW11cbiAgICBmb3IgKHZhciBheGlzIGluIHRoaXMud2F5cG9pbnRzKSB7XG4gICAgICBmb3IgKHZhciB3YXlwb2ludEtleSBpbiB0aGlzLndheXBvaW50c1theGlzXSkge1xuICAgICAgICBhbGxXYXlwb2ludHMucHVzaCh0aGlzLndheXBvaW50c1theGlzXVt3YXlwb2ludEtleV0pXG4gICAgICB9XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwLCBlbmQgPSBhbGxXYXlwb2ludHMubGVuZ3RoOyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIGFsbFdheXBvaW50c1tpXS5kZXN0cm95KClcbiAgICB9XG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2NvbnRleHQtcmVmcmVzaCAqL1xuICBDb250ZXh0LnByb3RvdHlwZS5yZWZyZXNoID0gZnVuY3Rpb24oKSB7XG4gICAgLyplc2xpbnQtZGlzYWJsZSBlcWVxZXEgKi9cbiAgICB2YXIgaXNXaW5kb3cgPSB0aGlzLmVsZW1lbnQgPT0gdGhpcy5lbGVtZW50LndpbmRvd1xuICAgIC8qZXNsaW50LWVuYWJsZSBlcWVxZXEgKi9cbiAgICB2YXIgY29udGV4dE9mZnNldCA9IGlzV2luZG93ID8gdW5kZWZpbmVkIDogdGhpcy5hZGFwdGVyLm9mZnNldCgpXG4gICAgdmFyIHRyaWdnZXJlZEdyb3VwcyA9IHt9XG4gICAgdmFyIGF4ZXNcblxuICAgIHRoaXMuaGFuZGxlU2Nyb2xsKClcbiAgICBheGVzID0ge1xuICAgICAgaG9yaXpvbnRhbDoge1xuICAgICAgICBjb250ZXh0T2Zmc2V0OiBpc1dpbmRvdyA/IDAgOiBjb250ZXh0T2Zmc2V0LmxlZnQsXG4gICAgICAgIGNvbnRleHRTY3JvbGw6IGlzV2luZG93ID8gMCA6IHRoaXMub2xkU2Nyb2xsLngsXG4gICAgICAgIGNvbnRleHREaW1lbnNpb246IHRoaXMuaW5uZXJXaWR0aCgpLFxuICAgICAgICBvbGRTY3JvbGw6IHRoaXMub2xkU2Nyb2xsLngsXG4gICAgICAgIGZvcndhcmQ6ICdyaWdodCcsXG4gICAgICAgIGJhY2t3YXJkOiAnbGVmdCcsXG4gICAgICAgIG9mZnNldFByb3A6ICdsZWZ0J1xuICAgICAgfSxcbiAgICAgIHZlcnRpY2FsOiB7XG4gICAgICAgIGNvbnRleHRPZmZzZXQ6IGlzV2luZG93ID8gMCA6IGNvbnRleHRPZmZzZXQudG9wLFxuICAgICAgICBjb250ZXh0U2Nyb2xsOiBpc1dpbmRvdyA/IDAgOiB0aGlzLm9sZFNjcm9sbC55LFxuICAgICAgICBjb250ZXh0RGltZW5zaW9uOiB0aGlzLmlubmVySGVpZ2h0KCksXG4gICAgICAgIG9sZFNjcm9sbDogdGhpcy5vbGRTY3JvbGwueSxcbiAgICAgICAgZm9yd2FyZDogJ2Rvd24nLFxuICAgICAgICBiYWNrd2FyZDogJ3VwJyxcbiAgICAgICAgb2Zmc2V0UHJvcDogJ3RvcCdcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKHZhciBheGlzS2V5IGluIGF4ZXMpIHtcbiAgICAgIHZhciBheGlzID0gYXhlc1theGlzS2V5XVxuICAgICAgZm9yICh2YXIgd2F5cG9pbnRLZXkgaW4gdGhpcy53YXlwb2ludHNbYXhpc0tleV0pIHtcbiAgICAgICAgdmFyIHdheXBvaW50ID0gdGhpcy53YXlwb2ludHNbYXhpc0tleV1bd2F5cG9pbnRLZXldXG4gICAgICAgIHZhciBhZGp1c3RtZW50ID0gd2F5cG9pbnQub3B0aW9ucy5vZmZzZXRcbiAgICAgICAgdmFyIG9sZFRyaWdnZXJQb2ludCA9IHdheXBvaW50LnRyaWdnZXJQb2ludFxuICAgICAgICB2YXIgZWxlbWVudE9mZnNldCA9IDBcbiAgICAgICAgdmFyIGZyZXNoV2F5cG9pbnQgPSBvbGRUcmlnZ2VyUG9pbnQgPT0gbnVsbFxuICAgICAgICB2YXIgY29udGV4dE1vZGlmaWVyLCB3YXNCZWZvcmVTY3JvbGwsIG5vd0FmdGVyU2Nyb2xsXG4gICAgICAgIHZhciB0cmlnZ2VyZWRCYWNrd2FyZCwgdHJpZ2dlcmVkRm9yd2FyZFxuXG4gICAgICAgIGlmICh3YXlwb2ludC5lbGVtZW50ICE9PSB3YXlwb2ludC5lbGVtZW50LndpbmRvdykge1xuICAgICAgICAgIGVsZW1lbnRPZmZzZXQgPSB3YXlwb2ludC5hZGFwdGVyLm9mZnNldCgpW2F4aXMub2Zmc2V0UHJvcF1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgYWRqdXN0bWVudCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGFkanVzdG1lbnQgPSBhZGp1c3RtZW50LmFwcGx5KHdheXBvaW50KVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBhZGp1c3RtZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIGFkanVzdG1lbnQgPSBwYXJzZUZsb2F0KGFkanVzdG1lbnQpXG4gICAgICAgICAgaWYgKHdheXBvaW50Lm9wdGlvbnMub2Zmc2V0LmluZGV4T2YoJyUnKSA+IC0gMSkge1xuICAgICAgICAgICAgYWRqdXN0bWVudCA9IE1hdGguY2VpbChheGlzLmNvbnRleHREaW1lbnNpb24gKiBhZGp1c3RtZW50IC8gMTAwKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRleHRNb2RpZmllciA9IGF4aXMuY29udGV4dFNjcm9sbCAtIGF4aXMuY29udGV4dE9mZnNldFxuICAgICAgICB3YXlwb2ludC50cmlnZ2VyUG9pbnQgPSBlbGVtZW50T2Zmc2V0ICsgY29udGV4dE1vZGlmaWVyIC0gYWRqdXN0bWVudFxuICAgICAgICB3YXNCZWZvcmVTY3JvbGwgPSBvbGRUcmlnZ2VyUG9pbnQgPCBheGlzLm9sZFNjcm9sbFxuICAgICAgICBub3dBZnRlclNjcm9sbCA9IHdheXBvaW50LnRyaWdnZXJQb2ludCA+PSBheGlzLm9sZFNjcm9sbFxuICAgICAgICB0cmlnZ2VyZWRCYWNrd2FyZCA9IHdhc0JlZm9yZVNjcm9sbCAmJiBub3dBZnRlclNjcm9sbFxuICAgICAgICB0cmlnZ2VyZWRGb3J3YXJkID0gIXdhc0JlZm9yZVNjcm9sbCAmJiAhbm93QWZ0ZXJTY3JvbGxcblxuICAgICAgICBpZiAoIWZyZXNoV2F5cG9pbnQgJiYgdHJpZ2dlcmVkQmFja3dhcmQpIHtcbiAgICAgICAgICB3YXlwb2ludC5xdWV1ZVRyaWdnZXIoYXhpcy5iYWNrd2FyZClcbiAgICAgICAgICB0cmlnZ2VyZWRHcm91cHNbd2F5cG9pbnQuZ3JvdXAuaWRdID0gd2F5cG9pbnQuZ3JvdXBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghZnJlc2hXYXlwb2ludCAmJiB0cmlnZ2VyZWRGb3J3YXJkKSB7XG4gICAgICAgICAgd2F5cG9pbnQucXVldWVUcmlnZ2VyKGF4aXMuZm9yd2FyZClcbiAgICAgICAgICB0cmlnZ2VyZWRHcm91cHNbd2F5cG9pbnQuZ3JvdXAuaWRdID0gd2F5cG9pbnQuZ3JvdXBcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChmcmVzaFdheXBvaW50ICYmIGF4aXMub2xkU2Nyb2xsID49IHdheXBvaW50LnRyaWdnZXJQb2ludCkge1xuICAgICAgICAgIHdheXBvaW50LnF1ZXVlVHJpZ2dlcihheGlzLmZvcndhcmQpXG4gICAgICAgICAgdHJpZ2dlcmVkR3JvdXBzW3dheXBvaW50Lmdyb3VwLmlkXSA9IHdheXBvaW50Lmdyb3VwXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBXYXlwb2ludC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZnVuY3Rpb24oKSB7XG4gICAgICBmb3IgKHZhciBncm91cEtleSBpbiB0cmlnZ2VyZWRHcm91cHMpIHtcbiAgICAgICAgdHJpZ2dlcmVkR3JvdXBzW2dyb3VwS2V5XS5mbHVzaFRyaWdnZXJzKClcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5maW5kT3JDcmVhdGVCeUVsZW1lbnQgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgcmV0dXJuIENvbnRleHQuZmluZEJ5RWxlbWVudChlbGVtZW50KSB8fCBuZXcgQ29udGV4dChlbGVtZW50KVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBDb250ZXh0LnJlZnJlc2hBbGwgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBjb250ZXh0SWQgaW4gY29udGV4dHMpIHtcbiAgICAgIGNvbnRleHRzW2NvbnRleHRJZF0ucmVmcmVzaCgpXG4gICAgfVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9jb250ZXh0LWZpbmQtYnktZWxlbWVudCAqL1xuICBDb250ZXh0LmZpbmRCeUVsZW1lbnQgPSBmdW5jdGlvbihlbGVtZW50KSB7XG4gICAgcmV0dXJuIGNvbnRleHRzW2VsZW1lbnQud2F5cG9pbnRDb250ZXh0S2V5XVxuICB9XG5cbiAgd2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChvbGRXaW5kb3dMb2FkKSB7XG4gICAgICBvbGRXaW5kb3dMb2FkKClcbiAgICB9XG4gICAgQ29udGV4dC5yZWZyZXNoQWxsKClcbiAgfVxuXG4gIFdheXBvaW50LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdmFyIHJlcXVlc3RGbiA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHdpbmRvdy5tb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZVNoaW1cbiAgICByZXF1ZXN0Rm4uY2FsbCh3aW5kb3csIGNhbGxiYWNrKVxuICB9XG4gIFdheXBvaW50LkNvbnRleHQgPSBDb250ZXh0XG59KCkpXG47KGZ1bmN0aW9uKCkge1xuICAndXNlIHN0cmljdCdcblxuICBmdW5jdGlvbiBieVRyaWdnZXJQb2ludChhLCBiKSB7XG4gICAgcmV0dXJuIGEudHJpZ2dlclBvaW50IC0gYi50cmlnZ2VyUG9pbnRcbiAgfVxuXG4gIGZ1bmN0aW9uIGJ5UmV2ZXJzZVRyaWdnZXJQb2ludChhLCBiKSB7XG4gICAgcmV0dXJuIGIudHJpZ2dlclBvaW50IC0gYS50cmlnZ2VyUG9pbnRcbiAgfVxuXG4gIHZhciBncm91cHMgPSB7XG4gICAgdmVydGljYWw6IHt9LFxuICAgIGhvcml6b250YWw6IHt9XG4gIH1cbiAgdmFyIFdheXBvaW50ID0gd2luZG93LldheXBvaW50XG5cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2dyb3VwICovXG4gIGZ1bmN0aW9uIEdyb3VwKG9wdGlvbnMpIHtcbiAgICB0aGlzLm5hbWUgPSBvcHRpb25zLm5hbWVcbiAgICB0aGlzLmF4aXMgPSBvcHRpb25zLmF4aXNcbiAgICB0aGlzLmlkID0gdGhpcy5uYW1lICsgJy0nICsgdGhpcy5heGlzXG4gICAgdGhpcy53YXlwb2ludHMgPSBbXVxuICAgIHRoaXMuY2xlYXJUcmlnZ2VyUXVldWVzKClcbiAgICBncm91cHNbdGhpcy5heGlzXVt0aGlzLm5hbWVdID0gdGhpc1xuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBHcm91cC5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24od2F5cG9pbnQpIHtcbiAgICB0aGlzLndheXBvaW50cy5wdXNoKHdheXBvaW50KVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBHcm91cC5wcm90b3R5cGUuY2xlYXJUcmlnZ2VyUXVldWVzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy50cmlnZ2VyUXVldWVzID0ge1xuICAgICAgdXA6IFtdLFxuICAgICAgZG93bjogW10sXG4gICAgICBsZWZ0OiBbXSxcbiAgICAgIHJpZ2h0OiBbXVxuICAgIH1cbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgR3JvdXAucHJvdG90eXBlLmZsdXNoVHJpZ2dlcnMgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBkaXJlY3Rpb24gaW4gdGhpcy50cmlnZ2VyUXVldWVzKSB7XG4gICAgICB2YXIgd2F5cG9pbnRzID0gdGhpcy50cmlnZ2VyUXVldWVzW2RpcmVjdGlvbl1cbiAgICAgIHZhciByZXZlcnNlID0gZGlyZWN0aW9uID09PSAndXAnIHx8IGRpcmVjdGlvbiA9PT0gJ2xlZnQnXG4gICAgICB3YXlwb2ludHMuc29ydChyZXZlcnNlID8gYnlSZXZlcnNlVHJpZ2dlclBvaW50IDogYnlUcmlnZ2VyUG9pbnQpXG4gICAgICBmb3IgKHZhciBpID0gMCwgZW5kID0gd2F5cG9pbnRzLmxlbmd0aDsgaSA8IGVuZDsgaSArPSAxKSB7XG4gICAgICAgIHZhciB3YXlwb2ludCA9IHdheXBvaW50c1tpXVxuICAgICAgICBpZiAod2F5cG9pbnQub3B0aW9ucy5jb250aW51b3VzIHx8IGkgPT09IHdheXBvaW50cy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgd2F5cG9pbnQudHJpZ2dlcihbZGlyZWN0aW9uXSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNsZWFyVHJpZ2dlclF1ZXVlcygpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIEdyb3VwLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24od2F5cG9pbnQpIHtcbiAgICB0aGlzLndheXBvaW50cy5zb3J0KGJ5VHJpZ2dlclBvaW50KVxuICAgIHZhciBpbmRleCA9IFdheXBvaW50LkFkYXB0ZXIuaW5BcnJheSh3YXlwb2ludCwgdGhpcy53YXlwb2ludHMpXG4gICAgdmFyIGlzTGFzdCA9IGluZGV4ID09PSB0aGlzLndheXBvaW50cy5sZW5ndGggLSAxXG4gICAgcmV0dXJuIGlzTGFzdCA/IG51bGwgOiB0aGlzLndheXBvaW50c1tpbmRleCArIDFdXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIEdyb3VwLnByb3RvdHlwZS5wcmV2aW91cyA9IGZ1bmN0aW9uKHdheXBvaW50KSB7XG4gICAgdGhpcy53YXlwb2ludHMuc29ydChieVRyaWdnZXJQb2ludClcbiAgICB2YXIgaW5kZXggPSBXYXlwb2ludC5BZGFwdGVyLmluQXJyYXkod2F5cG9pbnQsIHRoaXMud2F5cG9pbnRzKVxuICAgIHJldHVybiBpbmRleCA/IHRoaXMud2F5cG9pbnRzW2luZGV4IC0gMV0gOiBudWxsXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIEdyb3VwLnByb3RvdHlwZS5xdWV1ZVRyaWdnZXIgPSBmdW5jdGlvbih3YXlwb2ludCwgZGlyZWN0aW9uKSB7XG4gICAgdGhpcy50cmlnZ2VyUXVldWVzW2RpcmVjdGlvbl0ucHVzaCh3YXlwb2ludClcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgR3JvdXAucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uKHdheXBvaW50KSB7XG4gICAgdmFyIGluZGV4ID0gV2F5cG9pbnQuQWRhcHRlci5pbkFycmF5KHdheXBvaW50LCB0aGlzLndheXBvaW50cylcbiAgICBpZiAoaW5kZXggPiAtMSkge1xuICAgICAgdGhpcy53YXlwb2ludHMuc3BsaWNlKGluZGV4LCAxKVxuICAgIH1cbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvZmlyc3QgKi9cbiAgR3JvdXAucHJvdG90eXBlLmZpcnN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMud2F5cG9pbnRzWzBdXG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2xhc3QgKi9cbiAgR3JvdXAucHJvdG90eXBlLmxhc3QgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy53YXlwb2ludHNbdGhpcy53YXlwb2ludHMubGVuZ3RoIC0gMV1cbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgR3JvdXAuZmluZE9yQ3JlYXRlID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICAgIHJldHVybiBncm91cHNbb3B0aW9ucy5heGlzXVtvcHRpb25zLm5hbWVdIHx8IG5ldyBHcm91cChvcHRpb25zKVxuICB9XG5cbiAgV2F5cG9pbnQuR3JvdXAgPSBHcm91cFxufSgpKVxuOyhmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgdmFyIFdheXBvaW50ID0gd2luZG93LldheXBvaW50XG5cbiAgZnVuY3Rpb24gaXNXaW5kb3coZWxlbWVudCkge1xuICAgIHJldHVybiBlbGVtZW50ID09PSBlbGVtZW50LndpbmRvd1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0V2luZG93KGVsZW1lbnQpIHtcbiAgICBpZiAoaXNXaW5kb3coZWxlbWVudCkpIHtcbiAgICAgIHJldHVybiBlbGVtZW50XG4gICAgfVxuICAgIHJldHVybiBlbGVtZW50LmRlZmF1bHRWaWV3XG4gIH1cblxuICBmdW5jdGlvbiBOb0ZyYW1ld29ya0FkYXB0ZXIoZWxlbWVudCkge1xuICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnRcbiAgICB0aGlzLmhhbmRsZXJzID0ge31cbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUuaW5uZXJIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXNXaW4gPSBpc1dpbmRvdyh0aGlzLmVsZW1lbnQpXG4gICAgcmV0dXJuIGlzV2luID8gdGhpcy5lbGVtZW50LmlubmVySGVpZ2h0IDogdGhpcy5lbGVtZW50LmNsaWVudEhlaWdodFxuICB9XG5cbiAgTm9GcmFtZXdvcmtBZGFwdGVyLnByb3RvdHlwZS5pbm5lcldpZHRoID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGlzV2luID0gaXNXaW5kb3codGhpcy5lbGVtZW50KVxuICAgIHJldHVybiBpc1dpbiA/IHRoaXMuZWxlbWVudC5pbm5lcldpZHRoIDogdGhpcy5lbGVtZW50LmNsaWVudFdpZHRoXG4gIH1cblxuICBOb0ZyYW1ld29ya0FkYXB0ZXIucHJvdG90eXBlLm9mZiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XG4gICAgZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXJzKGVsZW1lbnQsIGxpc3RlbmVycywgaGFuZGxlcikge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGVuZCA9IGxpc3RlbmVycy5sZW5ndGggLSAxOyBpIDwgZW5kOyBpKyspIHtcbiAgICAgICAgdmFyIGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldXG4gICAgICAgIGlmICghaGFuZGxlciB8fCBoYW5kbGVyID09PSBsaXN0ZW5lcikge1xuICAgICAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihsaXN0ZW5lcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBldmVudFBhcnRzID0gZXZlbnQuc3BsaXQoJy4nKVxuICAgIHZhciBldmVudFR5cGUgPSBldmVudFBhcnRzWzBdXG4gICAgdmFyIG5hbWVzcGFjZSA9IGV2ZW50UGFydHNbMV1cbiAgICB2YXIgZWxlbWVudCA9IHRoaXMuZWxlbWVudFxuXG4gICAgaWYgKG5hbWVzcGFjZSAmJiB0aGlzLmhhbmRsZXJzW25hbWVzcGFjZV0gJiYgZXZlbnRUeXBlKSB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoZWxlbWVudCwgdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdW2V2ZW50VHlwZV0sIGhhbmRsZXIpXG4gICAgICB0aGlzLmhhbmRsZXJzW25hbWVzcGFjZV1bZXZlbnRUeXBlXSA9IFtdXG4gICAgfVxuICAgIGVsc2UgaWYgKGV2ZW50VHlwZSkge1xuICAgICAgZm9yICh2YXIgbnMgaW4gdGhpcy5oYW5kbGVycykge1xuICAgICAgICByZW1vdmVMaXN0ZW5lcnMoZWxlbWVudCwgdGhpcy5oYW5kbGVyc1tuc11bZXZlbnRUeXBlXSB8fCBbXSwgaGFuZGxlcilcbiAgICAgICAgdGhpcy5oYW5kbGVyc1tuc11bZXZlbnRUeXBlXSA9IFtdXG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgaWYgKG5hbWVzcGFjZSAmJiB0aGlzLmhhbmRsZXJzW25hbWVzcGFjZV0pIHtcbiAgICAgIGZvciAodmFyIHR5cGUgaW4gdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdKSB7XG4gICAgICAgIHJlbW92ZUxpc3RlbmVycyhlbGVtZW50LCB0aGlzLmhhbmRsZXJzW25hbWVzcGFjZV1bdHlwZV0sIGhhbmRsZXIpXG4gICAgICB9XG4gICAgICB0aGlzLmhhbmRsZXJzW25hbWVzcGFjZV0gPSB7fVxuICAgIH1cbiAgfVxuXG4gIC8qIEFkYXB0ZWQgZnJvbSBqUXVlcnkgMS54IG9mZnNldCgpICovXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUub2Zmc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCF0aGlzLmVsZW1lbnQub3duZXJEb2N1bWVudCkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgZG9jdW1lbnRFbGVtZW50ID0gdGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XG4gICAgdmFyIHdpbiA9IGdldFdpbmRvdyh0aGlzLmVsZW1lbnQub3duZXJEb2N1bWVudClcbiAgICB2YXIgcmVjdCA9IHtcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDBcbiAgICB9XG5cbiAgICBpZiAodGhpcy5lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCkge1xuICAgICAgcmVjdCA9IHRoaXMuZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB0b3A6IHJlY3QudG9wICsgd2luLnBhZ2VZT2Zmc2V0IC0gZG9jdW1lbnRFbGVtZW50LmNsaWVudFRvcCxcbiAgICAgIGxlZnQ6IHJlY3QubGVmdCArIHdpbi5wYWdlWE9mZnNldCAtIGRvY3VtZW50RWxlbWVudC5jbGllbnRMZWZ0XG4gICAgfVxuICB9XG5cbiAgTm9GcmFtZXdvcmtBZGFwdGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2ZW50LCBoYW5kbGVyKSB7XG4gICAgdmFyIGV2ZW50UGFydHMgPSBldmVudC5zcGxpdCgnLicpXG4gICAgdmFyIGV2ZW50VHlwZSA9IGV2ZW50UGFydHNbMF1cbiAgICB2YXIgbmFtZXNwYWNlID0gZXZlbnRQYXJ0c1sxXSB8fCAnX19kZWZhdWx0J1xuICAgIHZhciBuc0hhbmRsZXJzID0gdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdID0gdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdIHx8IHt9XG4gICAgdmFyIG5zVHlwZUxpc3QgPSBuc0hhbmRsZXJzW2V2ZW50VHlwZV0gPSBuc0hhbmRsZXJzW2V2ZW50VHlwZV0gfHwgW11cblxuICAgIG5zVHlwZUxpc3QucHVzaChoYW5kbGVyKVxuICAgIHRoaXMuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgaGFuZGxlcilcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUub3V0ZXJIZWlnaHQgPSBmdW5jdGlvbihpbmNsdWRlTWFyZ2luKSB7XG4gICAgdmFyIGhlaWdodCA9IHRoaXMuaW5uZXJIZWlnaHQoKVxuICAgIHZhciBjb21wdXRlZFN0eWxlXG5cbiAgICBpZiAoaW5jbHVkZU1hcmdpbiAmJiAhaXNXaW5kb3codGhpcy5lbGVtZW50KSkge1xuICAgICAgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudClcbiAgICAgIGhlaWdodCArPSBwYXJzZUludChjb21wdXRlZFN0eWxlLm1hcmdpblRvcCwgMTApXG4gICAgICBoZWlnaHQgKz0gcGFyc2VJbnQoY29tcHV0ZWRTdHlsZS5tYXJnaW5Cb3R0b20sIDEwKVxuICAgIH1cblxuICAgIHJldHVybiBoZWlnaHRcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUub3V0ZXJXaWR0aCA9IGZ1bmN0aW9uKGluY2x1ZGVNYXJnaW4pIHtcbiAgICB2YXIgd2lkdGggPSB0aGlzLmlubmVyV2lkdGgoKVxuICAgIHZhciBjb21wdXRlZFN0eWxlXG5cbiAgICBpZiAoaW5jbHVkZU1hcmdpbiAmJiAhaXNXaW5kb3codGhpcy5lbGVtZW50KSkge1xuICAgICAgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRoaXMuZWxlbWVudClcbiAgICAgIHdpZHRoICs9IHBhcnNlSW50KGNvbXB1dGVkU3R5bGUubWFyZ2luTGVmdCwgMTApXG4gICAgICB3aWR0aCArPSBwYXJzZUludChjb21wdXRlZFN0eWxlLm1hcmdpblJpZ2h0LCAxMClcbiAgICB9XG5cbiAgICByZXR1cm4gd2lkdGhcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUuc2Nyb2xsTGVmdCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB3aW4gPSBnZXRXaW5kb3codGhpcy5lbGVtZW50KVxuICAgIHJldHVybiB3aW4gPyB3aW4ucGFnZVhPZmZzZXQgOiB0aGlzLmVsZW1lbnQuc2Nyb2xsTGVmdFxuICB9XG5cbiAgTm9GcmFtZXdvcmtBZGFwdGVyLnByb3RvdHlwZS5zY3JvbGxUb3AgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgd2luID0gZ2V0V2luZG93KHRoaXMuZWxlbWVudClcbiAgICByZXR1cm4gd2luID8gd2luLnBhZ2VZT2Zmc2V0IDogdGhpcy5lbGVtZW50LnNjcm9sbFRvcFxuICB9XG5cbiAgTm9GcmFtZXdvcmtBZGFwdGVyLmV4dGVuZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKVxuXG4gICAgZnVuY3Rpb24gbWVyZ2UodGFyZ2V0LCBvYmopIHtcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0JyAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICB0YXJnZXRba2V5XSA9IG9ialtrZXldXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0YXJnZXRcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMSwgZW5kID0gYXJncy5sZW5ndGg7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgbWVyZ2UoYXJnc1swXSwgYXJnc1tpXSlcbiAgICB9XG4gICAgcmV0dXJuIGFyZ3NbMF1cbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5pbkFycmF5ID0gZnVuY3Rpb24oZWxlbWVudCwgYXJyYXksIGkpIHtcbiAgICByZXR1cm4gYXJyYXkgPT0gbnVsbCA/IC0xIDogYXJyYXkuaW5kZXhPZihlbGVtZW50LCBpKVxuICB9XG5cbiAgTm9GcmFtZXdvcmtBZGFwdGVyLmlzRW1wdHlPYmplY3QgPSBmdW5jdGlvbihvYmopIHtcbiAgICAvKiBlc2xpbnQgbm8tdW51c2VkLXZhcnM6IDAgKi9cbiAgICBmb3IgKHZhciBuYW1lIGluIG9iaikge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBXYXlwb2ludC5hZGFwdGVycy5wdXNoKHtcbiAgICBuYW1lOiAnbm9mcmFtZXdvcmsnLFxuICAgIEFkYXB0ZXI6IE5vRnJhbWV3b3JrQWRhcHRlclxuICB9KVxuICBXYXlwb2ludC5BZGFwdGVyID0gTm9GcmFtZXdvcmtBZGFwdGVyXG59KCkpXG47IiwicmVxdWlyZSgnLi9jb21tb24uanMnKTtcbnJlcXVpcmUoJy4vbW9iaWxlLW1lbnUuanMnKTtcbnJlcXVpcmUoJy4vc2xpZGVyLmpzJyk7XG5yZXF1aXJlKCcuL3ZlbmRvci9ncmFkaWVudG1hcHMubWluLmpzJyk7XG5cbi8vIGRlcGVuZGVuY2llcyBhbmQgY29uZmlndXJhdGlvbiByb2NrTnNsaWRlXG5yZXF1aXJlKCcuL3JvY2stbi1zbGlkZS5qcycpO1xuaW1wb3J0IGFuaW1hdGVTY3JvbGwgZnJvbSAnLi92ZW5kb3IvYW5pbWF0ZXNjcm9sbC5taW4uanMnO1xuaW1wb3J0IHsgcm9ja05zbGlkZSB9IGZyb20gXCIuL3JvY2stbi1zbGlkZS5qc1wiO1xuXG5sZXQgY29uZmlnID0ge1xuICBsYXp5TG9hZDogZmFsc2Vcbn1cblxubGV0IGRlcGVuZGVuY3kgPSB7XG4gIGFuaW1hdGVTY3JvbGw6IGFuaW1hdGVTY3JvbGwsXG4gIHdheXBvaW50czogcmVxdWlyZSgnd2F5cG9pbnRzJyksXG4gIGdyYWRpZW50TWFwczogcmVxdWlyZSgnLi92ZW5kb3IvZ3JhZGllbnRtYXBzLm1pbi5qcycpXG59O1xuXG5yb2NrTnNsaWRlLmluaXQoY29uZmlnLCBkZXBlbmRlbmN5KTtcbiIsInJlcXVpcmUoJy4vdmVuZG9yL2dyYWRpZW50bWFwcy5taW4uanMnKTsgLy8gR2VuZXJhdG9yIG9mIGdyYWRpZW50bWFwXG5cbmNvbnN0IHNjcm9sbFRleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzbGlkZV9fc2Nyb2xsaW5nLXRleHQnKVswXTtcbmNvbnN0IGJvZHkgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYm9keScpWzBdO1xuXG4vLyBJcyBpdCBJRT9cbigoKCkgPT4ge1xuICBjb25zdCBpZVJlZ2V4ID0gbmV3IFJlZ0V4cChcIk1TSUUgKFswLTldezEsfVtcXC4wLTldezAsfSlcIik7XG4gIGlmKGllUmVnZXguZXhlYyhuYXZpZ2F0b3IudXNlckFnZW50KSAhPSBudWxsKXtcbiAgICBib2R5LmNsYXNzTGlzdC5hZGQoJ2llJyk7XG4gIH1cbn0pKSgpO1xuXG4vLyBBZGQgdGFyZ2V0PV9ibGFuayB0byBhbGwgbGlua3MgZXhjZXB0IG1lbnUgbGlua3MgZ2VuZXJhdGVkIGZyb20ganNvblxuY29uc3QgbGlua3MgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYScpO1xuZm9yICh2YXIgZWxlbSA9IDA7IGVsZW0gPCBsaW5rcy5sZW5ndGg7IGVsZW0rKykge1xuICBpZiAoIWxpbmtzW2VsZW1dLmNsYXNzTGlzdC5jb250YWlucygnbWVudV9fbmF2LWFuY2hvcicpKVxuICAgIGxpbmtzW2VsZW1dLnNldEF0dHJpYnV0ZSgndGFyZ2V0JywgJ19ibGFuaycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9nZ2xlVmlzaWJpbGl0eShlbGVtKSB7XG4gIGlmICh0eXBlb2YgZWxlbSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBlbGVtICE9PSBudWxsKSB7XG4gICAgZWxlbS5zdHlsZS5vcGFjaXR5ID0gZ2V0T2Zmc2V0WSgpID4gMCA/IDAgOiAxO1xuICB9XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T2Zmc2V0WSgpIHsgcmV0dXJuIHdpbmRvdy5zY3JvbGxZIHx8IHdpbmRvdy5wYWdlWU9mZnNldCB9O1xuXG4vLyBBcHBseSBHcmFkaWVudCBNYXBzXG5jb25zdCBlbGVtc1dpdGhHcmFkaWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdbZGF0YS1ncmFkaWVudF0nKTtcbmZvciAodmFyIGVsZW0gPSAwOyBlbGVtIDwgZWxlbXNXaXRoR3JhZGllbnRzLmxlbmd0aDsgZWxlbSsrKSB7XG4gIGNvbnN0IGdyYWRpZW50ID0gZWxlbXNXaXRoR3JhZGllbnRzW2VsZW1dLmdldEF0dHJpYnV0ZSgnZGF0YS1ncmFkaWVudCcpO1xuICBHcmFkaWVudE1hcHMuYXBwbHlHcmFkaWVudE1hcChlbGVtc1dpdGhHcmFkaWVudHNbZWxlbV0sIGdyYWRpZW50KTtcbn1cbnRvZ2dsZVZpc2liaWxpdHkoc2Nyb2xsVGV4dCk7XG5cbmV4cG9ydCBkZWZhdWx0IGJvZHk7XG4iLCJsZXQgaXNNZW51T3BlbiA9IGZhbHNlO1xuY29uc3QgbW9iaWxlTWVudVRyaWdnZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdtZW51LW5hdl9fdHJpZ2dlcicpWzBdO1xuY29uc3QgbW9iaWxlTWVudSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3NsaWRlLS1tZW51JylbMF07XG5jb25zdCBtZW51SXRlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ21lbnVfX25hdi1hbmNob3InKTtcbmNvbnN0IHNjcm9sbFRleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzbGlkZV9fc2Nyb2xsaW5nLXRleHQnKVswXTtcbmltcG9ydCB7IHRvZ2dsZVZpc2liaWxpdHkgfSBmcm9tIFwiLi9jb21tb24uanNcIjtcbmltcG9ydCBib2R5IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuXG5jb25zdCB0b2dnbGVNb2JpbGVNZW51ID0gKCkgPT4ge1xuICBpc01lbnVPcGVuID0gIWlzTWVudU9wZW47XG4gIG1vYmlsZU1lbnVUcmlnZ2VyLmNsYXNzTGlzdC50b2dnbGUoJ21lbnUtbmF2X190cmlnZ2VyLS1hY3RpdmUnKTtcbiAgbW9iaWxlTWVudS5jbGFzc0xpc3QudG9nZ2xlKCdzbGlkZS0tbWVudS1hY3RpdmUnKTtcbiAgdG9nZ2xlVmlzaWJpbGl0eShzY3JvbGxUZXh0KTtcbiAgYm9keS5jbGFzc0xpc3QudG9nZ2xlKCdvdmVyZmxvdy0taGlkZScpO1xufTtcblxubW9iaWxlTWVudVRyaWdnZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB0b2dnbGVNb2JpbGVNZW51KCk7XG59KTtcblxuZm9yIChsZXQgaSA9IDA7IGkgPCBtZW51SXRlbS5sZW5ndGg7IGkrKykge1xuICBtZW51SXRlbVtpXS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRvZ2dsZU1vYmlsZU1lbnUpO1xufVxuIiwiLy8gTG9hZCBkZXBlbmRlbmNpZXMgaW4gcGFyYW1ldGVyXG5leHBvcnQgdmFyIHJvY2tOc2xpZGUgPSAoZnVuY3Rpb24oKXtcbiAgLy8gQ09ORklHIGFuZCBWQVJJQUJMRVNcbiAgY29uc3QgREVGQVVMVF9DT05GSUcgPSB7XG4gICAgc3BlZWQ6IDQwMCxcbiAgICBhbmltYXRpb25UeXBlOiAnZWFzZUluT3V0UXVhZCcsXG4gICAgbGF6eUxvYWQ6IHRydWUsXG4gICAgaGVscDogdHJ1ZSxcbiAgICBjbGFzc0xpc3Q6IHtcbiAgICAgIHNsaWRlc1dyYXBwZXI6ICAgICBcImZyYW1lXCIsXG4gICAgICBzbGlkZTogICAgICAgICAgICAgXCJzbGlkZVwiLFxuICAgICAgbWVudVRyaWdnZXI6ICAgICAgIFwibWVudS1uYXZfX3RyaWdnZXJcIixcbiAgICAgIG1lbnVUcmlnZ2VyQWN0aXZlOiBcIm1lbnUtbmF2X190cmlnZ2VyLS1hY3RpdmVcIixcbiAgICAgIG1lbnVTbGlkZTogICAgICAgICBcInNsaWRlLS1tZW51XCIsXG4gICAgICBtZW51U2xpZGVBY3RpdmU6ICAgXCJzbGlkZS0tbWVudS1hY3RpdmVcIixcbiAgICAgIG1lbnVJdGVtOiAgICAgICAgICBcIm1lbnVfX25hdi1hbmNob3JcIixcbiAgICAgIHNjcm9sbFRleHQ6ICAgICAgICBcInNsaWRlX19zY3JvbGxpbmctdGV4dFwiXG4gICAgfVxuICB9O1xuICBsZXQgQ09ORklHID0ge307XG4gIGxldCBhbmltYXRpb25JblByb2dyZXNzID0gZmFsc2U7XG4gIGxldCBlbGVtc1dpdGhHcmFkaWVudHMgPSBbXTtcbiAgbGV0IGRlcGVuZGVuY3kgPSB7fTtcbiAgbGV0IGlzTWVudU9wZW4gPSBmYWxzZTtcbiAgbGV0IHNsaWRlcyA9IFtdO1xuICBsZXQgc2xpZGVzV3JhcHBlcjtcbiAgbGV0IG1vYmlsZU1lbnVUcmlnZ2VyO1xuICBsZXQgbW9iaWxlTWVudTtcbiAgbGV0IG1lbnVJdGVtO1xuICBsZXQgc2Nyb2xsVGV4dDtcblxuICAvLyBDaGVjayBkZXBlbmRlbmNpZXNcbiAgbGV0IGNoZWNrRGVwZW5kZW5jaWVzID0gZnVuY3Rpb24oKXtcbiAgICBpZihkZXBlbmRlbmN5LmFuaW1hdGVTY3JvbGwgPT0gbnVsbCB8fCBkZXBlbmRlbmN5LmFuaW1hdGVTY3JvbGwgPT0gdW5kZWZpbmVkKXtcbiAgICAgIGRlcGVuZGVuY3kuYW5pbWF0ZVNjcm9sbCA9IGZhbHNlO1xuICAgICAgaWYoQ09ORklHLmhlbHAgPT0gdHJ1ZSl7XG4gICAgICAgIGNvbnNvbGUuaW5mbyhcInJvY2tOc2xpZGU6IEFuaW1hdGlvblNjcm9sbCBpcyBtaXNzaW5nIFxcblwiK1xuICAgICAgICAgIFwiRGlzYWJsaW5nIHNsaWRpbmcgYW5pbWF0aW9ucy5cIik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGRlcGVuZGVuY3kud2F5cG9pbnRzID09IG51bGwgfHwgZGVwZW5kZW5jeS53YXlwb2ludHMgPT0gdW5kZWZpbmVkKXtcbiAgICAgIGRlcGVuZGVuY3kud2F5cG9pbnRzID0gZmFsc2U7XG4gICAgICBDT05GSUcubGF6eUxvYWQgPSBmYWxzZTtcbiAgICAgIGlmKENPTkZJRy5oZWxwID09IHRydWUpe1xuICAgICAgICBjb25zb2xlLmluZm8oXCJyb2NrTnNsaWRlOiBXYXlwb2ludCBpcyBtaXNzaW5nIFxcblwiK1xuICAgICAgICAgIFwiRGlzYWJsaW5nIGxhenkgbG9hZC5cIik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmKGRlcGVuZGVuY3kuZ3JhZGllbnRNYXBzID09IG51bGwgfHwgZGVwZW5kZW5jeS5ncmFkaWVudE1hcHMgPT0gdW5kZWZpbmVkKXtcbiAgICAgIGRlcGVuZGVuY3kuZ3JhZGllbnRNYXBzID0gZmFsc2U7XG4gICAgICBpZihDT05GSUcuaGVscCA9PSB0cnVlKXtcbiAgICAgICAgY29uc29sZS5pbmZvKFwicm9ja05zbGlkZTogR3JhZGllbnRNYXBzIGlzIG1pc3NpbmcgXFxuXCIrXG4gICAgICAgICAgXCJEaXNhYmxpbmcgZ3JhZGllbnQgbWFwcy5cIik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSGVscGVyc1xuICBsZXQgZ2V0T2Zmc2V0WSA9IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHdpbmRvdy5zY3JvbGxZIHx8IHdpbmRvdy5wYWdlWU9mZnNldFxuICB9O1xuXG4gIGxldCBnZW5lcmF0ZVNsaWRlcyA9IGZ1bmN0aW9uKCkge1xuICAgIGxldCBzbGlkZXNXcmFwcGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShDT05GSUcuY2xhc3NMaXN0LnNsaWRlc1dyYXBwZXIpWzBdO1xuICAgIGxldCBzbGlkZXMgPSBzbGlkZXNXcmFwcGVyLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoQ09ORklHLmNsYXNzTGlzdC5zbGlkZSk7XG5cbiAgICBhc3NpZ25TbmFwVmFsdWVzKCk7XG4gICAgYXBwbHlHcmFkaWVudE1hcHMoc2xpZGVzV3JhcHBlcik7XG4gIH1cblxuICBsZXQgZ2VuZXJhdGVET01SZWZlcmVuY2VzID0gZnVuY3Rpb24oKSB7XG4gICAgc2xpZGVzV3JhcHBlciA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoQ09ORklHLmNsYXNzTGlzdC5zbGlkZXNXcmFwcGVyKVswXTtcbiAgICBtb2JpbGVNZW51VHJpZ2dlciA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoQ09ORklHLmNsYXNzTGlzdC5tZW51VHJpZ2dlcilbMF07XG4gICAgbW9iaWxlTWVudSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoQ09ORklHLmNsYXNzTGlzdC5tZW51U2xpZGUpWzBdO1xuICAgIG1lbnVJdGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShDT05GSUcuY2xhc3NMaXN0Lm1lbnVJdGVtKTtcbiAgICBzY3JvbGxUZXh0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShDT05GSUcuY2xhc3NMaXN0LnNjcm9sbFRleHQpWzBdO1xuICB9XG5cbiAgbGV0IGFzc2lnblNuYXBWYWx1ZXMgPSBmdW5jdGlvbigpIHtcbiAgICBpZihkZXBlbmRlbmN5LndheXBvaW50cyl7XG4gICAgICBmb3IobGV0IGkgPSAwOyBpIDwgc2xpZGVzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgbmV3IFdheXBvaW50KHtcbiAgICAgICAgICBlbGVtZW50OiBzbGlkZXNbaV0sXG4gICAgICAgICAgaGFuZGxlcjogbGF6eUltYWdlLFxuICAgICAgICAgIG9mZnNldDogJzIwMCUnXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgbGV0IGFwcGx5R3JhZGllbnRNYXBzID0gZnVuY3Rpb24od3JhcHBlcikge1xuICAgIGlmKGRlcGVuZGVuY3kuZ3JhZGllbnRNYXBzKXtcbiAgICAgIGxldCBlbGVtc1dpdGhHcmFkaWVudHMgPSB3cmFwcGVyLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tkYXRhLWdyYWRpZW50XScpO1xuICAgICAgZm9yICh2YXIgZWxlbSA9IDA7IGVsZW0gPCBlbGVtc1dpdGhHcmFkaWVudHMubGVuZ3RoOyBlbGVtKyspIHtcbiAgICAgICAgY29uc3QgZ3JhZGllbnQgPSBlbGVtc1dpdGhHcmFkaWVudHNbZWxlbV0uZ2V0QXR0cmlidXRlKCdkYXRhLWdyYWRpZW50Jyk7XG4gICAgICAgIEdyYWRpZW50TWFwcy5hcHBseUdyYWRpZW50TWFwKGVsZW1zV2l0aEdyYWRpZW50c1tlbGVtXSwgZ3JhZGllbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGxldCBjYWxjdWxhdGVOZWFyZXN0U2xpZGUgPSBmdW5jdGlvbihkaXIpIHtcbiAgICBsZXQgZG9jdW1lbnRIZWlnaHQgPSBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodDtcbiAgICBsZXQgd2luZG93SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuICAgIGxldCBvZmZzZXRUb3AgPSBnZXRPZmZzZXRZKCk7XG4gICAgY29uc3QgcGFzc1NsaWRlcyA9IE1hdGgucm91bmQob2Zmc2V0VG9wIC8gd2luZG93SGVpZ2h0KTtcbiAgICBjb25zdCBjdXJyZW50U2xpZGUgPSBzbGlkZXNbcGFzc1NsaWRlc107XG5cbiAgICBzd2l0Y2ggKGRpcikge1xuICAgICAgY2FzZSBcInVwXCI6XG4gICAgICAgIHJldHVybiBvZmZzZXRUb3AgPD0gd2luZG93SGVpZ2h0IC8gMiA/XG4gICAgICAgICAgY3VycmVudFNsaWRlIDogc2xpZGVzW3Bhc3NTbGlkZXMgLSAxXVxuICAgICAgY2FzZSBcImRvd25cIjpcbiAgICAgICAgcmV0dXJuIG9mZnNldFRvcCA+PSBkb2N1bWVudEhlaWdodCAtICh3aW5kb3dIZWlnaHQgKiAxLjUpID9cbiAgICAgICAgICBjdXJyZW50U2xpZGUgOiBzbGlkZXNbcGFzc1NsaWRlcyArIDFdXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gY3VycmVudFNsaWRlO1xuICAgIH1cbiAgfTtcblxuICAvLyBTbGlkaW5nXG4gIGxldCBzbGlkZVRvID0gZnVuY3Rpb24oZGlyKSB7XG4gICAgaWYgKGFuaW1hdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYW5pbWF0aW9uSW5Qcm9ncmVzcyA9IHRydWU7XG4gICAgYW5pbWF0ZVNjcm9sbChjYWxjdWxhdGVOZWFyZXN0U2xpZGUoZGlyKSwgNDAwLCAnZWFzZUluT3V0UXVhZCcsIDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGFuaW1hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIHNob3dNZW51XG4gIGxldCB0b2dnbGVNb2JpbGVNZW51ID0gZnVuY3Rpb24oKSB7XG4gICAgaXNNZW51T3BlbiA9ICFpc01lbnVPcGVuO1xuICAgIG1vYmlsZU1lbnVUcmlnZ2VyLmNsYXNzTGlzdC50b2dnbGUoQ09ORklHLmNsYXNzTGlzdC5tZW51VHJpZ2dlckFjdGl2ZSk7XG4gICAgbW9iaWxlTWVudS5jbGFzc0xpc3QudG9nZ2xlKENPTkZJRy5jbGFzc0xpc3QubWVudVNsaWRlQWN0aXZlKTtcbiAgICBpZihib2R5LnN0eWxlLm92ZXJmbG93ID09IFwiaGlkZGVuXCIpIHtcbiAgICAgIGJvZHkuc3R5bGUub3ZlcmZsb3cgPSBcIlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBib2R5LnN0eWxlLm92ZXJmbG93ID0gXCJoaWRkZW5cIjtcbiAgICB9XG4gIH07XG5cbiAgLy8gc2Nyb2xsVG9Ub3BcbiAgbGV0IHNjcm9sbFRvVG9wID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKGFuaW1hdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYW5pbWF0aW9uSW5Qcm9ncmVzcyA9IHRydWU7XG4gICAgYW5pbWF0ZVNjcm9sbChzbGlkZXNbMF0sIENPTkZJRy5zcGVlZCwgQ09ORklHLmFuaW1hdGlvblR5cGUsIDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGFuaW1hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICB9KVxuICB9XG5cbiAgLy8gcHJldlNsaWRlXG4gIGxldCBwcmV2U2xpZGUgPSBmdW5jdGlvbigpIHtcbiAgICBzbGlkZVRvKFwidXBcIilcbiAgfTtcblxuICAvLyBuZXh0U2xpZGVcbiAgbGV0IG5leHRTbGlkZSA9IGZ1bmN0aW9uKCkge1xuICAgIHNsaWRlVG8oXCJkb3duXCIpXG4gIH07XG5cbiAgLy8gV2F0Y2hlcnNcbiAgbGV0IGluaXRXYXRjaGVycyA9IGZ1bmN0aW9uKCkge1xuICAgIGlmKENPTkZJRy5sYXp5TG9hZCl7XG4gICAgICB3aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gICAgICAgIGFzc2lnblNuYXBWYWx1ZXMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBJbml0aWFsaXphdGlvblxuICAvLyBleHRlcm5hbFN0dWZmIHNob3VsZCBiZSBhbiBvYmplY3QgY29udGFpbmluZ1xuICAvLyBhbmltYXRlU2Nyb2xsLCBXYXlwb2ludHMgYW5kIEdyYWRpZW50TWFwc1xuICBsZXQgaW5pdCA9IGZ1bmN0aW9uKGNvbmZpZywgZXh0ZXJuYWxTdHVmZikge1xuICAgIENPTkZJRyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfQ09ORklHLCBjb25maWcpO1xuICAgIGRlcGVuZGVuY3kgPSBleHRlcm5hbFN0dWZmO1xuICAgIGNoZWNrRGVwZW5kZW5jaWVzKCk7XG4gICAgaW5pdFdhdGNoZXJzKCk7XG4gICAgZ2VuZXJhdGVET01SZWZlcmVuY2VzKCk7XG4gICAgZ2VuZXJhdGVTbGlkZXMoKTtcbiAgfTtcblxuICByZXR1cm4ge1xuICAgIHNjcm9sbFRvVG9wOiBzY3JvbGxUb1RvcCxcbiAgICBwcmV2U2xpZGU6IHByZXZTbGlkZSxcbiAgICBuZXh0U2xpZGU6IG5leHRTbGlkZSxcbiAgICB0b2dnbGVNZW51OiB0b2dnbGVNb2JpbGVNZW51LFxuICAgIGluaXQ6IGluaXRcbiAgfVxufSkoKTtcbiIsInJlcXVpcmUoJy4vdmVuZG9yL2dyYWRpZW50bWFwcy5taW4uanMnKTsgLy8gR2VuZXJhdG9yIG9mIGdyYWRpZW50bWFwXG5pbXBvcnQgYW5pbWF0ZVNjcm9sbCBmcm9tICcuL3ZlbmRvci9hbmltYXRlc2Nyb2xsLm1pbi5qcyc7IC8vIFB1cmUgSlMgYW5pbWF0ZSBzY3JvbGxcbnJlcXVpcmUoJ3dheXBvaW50cycpOyAvLyBXYXlwb2ludHMgZm9yIGxhenkgbG9hZCBhbmltYXRpb25zXG5yZXF1aXJlKCcuL21vYmlsZS1tZW51LmpzJyk7XG5yZXF1aXJlKCcuL2NvbW1vbi5qcycpO1xuaW1wb3J0IHsgdG9nZ2xlVmlzaWJpbGl0eSwgZ2V0T2Zmc2V0WSB9IGZyb20gXCIuL2NvbW1vbi5qc1wiO1xuaW1wb3J0IGJvZHkgZnJvbSBcIi4vY29tbW9uLmpzXCI7XG5jb25zdCBmcmFtZSA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2ZyYW1lJylbMF07XG5jb25zdCBzbGlkZXMgPSBmcmFtZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdzbGlkZScpO1xuXG4vLyBNb2JpbGVcbmNvbnN0IGJvZHlCb3JkZXIgPSBOdW1iZXIod2luZG93LmdldENvbXB1dGVkU3R5bGUoYm9keSwgJzphZnRlcicpLmdldFByb3BlcnR5VmFsdWUoJ2hlaWdodCcpLnJlcGxhY2UoL3B4JC8sICcnKSk7XG5jb25zdCBzY3JvbGxUZXh0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnc2xpZGVfX3Njcm9sbGluZy10ZXh0JylbMF07XG5sZXQgd2luZG93SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xubGV0IGRvY3VtZW50SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xubGV0IG9mZnNldFRvcDtcbmNvbnN0IHNsaWRlSW5kZXggPSAwO1xuXG5jb25zdCBsYXp5SW1hZ2UgPSBmdW5jdGlvbigpe1xuICBjb25zdCBiYWNrZ3JvdW5kSW1hZ2UgPSB0aGlzLmVsZW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnc2xpZGUtYmFja2dyb3VuZF9faW1hZ2UnKVswXTtcbiAgaWYoYmFja2dyb3VuZEltYWdlKXtcbiAgICBjb25zdCBuZXdBdHRyaWJ1dGVzID0gYCR7YmFja2dyb3VuZEltYWdlLmdldEF0dHJpYnV0ZSgnc3R5bGUnKX0gJHtiYWNrZ3JvdW5kSW1hZ2UuZ2V0QXR0cmlidXRlKCdkYXRhLXN0eWxlJyl9YDtcbiAgICBiYWNrZ3JvdW5kSW1hZ2Uuc2V0QXR0cmlidXRlKCdzdHlsZScsIG5ld0F0dHJpYnV0ZXMpO1xuICAgIGJhY2tncm91bmRJbWFnZS5yZW1vdmVBdHRyaWJ1dGUoJ2RhdGEtc3R5bGUnKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gYXNzaWduU25hcFZhcmlhYmxlcyAoKXtcbiAgZm9yKGxldCBpID0gMDsgaSA8IHNsaWRlcy5sZW5ndGg7IGkrKyl7XG4gICAgbmV3IFdheXBvaW50KHtcbiAgICAgIGVsZW1lbnQ6IHNsaWRlc1tpXSxcbiAgICAgIGhhbmRsZXI6IGxhenlJbWFnZSxcbiAgICAgIG9mZnNldDogJzIwMCUnXG4gICAgfSlcbiAgfVxufVxuYXNzaWduU25hcFZhcmlhYmxlcygpO1xuXG5jb25zdCBjYWxjdWxhdGVOZWFyZXN0U2xpZGUgPSBkaXIgPT4ge1xuICBjb25zdCBwYXNzU2xpZGVzID0gTWF0aC5yb3VuZChvZmZzZXRUb3AgLyB3aW5kb3dIZWlnaHQpO1xuICBjb25zdCBjdXJyZW50U2xpZGUgPSBzbGlkZXNbcGFzc1NsaWRlc107XG5cbiAgc3dpdGNoIChkaXIpIHtcbiAgICBjYXNlIFwidXBcIjpcbiAgICAgIHJldHVybiBvZmZzZXRUb3AgPD0gd2luZG93SGVpZ2h0IC8gMiA/XG4gICAgICAgIGN1cnJlbnRTbGlkZSA6IHNsaWRlc1twYXNzU2xpZGVzIC0gMV1cbiAgICBjYXNlIFwiZG93blwiOlxuICAgICAgcmV0dXJuIG9mZnNldFRvcCA+PSBkb2N1bWVudEhlaWdodCAtICh3aW5kb3dIZWlnaHQgKiAxLjUpID9cbiAgICAgICAgY3VycmVudFNsaWRlIDogc2xpZGVzW3Bhc3NTbGlkZXMgKyAxXVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gY3VycmVudFNsaWRlO1xuICB9XG59O1xuXG53aW5kb3cub25zY3JvbGwgPSAoKSA9PiB7XG4gIHRvZ2dsZVZpc2liaWxpdHkoc2Nyb2xsVGV4dCk7XG59O1xuXG53aW5kb3cub25yZXNpemUgPSAoKSA9PiB7XG4gIGFzc2lnblNuYXBWYXJpYWJsZXMoKTtcbn1cblxubGV0IGFuaW1hdGlvbkluUHJvZ3Jlc3MgPSBmYWxzZTtcblxud2luZG93Lm9ua2V5ZG93biA9IGUgPT4ge1xuICBmdW5jdGlvbiBkb0FuaW1hdGUoZGlyKSB7XG4gICAgaWYgKGFuaW1hdGlvbkluUHJvZ3Jlc3MpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYW5pbWF0aW9uSW5Qcm9ncmVzcyA9IHRydWU7XG5cbiAgICBhbmltYXRlU2Nyb2xsKGNhbGN1bGF0ZU5lYXJlc3RTbGlkZShkaXIpLCA0MDAsICdlYXNlSW5PdXRRdWFkJywgMCwgMCwgZnVuY3Rpb24gKCkge1xuICAgICAgYW5pbWF0aW9uSW5Qcm9ncmVzcyA9IGZhbHNlO1xuICAgIH0pO1xuICB9XG5cbiAgZG9jdW1lbnRIZWlnaHQgPSBkb2N1bWVudC5ib2R5LmNsaWVudEhlaWdodDtcbiAgd2luZG93SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuICBvZmZzZXRUb3AgPSBnZXRPZmZzZXRZKCk7XG4gIGlmKGUua2V5Q29kZSA9PSAzOCl7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGRvQW5pbWF0ZSgndXAnKTtcbiAgfSBlbHNlIGlmKGUua2V5Q29kZSA9PSA0MCB8fCBlLmtleUNvZGUgPT0gMzIpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgZG9BbmltYXRlKCdkb3duJyk7XG4gIH1cbn07XG4iLCJ2YXIgYW5pbWF0ZVNjcm9sbD1mdW5jdGlvbihuLHQsaSxlLGEsbyl7dmFyIHI9ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LHM9ci5jbGllbnRIZWlnaHQsdT1cInNjcm9sbE1heFlcImluIHdpbmRvdz93aW5kb3cuc2Nyb2xsTWF4WTpyLnNjcm9sbEhlaWdodC1zLGw9d2luZG93LnNjcm9sbFl8fHdpbmRvdy5wYWdlWU9mZnNldCxjPWwsaD1uLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLGQ9MDtcImNlbnRlclwiPT1hPyhkPWgudG9wK2guaGVpZ2h0LzIsYy09cy8yKTpcImJvdHRvbVwiPT1hPyhkPWguYm90dG9tLGMtPXMsYys9ZT9lOjApOihkPWgudG9wLGMtPWU/ZTowKSxjKz1kLGM9TWF0aC5tYXgoTWF0aC5taW4odSxjKSwwKTt2YXIgbT1jLWwsdz17dGFyZ2V0WTpjLGRlbHRhWTptLGR1cmF0aW9uOnQ/dDowLGVhc2luZzppIGluIGFuaW1hdGVTY3JvbGwuRWFzaW5nP2FuaW1hdGVTY3JvbGwuRWFzaW5nW2ldOmFuaW1hdGVTY3JvbGwuRWFzaW5nLmxpbmVhcixvbkZpbmlzaDpvLHN0YXJ0VGltZTpEYXRlLm5vdygpLGxhc3RZOmwsc3RlcDphbmltYXRlU2Nyb2xsLnN0ZXB9O3dpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUody5zdGVwLmJpbmQodykpfTthbmltYXRlU2Nyb2xsLkVhc2luZz17bGluZWFyOmZ1bmN0aW9uKG4pe3JldHVybiBufSxlYXNlSW5RdWFkOmZ1bmN0aW9uKG4pe3JldHVybiBuKm59LGVhc2VPdXRRdWFkOmZ1bmN0aW9uKG4pe3JldHVybiBuKigyLW4pfSxlYXNlSW5PdXRRdWFkOmZ1bmN0aW9uKG4pe3JldHVybi41Pm4/MipuKm46LTErKDQtMipuKSpufSxlYXNlSW5DdWJpYzpmdW5jdGlvbihuKXtyZXR1cm4gbipuKm59LGVhc2VPdXRDdWJpYzpmdW5jdGlvbihuKXtyZXR1cm4tLW4qbipuKzF9LGVhc2VJbk91dEN1YmljOmZ1bmN0aW9uKG4pe3JldHVybi41Pm4/NCpuKm4qbjoobi0xKSooMipuLTIpKigyKm4tMikrMX0sZWFzZUluUXVhcnQ6ZnVuY3Rpb24obil7cmV0dXJuIG4qbipuKm59LGVhc2VPdXRRdWFydDpmdW5jdGlvbihuKXtyZXR1cm4gMS0gLS1uKm4qbipufSxlYXNlSW5PdXRRdWFydDpmdW5jdGlvbihuKXtyZXR1cm4uNT5uPzgqbipuKm4qbjoxLTgqLS1uKm4qbipufSxlYXNlSW5RdWludDpmdW5jdGlvbihuKXtyZXR1cm4gbipuKm4qbipufSxlYXNlT3V0UXVpbnQ6ZnVuY3Rpb24obil7cmV0dXJuIDErLS1uKm4qbipuKm59LGVhc2VJbk91dFF1aW50OmZ1bmN0aW9uKG4pe3JldHVybi41Pm4/MTYqbipuKm4qbipuOjErMTYqLS1uKm4qbipuKm59fSxhbmltYXRlU2Nyb2xsLnN0ZXA9ZnVuY3Rpb24oKXtpZih0aGlzLmxhc3RZIT13aW5kb3cuc2Nyb2xsWSYmdGhpcy5vbkZpbmlzaClyZXR1cm4gdm9pZCB0aGlzLm9uRmluaXNoKCk7dmFyIG49TWF0aC5taW4oKERhdGUubm93KCktdGhpcy5zdGFydFRpbWUpL3RoaXMuZHVyYXRpb24sMSksdD10aGlzLnRhcmdldFktKDEtdGhpcy5lYXNpbmcobikpKnRoaXMuZGVsdGFZO3dpbmRvdy5zY3JvbGxUbyh3aW5kb3cuc2Nyb2xsWCx0KSwxIT1uPyh0aGlzLmxhc3RZPXdpbmRvdy5zY3JvbGxZLHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUodGhpcy5zdGVwLmJpbmQodGhpcykpKTp0aGlzLm9uRmluaXNoJiZ0aGlzLm9uRmluaXNoKCl9LG1vZHVsZS5leHBvcnRzPWFuaW1hdGVTY3JvbGw7XG4iLCJmdW5jdGlvbiBjbGFtcF9jc3NfYnl0ZShlKXtyZXR1cm4gZT1NYXRoLnJvdW5kKGUpLDA+ZT8wOmU+MjU1PzI1NTplfWZ1bmN0aW9uIGNsYW1wX2Nzc19mbG9hdChlKXtyZXR1cm4gMD5lPzA6ZT4xPzE6ZX1mdW5jdGlvbiBwYXJzZV9jc3NfaW50KGUpe3JldHVybiBjbGFtcF9jc3NfYnl0ZShcIiVcIj09PWVbZS5sZW5ndGgtMV0/cGFyc2VGbG9hdChlKS8xMDAqMjU1OnBhcnNlSW50KGUpKX1mdW5jdGlvbiBwYXJzZV9jc3NfZmxvYXQoZSl7cmV0dXJuIGNsYW1wX2Nzc19mbG9hdChcIiVcIj09PWVbZS5sZW5ndGgtMV0/cGFyc2VGbG9hdChlKS8xMDA6cGFyc2VGbG9hdChlKSl9ZnVuY3Rpb24gY3NzX2h1ZV90b19yZ2IoZSxyLHQpe3JldHVybiAwPnQ/dCs9MTp0PjEmJih0LT0xKSwxPjYqdD9lKyhyLWUpKnQqNjoxPjIqdD9yOjI+Myp0P2UrKHItZSkqKDIvMy10KSo2OmV9ZnVuY3Rpb24gcGFyc2VDU1NDb2xvcihlKXt2YXIgcj1lLnJlcGxhY2UoLyAvZyxcIlwiKS50b0xvd2VyQ2FzZSgpO2lmKHIgaW4ga0NTU0NvbG9yVGFibGUpcmV0dXJuIGtDU1NDb2xvclRhYmxlW3JdLnNsaWNlKCk7aWYoXCIjXCI9PT1yWzBdKXtpZig0PT09ci5sZW5ndGgpe3ZhciB0PXBhcnNlSW50KHIuc3Vic3RyKDEpLDE2KTtyZXR1cm4gdD49MCYmNDA5NT49dD9bKDM4NDAmdCk+PjR8KDM4NDAmdCk+PjgsMjQwJnR8KDI0MCZ0KT4+NCwxNSZ0fCgxNSZ0KTw8NCwxXTpudWxsfWlmKDc9PT1yLmxlbmd0aCl7dmFyIHQ9cGFyc2VJbnQoci5zdWJzdHIoMSksMTYpO3JldHVybiB0Pj0wJiYxNjc3NzIxNT49dD9bKDE2NzExNjgwJnQpPj4xNiwoNjUyODAmdCk+PjgsMjU1JnQsMV06bnVsbH1yZXR1cm4gbnVsbH12YXIgYT1yLmluZGV4T2YoXCIoXCIpLGw9ci5pbmRleE9mKFwiKVwiKTtpZigtMSE9PWEmJmwrMT09PXIubGVuZ3RoKXt2YXIgbj1yLnN1YnN0cigwLGEpLG89ci5zdWJzdHIoYSsxLGwtKGErMSkpLnNwbGl0KFwiLFwiKSxzPTE7c3dpdGNoKG4pe2Nhc2VcInJnYmFcIjppZig0IT09by5sZW5ndGgpcmV0dXJuIG51bGw7cz1wYXJzZV9jc3NfZmxvYXQoby5wb3AoKSk7Y2FzZVwicmdiXCI6cmV0dXJuIDMhPT1vLmxlbmd0aD9udWxsOltwYXJzZV9jc3NfaW50KG9bMF0pLHBhcnNlX2Nzc19pbnQob1sxXSkscGFyc2VfY3NzX2ludChvWzJdKSxzXTtjYXNlXCJoc2xhXCI6aWYoNCE9PW8ubGVuZ3RoKXJldHVybiBudWxsO3M9cGFyc2VfY3NzX2Zsb2F0KG8ucG9wKCkpO2Nhc2VcImhzbFwiOmlmKDMhPT1vLmxlbmd0aClyZXR1cm4gbnVsbDt2YXIgaT0ocGFyc2VGbG9hdChvWzBdKSUzNjArMzYwKSUzNjAvMzYwLHU9cGFyc2VfY3NzX2Zsb2F0KG9bMV0pLGQ9cGFyc2VfY3NzX2Zsb2F0KG9bMl0pLHA9LjU+PWQ/ZCoodSsxKTpkK3UtZCp1LGc9MipkLXA7cmV0dXJuW2NsYW1wX2Nzc19ieXRlKDI1NSpjc3NfaHVlX3RvX3JnYihnLHAsaSsxLzMpKSxjbGFtcF9jc3NfYnl0ZSgyNTUqY3NzX2h1ZV90b19yZ2IoZyxwLGkpKSxjbGFtcF9jc3NfYnl0ZSgyNTUqY3NzX2h1ZV90b19yZ2IoZyxwLGktMS8zKSksc107ZGVmYXVsdDpyZXR1cm4gbnVsbH19cmV0dXJuIG51bGx9d2luZG93LkdyYWRpZW50TWFwcz1mdW5jdGlvbihlKXtmdW5jdGlvbiByKCl7dGhpcy5pbml0KCl9cmV0dXJuIHIucHJvdG90eXBlPXtpbml0OmZ1bmN0aW9uKCl7fSxnZW5lcmF0ZUlEOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucHJldmlvdXNJRD10aGlzLnByZXZpb3VzSUQrMXx8MCx0aGlzLnByZXZpb3VzSUR9LGNhbGNTdG9wc0FycmF5OmZ1bmN0aW9uKGUpe3ZhciByPWUubWF0Y2goLygoKHJnYnxoc2wpYT9cXChcXGR7MSwzfSxcXHMqXFxkezEsM30sXFxzKlxcZHsxLDN9KD86LFxccyowP1xcLj9cXGQrKT9cXCl8XFx3K3wjWzAtOWEtZkEtRl17MSw2fSkoXFxzKygwP1xcLlxcZCt8XFxkezEsM30lKSk/KS9nKSx0PShlLnNwbGl0KFwiLFwiKSxbXSk7aWYoci5mb3JFYWNoKGZ1bmN0aW9uKGUpe3ZhciByPWUubWF0Y2goLyg/OigocmdifGhzbClhP1xcKFxcZHsxLDN9LFxccypcXGR7MSwzfSxcXHMqXFxkezEsM30oPzosXFxzKjA/XFwuP1xcZCspP1xcKXxcXHcrfCNbMC05YS1mQS1GXXsxLDZ9KShcXHMrKD86MD9cXC5cXGQrfFxcZHsxLDN9JSkpPykvKTtpZihyJiZyLmxlbmd0aD49NCl7dmFyIGE9clszXTt0LnB1c2goe2NvbG9yOnBhcnNlQ1NTQ29sb3IoclsxXSkscG9zOmE/MTAwKnBhcnNlX2Nzc19mbG9hdChhKTpudWxsfSl9fSksdC5sZW5ndGg+PTEpe3ZhciBhPXRbMF07YS5wb3M/YS5wb3M9TWF0aC5taW4oMTAwLE1hdGgubWF4KDAsYS5wb3MpKTphLnBvcz0wO3ZhciBsPWEucG9zO2E9dFt0Lmxlbmd0aC0xXSxhLnBvcz9hLnBvcz1NYXRoLm1pbigxMDAsTWF0aC5tYXgoMCxhLnBvcykpOmEucG9zPTEwMDtmb3IodmFyIG49MTtuPHQubGVuZ3RoLTE7bisrKWE9dFtuXSxhLnBvcyYmYS5wb3M8bCYmKGEucG9zPWwpLGEucG9zPjEwMCYmKGEucG9zPTEwMCksbD1hLnBvcztmb3IodmFyIG49MTtuPHQubGVuZ3RoLTE7KXtpZighdFtuXS5wb3Mpe2Zvcih2YXIgbz1uKzE7bzx0Lmxlbmd0aCYmIXRbb10ucG9zO28rKyk7Zm9yKHZhciBzPXRbbi0xXS5wb3MsaT10W29dLnBvcyx1PW8tMSsxLGQ9TWF0aC5yb3VuZCgoaS1zKS91KTtvPm47KXRbbl0ucG9zPXRbbi0xXS5wb3MrZCxuKyt9bisrfTAhPXRbMF0ucG9zJiZ0LnVuc2hpZnQoe2NvbG9yOnRbMF0uY29sb3IscG9zOjB9KSwxMDAhPXRbdC5sZW5ndGgtMV0ucG9zJiZ0LnB1c2goe2NvbG9yOnRbdC5sZW5ndGgtMV0uY29sb3IscG9zOjEwMH0pfXJldHVybiB0fSxmaW5kTWF0Y2hpbmdEaXN0cmlidXRlZE5TZWdzOmZ1bmN0aW9uKGUpe2Zvcih2YXIgcj0xMDAsdD0hMSxhPTE7IXQmJnI+PWE7YSsrKXt2YXIgbD1yL2E7dD0hMDtmb3IodmFyIG49MTtuPGUubGVuZ3RoLTE7bisrKXt2YXIgbz1lW25dLnBvcztpZihsPm8pe3Q9ITE7YnJlYWt9dmFyIHM9byVsLGk9MTtpZighKGk+c3x8aT5sLXMpKXt0PSExO2JyZWFrfX1pZih0KXJldHVybiBhfXJldHVybiBhfSxjYWxjRGlzdHJpYnV0ZWRDb2xvcnM6ZnVuY3Rpb24oZSxyKXtmb3IodmFyIHQ9W2VbMF0uY29sb3JdLGE9MTAwL3IsbD0xO2w8ZS5sZW5ndGgtMTtsKyspe3ZhciBuPWVbbF0sbz1NYXRoLnJvdW5kKG4ucG9zL2EpO3Rbb109bi5jb2xvcn10W3JdPWVbZS5sZW5ndGgtMV0uY29sb3I7Zm9yKHZhciBsPTE7bDx0Lmxlbmd0aDspe2lmKCF0W2xdKXtmb3IodmFyIHM9bCsxO3M8dC5sZW5ndGgmJiF0W3NdO3MrKyk7Zm9yKHZhciBpPXRbbC0xXSx1PWlbMF0sZD1pWzFdLHA9aVsyXSxnPWlbM10saD10W3NdLHI9cy1sKzEsYz0oaFswXS11KS9yLGY9KGhbMV0tZCkvcixtPShoWzJdLXApL3IsYj0oaFszXS1nKS9yO3M+bDspdSs9YyxkKz1mLHArPW0sZys9Yix0W2xdPVt1LGQscCxnXSxsKyt9bCsrfXJldHVybiB0fSxhZGRFbGVtZW50OmZ1bmN0aW9uKGUscix0LGEsbCl7dmFyIG49YT9lLmNyZWF0ZUVsZW1lbnROUyhhLHQpOmUuY3JlYXRlRWxlbWVudCh0KTtyZXR1cm4gbCYmT2JqZWN0LmtleXMobCkuZm9yRWFjaChmdW5jdGlvbihlLHIsdCl7bi5zZXRBdHRyaWJ1dGUoZSxsW2VdKX0pLHImJnIuYXBwZW5kQ2hpbGQobiksbn0sYWRkU1ZHQ29tcG9uZW50VHJhbnNmZXJGaWx0ZXI6ZnVuY3Rpb24oZSxyKXt2YXIgdD1udWxsLGE9bnVsbCxsPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIixuPWUuZ2V0QXR0cmlidXRlKFwiZGF0YS1ncmFkaWVudG1hcC1maWx0ZXJcIiksbz0hMSxzPWUub3duZXJEb2N1bWVudDtpZihuJiYodD1zLmdldEVsZW1lbnRCeUlkKG4pKSl7dmFyIGk9dC5nZXRFbGVtZW50c0J5VGFnTmFtZU5TKGwsXCJmZUNvbXBvbmVudFRyYW5zZmVyXCIpO2lmKGkpe2Zvcih2YXIgdT1pLmxlbmd0aC0xO3U+PTA7LS11KXQucmVtb3ZlQ2hpbGQoaVt1XSk7YT10LnBhcmVudEVsZW1lbnR9fWlmKCFhKXt2YXIgYT10aGlzLmFkZEVsZW1lbnQocyxudWxsLFwic3ZnXCIsbCx7dmVyc2lvbjpcIjEuMVwiLHdpZHRoOjAsaGVpZ2h0OjB9KTtuPVwiZmlsdGVyLVwiK3RoaXMuZ2VuZXJhdGVJRCgpLHQ9dGhpcy5hZGRFbGVtZW50KHMsYSxcImZpbHRlclwiLGwse2lkOm59KSxlLnNldEF0dHJpYnV0ZShcImRhdGEtZ3JhZGllbnRtYXAtZmlsdGVyXCIsbik7dGhpcy5hZGRFbGVtZW50KHMsdCxcImZlQ29sb3JNYXRyaXhcIixsLHt0eXBlOlwibWF0cml4XCIsdmFsdWVzOlwiMC4yMTI2IDAuNzE1MiAwLjA3MjIgMCAwIDAuMjEyNiAwLjcxNTIgMC4wNzIyIDAgMCAwLjIxMjYgMC43MTUyIDAuMDcyMiAwIDAgMCAwIDAgMSAwXCIscmVzdWx0OlwiZ3JheVwifSk7bz0hMH12YXIgZD10aGlzLmFkZEVsZW1lbnQocyx0LFwiZmVDb21wb25lbnRUcmFuc2ZlclwiLGwse1wiY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzXCI6XCJzUkdCXCJ9KSxwPVwiXCIsZz1cIlwiLGg9XCJcIixjPVwiXCI7ci5mb3JFYWNoKGZ1bmN0aW9uKGUscix0KXtwKz1lWzBdLzI1NStcIiBcIixnKz1lWzFdLzI1NStcIiBcIixoKz1lWzJdLzI1NStcIiBcIixjKz1lWzNdK1wiIFwifSksdGhpcy5hZGRFbGVtZW50KHMsZCxcImZlRnVuY1JcIixsLHt0eXBlOlwidGFibGVcIix0YWJsZVZhbHVlczpwLnRyaW0oKX0pLHRoaXMuYWRkRWxlbWVudChzLGQsXCJmZUZ1bmNHXCIsbCx7dHlwZTpcInRhYmxlXCIsdGFibGVWYWx1ZXM6Zy50cmltKCl9KSx0aGlzLmFkZEVsZW1lbnQocyxkLFwiZmVGdW5jQlwiLGwse3R5cGU6XCJ0YWJsZVwiLHRhYmxlVmFsdWVzOmgudHJpbSgpfSksdGhpcy5hZGRFbGVtZW50KHMsZCxcImZlRnVuY0FcIixsLHt0eXBlOlwidGFibGVcIix0YWJsZVZhbHVlczpjLnRyaW0oKX0pLG8mJmUucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoYSxlKTt2YXIgZj1cInVybCgjXCIrbitcIilcIjtlLnN0eWxlW1wiLXdlYmtpdC1maWx0ZXJcIl09ZixlLnN0eWxlLmZpbHRlcj1mfSxhcHBseUdyYWRpZW50TWFwOmZ1bmN0aW9uKGUscil7dmFyIHQ9dGhpcy5jYWxjU3RvcHNBcnJheShyKSxhPXRoaXMuZmluZE1hdGNoaW5nRGlzdHJpYnV0ZWROU2Vncyh0KSxsPXRoaXMuY2FsY0Rpc3RyaWJ1dGVkQ29sb3JzKHQsYSk7dGhpcy5hZGRTVkdDb21wb25lbnRUcmFuc2ZlckZpbHRlcihlLGwpfSxyZW1vdmVHcmFkaWVudE1hcDpmdW5jdGlvbihlKXt2YXIgcj1lLmdldEF0dHJpYnV0ZShcImRhdGEtZ3JhZGllbnRtYXAtZmlsdGVyXCIpO2lmKHIpe3ZhciB0PWUub3duZXJEb2N1bWVudCxhPXQuZ2V0RWxlbWVudEJ5SWQocik7aWYoYSl7dmFyIGw9YS5wYXJlbnRFbGVtZW50O2lmKGwucmVtb3ZlQ2hpbGQoYSksbC5jaGlsZE5vZGVzLmxlbmd0aDw9MCl7dmFyIG49bC5wYXJlbnRFbGVtZW50O24ucmVtb3ZlQ2hpbGQobCl9fWUucmVtb3ZlQXR0cmlidXRlKFwiZGF0YS1ncmFkaWVudG1hcC1maWx0ZXJcIiksZS5zdHlsZVtcIi13ZWJraXQtZmlsdGVyXCJdPVwiXCIsZS5zdHlsZS5maWx0ZXI9XCJcIn19fSxuZXcgcn0od2luZG93KTt2YXIga0NTU0NvbG9yVGFibGU9e3RyYW5zcGFyZW50OlswLDAsMCwwXSxhbGljZWJsdWU6WzI0MCwyNDgsMjU1LDFdLGFudGlxdWV3aGl0ZTpbMjUwLDIzNSwyMTUsMV0sYXF1YTpbMCwyNTUsMjU1LDFdLGFxdWFtYXJpbmU6WzEyNywyNTUsMjEyLDFdLGF6dXJlOlsyNDAsMjU1LDI1NSwxXSxiZWlnZTpbMjQ1LDI0NSwyMjAsMV0sYmlzcXVlOlsyNTUsMjI4LDE5NiwxXSxibGFjazpbMCwwLDAsMV0sYmxhbmNoZWRhbG1vbmQ6WzI1NSwyMzUsMjA1LDFdLGJsdWU6WzAsMCwyNTUsMV0sYmx1ZXZpb2xldDpbMTM4LDQzLDIyNiwxXSxicm93bjpbMTY1LDQyLDQyLDFdLGJ1cmx5d29vZDpbMjIyLDE4NCwxMzUsMV0sY2FkZXRibHVlOls5NSwxNTgsMTYwLDFdLGNoYXJ0cmV1c2U6WzEyNywyNTUsMCwxXSxjaG9jb2xhdGU6WzIxMCwxMDUsMzAsMV0sY29yYWw6WzI1NSwxMjcsODAsMV0sY29ybmZsb3dlcmJsdWU6WzEwMCwxNDksMjM3LDFdLGNvcm5zaWxrOlsyNTUsMjQ4LDIyMCwxXSxjcmltc29uOlsyMjAsMjAsNjAsMV0sY3lhbjpbMCwyNTUsMjU1LDFdLGRhcmtibHVlOlswLDAsMTM5LDFdLGRhcmtjeWFuOlswLDEzOSwxMzksMV0sZGFya2dvbGRlbnJvZDpbMTg0LDEzNCwxMSwxXSxkYXJrZ3JheTpbMTY5LDE2OSwxNjksMV0sZGFya2dyZWVuOlswLDEwMCwwLDFdLGRhcmtncmV5OlsxNjksMTY5LDE2OSwxXSxkYXJra2hha2k6WzE4OSwxODMsMTA3LDFdLGRhcmttYWdlbnRhOlsxMzksMCwxMzksMV0sZGFya29saXZlZ3JlZW46Wzg1LDEwNyw0NywxXSxkYXJrb3JhbmdlOlsyNTUsMTQwLDAsMV0sZGFya29yY2hpZDpbMTUzLDUwLDIwNCwxXSxkYXJrcmVkOlsxMzksMCwwLDFdLGRhcmtzYWxtb246WzIzMywxNTAsMTIyLDFdLGRhcmtzZWFncmVlbjpbMTQzLDE4OCwxNDMsMV0sZGFya3NsYXRlYmx1ZTpbNzIsNjEsMTM5LDFdLGRhcmtzbGF0ZWdyYXk6WzQ3LDc5LDc5LDFdLGRhcmtzbGF0ZWdyZXk6WzQ3LDc5LDc5LDFdLGRhcmt0dXJxdW9pc2U6WzAsMjA2LDIwOSwxXSxkYXJrdmlvbGV0OlsxNDgsMCwyMTEsMV0sZGVlcHBpbms6WzI1NSwyMCwxNDcsMV0sZGVlcHNreWJsdWU6WzAsMTkxLDI1NSwxXSxkaW1ncmF5OlsxMDUsMTA1LDEwNSwxXSxkaW1ncmV5OlsxMDUsMTA1LDEwNSwxXSxkb2RnZXJibHVlOlszMCwxNDQsMjU1LDFdLGZpcmVicmljazpbMTc4LDM0LDM0LDFdLGZsb3JhbHdoaXRlOlsyNTUsMjUwLDI0MCwxXSxmb3Jlc3RncmVlbjpbMzQsMTM5LDM0LDFdLGZ1Y2hzaWE6WzI1NSwwLDI1NSwxXSxnYWluc2Jvcm86WzIyMCwyMjAsMjIwLDFdLGdob3N0d2hpdGU6WzI0OCwyNDgsMjU1LDFdLGdvbGQ6WzI1NSwyMTUsMCwxXSxnb2xkZW5yb2Q6WzIxOCwxNjUsMzIsMV0sZ3JheTpbMTI4LDEyOCwxMjgsMV0sZ3JlZW46WzAsMTI4LDAsMV0sZ3JlZW55ZWxsb3c6WzE3MywyNTUsNDcsMV0sZ3JleTpbMTI4LDEyOCwxMjgsMV0saG9uZXlkZXc6WzI0MCwyNTUsMjQwLDFdLGhvdHBpbms6WzI1NSwxMDUsMTgwLDFdLGluZGlhbnJlZDpbMjA1LDkyLDkyLDFdLGluZGlnbzpbNzUsMCwxMzAsMV0saXZvcnk6WzI1NSwyNTUsMjQwLDFdLGtoYWtpOlsyNDAsMjMwLDE0MCwxXSxsYXZlbmRlcjpbMjMwLDIzMCwyNTAsMV0sbGF2ZW5kZXJibHVzaDpbMjU1LDI0MCwyNDUsMV0sbGF3bmdyZWVuOlsxMjQsMjUyLDAsMV0sbGVtb25jaGlmZm9uOlsyNTUsMjUwLDIwNSwxXSxsaWdodGJsdWU6WzE3MywyMTYsMjMwLDFdLGxpZ2h0Y29yYWw6WzI0MCwxMjgsMTI4LDFdLGxpZ2h0Y3lhbjpbMjI0LDI1NSwyNTUsMV0sbGlnaHRnb2xkZW5yb2R5ZWxsb3c6WzI1MCwyNTAsMjEwLDFdLGxpZ2h0Z3JheTpbMjExLDIxMSwyMTEsMV0sbGlnaHRncmVlbjpbMTQ0LDIzOCwxNDQsMV0sbGlnaHRncmV5OlsyMTEsMjExLDIxMSwxXSxsaWdodHBpbms6WzI1NSwxODIsMTkzLDFdLGxpZ2h0c2FsbW9uOlsyNTUsMTYwLDEyMiwxXSxsaWdodHNlYWdyZWVuOlszMiwxNzgsMTcwLDFdLGxpZ2h0c2t5Ymx1ZTpbMTM1LDIwNiwyNTAsMV0sbGlnaHRzbGF0ZWdyYXk6WzExOSwxMzYsMTUzLDFdLGxpZ2h0c2xhdGVncmV5OlsxMTksMTM2LDE1MywxXSxsaWdodHN0ZWVsYmx1ZTpbMTc2LDE5NiwyMjIsMV0sbGlnaHR5ZWxsb3c6WzI1NSwyNTUsMjI0LDFdLGxpbWU6WzAsMjU1LDAsMV0sbGltZWdyZWVuOls1MCwyMDUsNTAsMV0sbGluZW46WzI1MCwyNDAsMjMwLDFdLG1hZ2VudGE6WzI1NSwwLDI1NSwxXSxtYXJvb246WzEyOCwwLDAsMV0sbWVkaXVtYXF1YW1hcmluZTpbMTAyLDIwNSwxNzAsMV0sbWVkaXVtYmx1ZTpbMCwwLDIwNSwxXSxtZWRpdW1vcmNoaWQ6WzE4Niw4NSwyMTEsMV0sbWVkaXVtcHVycGxlOlsxNDcsMTEyLDIxOSwxXSxtZWRpdW1zZWFncmVlbjpbNjAsMTc5LDExMywxXSxtZWRpdW1zbGF0ZWJsdWU6WzEyMywxMDQsMjM4LDFdLG1lZGl1bXNwcmluZ2dyZWVuOlswLDI1MCwxNTQsMV0sbWVkaXVtdHVycXVvaXNlOls3MiwyMDksMjA0LDFdLG1lZGl1bXZpb2xldHJlZDpbMTk5LDIxLDEzMywxXSxtaWRuaWdodGJsdWU6WzI1LDI1LDExMiwxXSxtaW50Y3JlYW06WzI0NSwyNTUsMjUwLDFdLG1pc3R5cm9zZTpbMjU1LDIyOCwyMjUsMV0sbW9jY2FzaW46WzI1NSwyMjgsMTgxLDFdLG5hdmFqb3doaXRlOlsyNTUsMjIyLDE3MywxXSxuYXZ5OlswLDAsMTI4LDFdLG9sZGxhY2U6WzI1MywyNDUsMjMwLDFdLG9saXZlOlsxMjgsMTI4LDAsMV0sb2xpdmVkcmFiOlsxMDcsMTQyLDM1LDFdLG9yYW5nZTpbMjU1LDE2NSwwLDFdLG9yYW5nZXJlZDpbMjU1LDY5LDAsMV0sb3JjaGlkOlsyMTgsMTEyLDIxNCwxXSxwYWxlZ29sZGVucm9kOlsyMzgsMjMyLDE3MCwxXSxwYWxlZ3JlZW46WzE1MiwyNTEsMTUyLDFdLHBhbGV0dXJxdW9pc2U6WzE3NSwyMzgsMjM4LDFdLHBhbGV2aW9sZXRyZWQ6WzIxOSwxMTIsMTQ3LDFdLHBhcGF5YXdoaXA6WzI1NSwyMzksMjEzLDFdLHBlYWNocHVmZjpbMjU1LDIxOCwxODUsMV0scGVydTpbMjA1LDEzMyw2MywxXSxwaW5rOlsyNTUsMTkyLDIwMywxXSxwbHVtOlsyMjEsMTYwLDIyMSwxXSxwb3dkZXJibHVlOlsxNzYsMjI0LDIzMCwxXSxwdXJwbGU6WzEyOCwwLDEyOCwxXSxyZWQ6WzI1NSwwLDAsMV0scm9zeWJyb3duOlsxODgsMTQzLDE0MywxXSxyb3lhbGJsdWU6WzY1LDEwNSwyMjUsMV0sc2FkZGxlYnJvd246WzEzOSw2OSwxOSwxXSxzYWxtb246WzI1MCwxMjgsMTE0LDFdLHNhbmR5YnJvd246WzI0NCwxNjQsOTYsMV0sc2VhZ3JlZW46WzQ2LDEzOSw4NywxXSxzZWFzaGVsbDpbMjU1LDI0NSwyMzgsMV0sc2llbm5hOlsxNjAsODIsNDUsMV0sc2lsdmVyOlsxOTIsMTkyLDE5MiwxXSxza3libHVlOlsxMzUsMjA2LDIzNSwxXSxzbGF0ZWJsdWU6WzEwNiw5MCwyMDUsMV0sc2xhdGVncmF5OlsxMTIsMTI4LDE0NCwxXSxzbGF0ZWdyZXk6WzExMiwxMjgsMTQ0LDFdLHNub3c6WzI1NSwyNTAsMjUwLDFdLHNwcmluZ2dyZWVuOlswLDI1NSwxMjcsMV0sc3RlZWxibHVlOls3MCwxMzAsMTgwLDFdLHRhbjpbMjEwLDE4MCwxNDAsMV0sdGVhbDpbMCwxMjgsMTI4LDFdLHRoaXN0bGU6WzIxNiwxOTEsMjE2LDFdLHRvbWF0bzpbMjU1LDk5LDcxLDFdLHR1cnF1b2lzZTpbNjQsMjI0LDIwOCwxXSx2aW9sZXQ6WzIzOCwxMzAsMjM4LDFdLHdoZWF0OlsyNDUsMjIyLDE3OSwxXSx3aGl0ZTpbMjU1LDI1NSwyNTUsMV0sd2hpdGVzbW9rZTpbMjQ1LDI0NSwyNDUsMV0seWVsbG93OlsyNTUsMjU1LDAsMV0seWVsbG93Z3JlZW46WzE1NCwyMDUsNTAsMV19O3RyeXtleHBvcnRzLnBhcnNlQ1NTQ29sb3I9cGFyc2VDU1NDb2xvcn1jYXRjaChlKXt9XG4iXX0=
