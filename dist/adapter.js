var BaseContext, EventEmitter, RemoteAdapter, RemoteRequest, debug, promise, uniqueId,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

debug = require('debug')('loopback:connector:internal:adapter');

uniqueId = require('lodash').uniqueId;

RemoteRequest = require('./request').RemoteRequest;

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
    this.req = new RemoteRequest(this.options);
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

  RemoteAdapter.prototype.respond = function(ctx) {
    return this.messageQueue.respond(ctx.message);
  };

  RemoteAdapter.prototype.message = function(message) {
    var args, ctorArgs, ctx, data, err, id, methodString, respond, type;
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
      ctx = this.context(methodString, ctorArgs, args, id);
      if (!ctx.method || ctx.method.__isProxy) {
        ctx.message.err = 'method does not exist';
        return respond(ctx);
      }
      return this.req.invoke(ctx, respond);
    } else {
      return this.emit('message', message);
    }
  };

  RemoteAdapter.prototype.context = function(methodString, ctorArgs, args, id) {
    var ctx, method, type;
    method = this.remotes.findMethod(methodString);
    ctx = new BaseContext(method);
    ctx.args = this.req.buildArgs(ctorArgs, args, method);
    if (method.isStatic) {
      ctx.scope = method.ctor;
    } else {
      ctx.scope = method.sharedCtor;
    }
    type = 'request';
    if (id) {
      type = 'respose';
    }
    ctx.message = {
      type: type,
      id: id || uniqueId(),
      args: ctx.args,
      ctorArgs: ctorArgs,
      methodString: methodString
    };
    return ctx;
  };

  RemoteAdapter.prototype.exec = function(type, ctx) {
    return new promise((function(_this) {
      return function(resolve, reject) {
        return _this.remotes.execHooks(type, ctx.method, ctx.scope, ctx, function(err) {
          if (err) {
            return reject(err);
          }
          return resolve(ctx);
        });
      };
    })(this));
  };

  RemoteAdapter.prototype.invoke = function() {
    var args, ctx;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    ctx = this.context.apply(this, args);
    return promise.bind(this).then(function() {
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
