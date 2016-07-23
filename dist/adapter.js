var RemoteAdapter, RemoteContext, async, debug, uniqueId;

debug = require('debug')('loopback:connector:internal:adapter');

uniqueId = require('lodash').uniqueId;

RemoteContext = require('./context').RemoteContext;

async = require('async');


/**
 * Create a new `RemoteAdapter` with the given `options`.
#
 * @param {Object} options
 * @return {SQSAdapter}
 */

RemoteAdapter = (function() {
  function RemoteAdapter(remotes, options) {
    this.remotes = remotes;
    this.options = options || this.remotes.options;
    this.ctx = new RemoteContext(this.options);
  }

  RemoteAdapter.prototype.connect = function(adapter) {
    var adapterClass;
    adapterClass = require(adapter);
    this.messageQueue = new adapterClass(this.message, this.options);
    return this.messageQueue.connect();
  };

  RemoteAdapter.prototype.message = function(message, callback) {
    var args, ctorArgs, id, inst, method, methodString, response, result;
    methodString = message.methodString, ctorArgs = message.ctorArgs, args = message.args, id = message.id, result = message.result;
    if (methodString) {
      method = this.remotes.findMethod(methodString);
      if (!method || method.__isProxy) {
        response = {
          err: 'method does not exist',
          id: id,
          methodString: methodString
        };
        this.messageQueue.sendMessage(response, false, callback);
        return;
      }
      args = this.ctx.buildArgs(ctorArgs, args, method);
      if (method.isStatic) {
        inst = method.ctor;
      } else {
        inst = method.sharedCtor;
      }
      return this.ctx.invoke(inst, method, args, function(err, result) {
        response = {
          data: result,
          id: id,
          error: err
        };
        return this.messageQueue.sendMessage(response, false, callback);
      });
    } else {
      this.messageQueue.requests[id](result);
      return callback();
    }
  };

  RemoteAdapter.prototype.invoke = function(methodString, ctorArgs, args, callback) {
    var inst, message, method, run;
    method = this.remotes.findMethod(methodString);
    args = this.ctx.buildArgs(ctorArgs, args, method);
    message = {
      id: uniqueId(),
      args: args,
      ctorArgs: ctorArgs,
      methodString: methodString
    };
    if (method.isStatic) {
      inst = method.ctor;
    } else {
      inst = method.sharedCtor;
    }
    run = [
      (function(_this) {
        return function(done) {
          return _this.remotes.execHooks('before', method, inst, _this.ctx, done);
        };
      })(this), (function(_this) {
        return function(done) {
          return _this.messageQueue.sendMessage(message, true, done);
        };
      })(this), (function(_this) {
        return function(done) {
          return _this.remotes.execHooks('after', method, inst, _this.ctx, done);
        };
      })(this)
    ];
    async.series(run, callback);
  };

  return RemoteAdapter;

})();

module.exports = RemoteAdapter;
