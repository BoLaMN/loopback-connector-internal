var JSON_TYPES, debug;

debug = require('debug')('loopback:connector:internal:context');

JSON_TYPES = ['boolean', 'string', 'object', 'number'];

exports.RemoteRequest = (function() {
  function RemoteRequest(options) {
    this.options = options != null ? options : {};
  }

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

  RemoteRequest.prototype.invoke = function(ctx, callback) {
    var args, method, scope;
    scope = ctx.scope, method = ctx.method, args = ctx.args;
    this.method = method;
    this.method.invoke(scope, args, this.options, this, function(err, result) {
      if (err) {
        ctx.error = err;
      }
      ctx.results = result;
      return callback(ctx);
    });
  };

  return RemoteRequest;

})();
