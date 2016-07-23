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
    this.messageQueue = new adapterClass(this.options);
    return this.messageQueue.connect().on('message', this.message);
  };

  RemoteAdapter.prototype.request = function(message, callback) {
    this.requests[message.id] = callback;
    return this.messageQueue.send(message);
  };

  RemoteAdapter.prototype.respond = function(id) {
    var messageQueue;
    messageQueue = this.messageQueue;
    return function(err, data) {
      if (data == null) {
        data = null;
      }
      return messageQueue.respond({
        type: 'response',
        data: data,
        id: id,
        err: err
      });
    };
  };

  RemoteAdapter.prototype.message = function(arg) {
    var args, ctorArgs, data, id, inst, method, methodString, respond, type;
    methodString = arg.methodString, ctorArgs = arg.ctorArgs, args = arg.args, id = arg.id, data = arg.data, type = arg.type;
    if (type === 'response') {
      this.requests[id](data);
      delete this.requests[id];
      return;
    }
    respond = this.respond(id);
    method = this.remotes.findMethod(methodString);
    if (!method || method.__isProxy) {
      return respond('method does not exist');
    }
    args = this.ctx.buildArgs(ctorArgs, args, method);
    if (method.isStatic) {
      inst = method.ctor;
    } else {
      inst = method.sharedCtor;
    }
    return this.ctx.invoke(inst, method, args, respond);
  };

  RemoteAdapter.prototype.invoke = function(methodString, ctorArgs, args, callback) {
    var inst, message, method, run;
    method = this.remotes.findMethod(methodString);
    args = this.ctx.buildArgs(ctorArgs, args, method);
    message = {
      type: 'request',
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
          return _this.request(message, done);
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
