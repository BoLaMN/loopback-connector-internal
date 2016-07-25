var ContextBase, uniqueId,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

ContextBase = require('strong-remoting/lib/context-base');

uniqueId = require('lodash').uniqueId;

exports.BaseContext = (function(superClass) {
  extend(BaseContext, superClass);

  function BaseContext(id, type1, methodString, method, ctorArgs, args1) {
    this.id = id;
    this.type = type1;
    this.methodString = methodString;
    this.method = method;
    this.ctorArgs = ctorArgs;
    this.args = args1;
    BaseContext.__super__.constructor.call(this, this.method);
    if (this.method.isStatic) {
      this.scope = this.method.ctor;
    } else {
      this.scope = this.method.sharedCtor;
    }
    if (this.type === 'request') {
      this.args = this.buildArgs();
    }
    this.id = this.id || uniqueId();
  }

  BaseContext.prototype.buildArgs = function() {
    var accepts, args, isSharedCtor, isStatic, namedArgs, ref, restClass;
    ref = this.method, isStatic = ref.isStatic, isSharedCtor = ref.isSharedCtor, restClass = ref.restClass, accepts = ref.accepts;
    args = isSharedCtor ? this.ctorArgs : this.args;
    namedArgs = {};
    if (!isStatic) {
      accepts = restClass.ctor.accepts;
    }
    accepts.forEach((function(_this) {
      return function(accept) {
        var val;
        val = args.shift();
        if (_this.isAcceptable(typeof val, accept)) {
          namedArgs[accept.arg || accept.name] = val;
        }
      };
    })(this));
    return namedArgs;
  };

  BaseContext.prototype.isAcceptable = function(val, arg) {
    var type;
    type = arg.type;
    if (Array.isArray(type) || type.toLowerCase() === 'array' || type !== 'any') {
      return true;
    }
    if (JSON_TYPES.indexOf(type) === -1) {
      return val === 'object';
    }
    return val === type;
  };

  BaseContext.prototype.toJSON = function() {
    return {
      type: this.type,
      id: this.id,
      args: this.args,
      ctorArgs: this.ctorArgs,
      methodString: this.methodString,
      error: this.error,
      results: this.results
    };
  };

  return BaseContext;

})(ContextBase);
