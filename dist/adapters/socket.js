var EventEmitter, RemoteSocketAdapter, debug,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('loopback:connector:internal:websocket');

EventEmitter = require('events').EventEmitter;

RemoteSocketAdapter = (function(superClass) {
  extend(RemoteSocketAdapter, superClass);

  function RemoteSocketAdapter(settings) {
    this.settings = settings;
    this.sendHeartbeat = bind(this.sendHeartbeat, this);
    RemoteSocketAdapter.__super__.constructor.call(this);
    this.queue = [];
    this.missedHeartbeats = 0;
    this.heartbeatPromise = void 0;
    this.heartbeatMsg = 'pong';
    this.heartbeatAck = 'ping';
    this.open();
  }

  RemoteSocketAdapter.prototype.sendHeartbeat = function() {
    this.missedHeartbeats++;
    if (this.missedHeartbeats > 3) {
      return this.close();
    } else if (this.socket.readyState === this.socket.OPEN) {
      return this.send(this.heartbeatMsg);
    }
  };

  RemoteSocketAdapter.prototype.close = function() {
    clearInterval(this.heartbeatPromise);
    return this.socket.close();
  };

  RemoteSocketAdapter.prototype.connect = function() {
    this.socket = new WebSocket(this.settings.url);
    this.socket.onopen = (function(_this) {
      return function() {
        _this.flush();
        if (!_this.heartbeatPromise) {
          _this.missedHeartbeats = 0;
          return _this.heartbeatPromise = setInterval(_this.sendHeartbeat, 5000);
        }
      };
    })(this);
    this.socket.onmessage = (function(_this) {
      return function(message) {
        var newMessage;
        newMessage = JSON.parse(message.data);
        if (newMessage !== _this.heartbeatAck) {
          return _this.emit(newMessage);
        } else {
          return _this.missedHeartbeats = 0;
        }
      };
    })(this);
    return this;
  };

  RemoteSocketAdapter.prototype.send = function(message) {
    if (this.socket) {
      if (this.socket.readyState !== this.socket.OPEN) {
        this.queue.push(data);
        if (this.socket.readyState === this.socket.CLOSED) {
          return this.open();
        }
      } else {
        return this.socket.send(isString(message) ? message : JSON.stringify(message));
      }
    } else {
      return this.queue.push(message);
    }
  };

  RemoteSocketAdapter.prototype.flush = function() {
    var message, results;
    results = [];
    while (message = this.queue.pop()) {
      results.push(this.send(message));
    }
    return results;
  };

  return RemoteSocketAdapter;

})(EventEmitter);

module.exports = RemoteSocketAdapter;
