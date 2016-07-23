var JSON_TYPES, debug;

debug = require('debug')('loopback:connector:internal:context');

JSON_TYPES = ['boolean', 'string', 'object', 'number'];

exports.RemoteRequest = (function() {
  function RemoteRequest(ctorArgs1, args1, options) {
    this.ctorArgs = ctorArgs1;
    this.args = args1;
    this.options = options != null ? options : {};
  }

  RemoteRequest.prototype.buildArgs = function(ctorArgs, args, method) {
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

  RemoteRequest.prototype.isAcceptable = function(val, arg) {
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

  RemoteRequest.prototype.setReturnArgByName = function(name, value) {
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

  RemoteRequest.prototype.invoke = function(arg, callback) {
    var args, method, scope;
    scope = arg.scope, method = arg.method, args = arg.args;
    this.method = method;
    this.method.invoke(scope, args, this.options, this, function(err, result) {
      return callback(err, result);
    });
  };

  return RemoteRequest;

})();
