var BaseContext, EventEmitter, RemoteAdapter, RemoteRequest, debug, promise,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

debug = require('debug')('loopback:connector:internal:adapter');

RemoteRequest = require('./request').RemoteRequest;

EventEmitter = require('events').EventEmitter;

BaseContext = require('./base-context').BaseContext;

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
    this.messageQueue.connect().on('message', this.message.bind(this));
    return this;
  };

  RemoteAdapter.prototype.getApp = function() {
    var classes, firstClass;
    if (!this.app) {
      classes = this.remotes._classes;
      firstClass = Object.keys(classes)[0];
      this.app = classes[firstClass].ctor.app;
    }
    return this.app;
  };

  RemoteAdapter.prototype.toRPC = function() {
    var methods, result;
    result = {};
    methods = this.getApp()._remotes.methods();
    methods.forEach(function(sharedMethod) {
      var ref;
      result[sharedMethod.stringName] = {
        http: (ref = sharedMethod.fn) != null ? ref.http : void 0,
        accepts: sharedMethod.accepts,
        returns: sharedMethod.returns,
        errors: sharedMethod.errors
      };
    });
    return result;
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
    this.requests[ctx.id] = {
      ctx: ctx,
      resolve: resolve,
      reject: reject
    };
    this.messageQueue.send(ctx);
    return defer.then(function(results) {
      if (!results && ctx.method.isReturningArray()) {
        results = [];
      }
      ctx.results = results;
      return ctx;
    });
  };

  RemoteAdapter.prototype.respond = function(ctx) {
    return this.messageQueue.respond(ctx);
  };

  RemoteAdapter.prototype.finish = function(message) {
    return this.messageQueue.finish(message);
  };

  RemoteAdapter.prototype.message = function(message) {
    var args, ctorArgs, ctx, defer, err, id, methodString, respond, results, type;
    type = message.type;
    if (type === 'rpc') {
      respond = this.respond.bind(this);
      return respond({
        results: this.toRPC(),
        id: message.id
      });
    } else if (type === 'response') {
      id = message.id, results = message.results, err = message.err;
      defer = this.requests[id];
      if (!defer) {
        return this.finish(message);
      }
      ctx = defer.ctx;
      if (err) {
        defer.reject(err);
      } else {
        defer.resolve(results);
      }
      delete this.requests[id];
      return this.finish(message);
    } else if (type === 'request') {
      methodString = message.methodString, ctorArgs = message.ctorArgs, args = message.args, id = message.id;
      respond = this.respond.bind(this);
      ctx = this.context(methodString, ctorArgs, args, id);
      if (!ctx.method || ctx.method.__isProxy) {
        ctx.err = 'method does not exist';
        return respond(ctx);
      }
      return this.req.invoke(ctx, respond);
    } else {
      return this.emit('message', message);
    }
  };

  RemoteAdapter.prototype.context = function(methodString, ctorArgs, args, id) {
    var method, type;
    type = 'request';
    if (id) {
      type = 'response';
    }
    if (type === 'request') {
      method = this.remotes.findMethod(methodString);
    } else if (type === 'response') {
      method = this.getApp()._remotes.findMethod(methodString);
    }
    return new BaseContext(id, type, methodString, method, ctorArgs, args);
  };

  RemoteAdapter.prototype.exec = function(type, ctx) {
    return new promise((function(_this) {
      return function(resolve, reject) {
        return _this.getApp()._remotes.execHooks(type, ctx.method, ctx.scope, ctx, function(err) {
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
    });
  };

  return RemoteAdapter;

})(EventEmitter);

module.exports = RemoteAdapter;
