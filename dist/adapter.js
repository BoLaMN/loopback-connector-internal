var BaseContext, EventEmitter, RemoteAdapter, RemoteContext, debug, promise, uniqueId,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

debug = require('debug')('loopback:connector:internal:adapter');

uniqueId = require('lodash').uniqueId;

RemoteContext = require('./context').RemoteContext;

EventEmitter = require('events').EventEmitter;

BaseContext = require('strong-remoting/lib/context-base');

promise = require('bluebird');


/**
 * Create a new `RemoteAdapter` with the given `options`.
#
 * @param {Object} options
 * @return {SQSAdapter}
 */

RemoteAdapter = (function(superClass) {
  extend(RemoteAdapter, superClass);

  function RemoteAdapter(remotes, options) {
    this.remotes = remotes;
    RemoteAdapter.__super__.constructor.call(this);
    this.options = options || this.remotes.options;
    this.requests = {};
    this.ctx = new RemoteContext(this.options);
  }

  RemoteAdapter.prototype.connect = function(adapter) {
    var adapterClass, e;
    try {
      adapterClass = require(adapter);
    } catch (_error) {
      e = _error;
      throw e;
    }
    this.messageQueue = new adapterClass(this.options);
    this.messageQueue.connect().on('message', this.message);
    return this;
  };

  RemoteAdapter.prototype.request = function(ctx) {
    var defer, reject, resolve;
    resolve = void 0;
    reject = void 0;
    defer = new promise(function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return resolve = args[0], reject = args[1], args;
    });
    this.requests[ctx.message.id] = {
      resolve: resolve,
      reject: reject
    };
    this.messageQueue.send(ctx.message);
    return defer.then(function(results) {
      if (!results && ctx.method.isReturningArray()) {
        results = [];
      }
      ctx.results = results;
      return ctx;
    });
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

  RemoteAdapter.prototype.message = function(message) {
    var args, ctorArgs, data, err, id, inst, method, methodString, respond, type;
    type = message.type;
    if (type === 'response') {
      id = message.id, data = message.data, err = message.err;
      promise = this.requests[id];
      if (err) {
        promise.reject(err);
      } else {
        promise.resolve(data);
      }
      return delete this.requests[id];
    } else if (type === 'response') {
      methodString = message.methodString, ctorArgs = message.ctorArgs, args = message.args, id = message.id;
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
    } else {
      return this.emit('message', message);
    }
  };

  RemoteAdapter.prototype.context = function(methodString, ctorArgs, args) {
    var ctx, method;
    method = this.remotes.findMethod(methodString);
    ctx = new BaseContext(method);
    if (method.isStatic) {
      ctx.inst = method.ctor;
    } else {
      ctx.inst = method.sharedCtor;
    }
    ctx.message = {
      type: 'request',
      id: uniqueId(),
      args: this.ctx.buildArgs(ctorArgs, args, method),
      ctorArgs: ctorArgs,
      methodString: methodString
    };
    return promise.resolve(ctx);
  };

  RemoteAdapter.prototype.exec = function(type, ctx) {
    return new promise((function(_this) {
      return function(resolve, reject) {
        return _this.remotes.execHooks(type, ctx.method, ctx.inst, ctx, function(err) {
          if (err) {
            return reject(err);
          }
          return resolve(ctx);
        });
      };
    })(this));
  };

  RemoteAdapter.prototype.invoke = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    return promise.bind(this).then(function() {
      return this.context.apply(this, args);
    }).then(function(ctx) {
      return this.exec('before', ctx);
    }).then(function(ctx) {
      return this.request(ctx);
    }).then(function(ctx) {
      return this.exec('after', ctx);
    }).then(function(ctx) {
      return ctx.results;
    });
  };

  return RemoteAdapter;

})(EventEmitter);

module.exports = RemoteAdapter;
