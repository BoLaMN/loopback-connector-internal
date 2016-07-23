var EventEmitter, RemoteAdapter, RemoteContext, async, debug, uniqueId,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('loopback:connector:internal:adapter');

uniqueId = require('lodash').uniqueId;

RemoteContext = require('./context').RemoteContext;

EventEmitter = require('events').EventEmitter;

async = require('async');


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
    this.ctx = new RemoteContext(this.options);
  }

  RemoteAdapter.prototype.connect = function(adapter) {
    var adapterClass;
    adapterClass = require(adapter);
    this.messageQueue = new adapterClass(this.options);
    this.messageQueue.connect().on('message', this.message);
    return this;
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

  RemoteAdapter.prototype.message = function(message) {
    var args, ctorArgs, data, err, id, inst, method, methodString, respond, type;
    type = message.type;
    if (type === 'response') {
      id = message.id, data = message.data, err = message.err;
      this.requests[id](err, data);
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

})(EventEmitter);

module.exports = RemoteAdapter;
