var JSON_TYPES, debug;

debug = require('debug')('loopback:connector:internal:context');

JSON_TYPES = ['boolean', 'string', 'object', 'number'];

exports.RemoteContext = (function() {
  function RemoteContext(ctorArgs1, args1, options) {
    this.ctorArgs = ctorArgs1;
    this.args = args1;
    this.options = options != null ? options : {};
  }

  RemoteContext.prototype.buildArgs = function(ctorArgs, args, method) {
    var accepts, isSharedCtor, isStatic, namedArgs, restClass;
    isStatic = method.isStatic, isSharedCtor = method.isSharedCtor, restClass = method.restClass, accepts = method.accepts;
    args = isSharedCtor ? ctorArgs : args;
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

  RemoteContext.prototype.isAcceptable = function(val, arg) {
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

  RemoteContext.prototype.setReturnArgByName = function(name, value) {
    var returns;
    returns = this.method.getReturnArgDescByName(name);
    if (!returns) {
      debug('warning: cannot set return value for arg' + ' (%s) without description!', name);
      return;
    }
    if (returns.root) {
      this.resultType = typeof returns.type === 'string' ? returns.type.toLowerCase() : returns.type;
      return;
    }
    return true;
  };

  RemoteContext.prototype.invoke = function(scope, method, callback) {
    var args;
    this.method = method;
    args = this.buildArgs(this.ctorArgs, this.args, method);
    this.method.invoke(scope, args, this.options, this, function(err, result) {
      return callback(err, result);
    });
  };

  return RemoteContext;

})();
