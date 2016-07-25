var EventEmitter, RemoteSQSAdapter, async, aws, debug, isString, ref, uniqueId,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

debug = require('debug')('loopback:connector:internal:sqs');

aws = require('aws-sdk');

async = require('async');

EventEmitter = require('events').EventEmitter;

ref = require('lodash'), isString = ref.isString, uniqueId = ref.uniqueId;

RemoteSQSAdapter = (function(superClass) {
  extend(RemoteSQSAdapter, superClass);

  function RemoteSQSAdapter(settings) {
    var sqs;
    this.settings = settings;
    RemoteSQSAdapter.__super__.constructor.call(this);
    this.stopped = true;
    this.messages = {};
    this.settings.options.signatureVersion = 'v4';
    aws.config.update(this.settings.options);
    sqs = this.settings.options || {};
    this.receiveParams = {
      QueueUrl: this.settings.subscribe,
      AttributeNames: sqs.attributeNames || [],
      MessageAttributeNames: sqs.messageAttributeNames || [],
      MaxNumberOfMessages: sqs.batchSize || 10,
      WaitTimeSeconds: sqs.waitTimeSeconds || 3,
      VisibilityTimeout: sqs.visibilityTimeout
    };
    this.sqs = new aws.SQS();
    this.receiveBound = this.receive.bind(this);
    this.processBound = this.process.bind(this);
  }

  RemoteSQSAdapter.prototype.connect = function() {
    if (this.stopped) {
      this.stopped = false;
      this.poll();
    }
    return this;
  };

  RemoteSQSAdapter.prototype.disconnect = function() {
    return this.stopped = true;
  };

  RemoteSQSAdapter.prototype.poll = function() {
    if (!this.stopped) {
      debug('polling for messages');
      this.sqs.receiveMessage(this.receiveParams, this.receiveBound);
    }
  };

  RemoteSQSAdapter.prototype.receive = function(err, response) {
    var poll, ref1;
    if (response == null) {
      response = {};
    }
    debug('received SQS response', response);
    poll = this.poll.bind(this);
    if (((ref1 = response.Messages) != null ? ref1.length : void 0) > 0) {
      async.each(response.Messages, this.processBound, function() {
        return poll();
      });
    } else {
      poll();
    }
  };

  RemoteSQSAdapter.prototype.process = function(sqsMessage, callback) {
    var message;
    message = JSON.parse(sqsMessage.Body);
    this.messages[message.id] = sqsMessage;
    this.emit('message', message);
    callback();
  };

  RemoteSQSAdapter.prototype.respond = function(message) {
    var run;
    run = [
      (function(_this) {
        return function(done) {
          return _this["delete"](message, done);
        };
      })(this), (function(_this) {
        return function(done) {
          return _this.send(message, done);
        };
      })(this)
    ];
    return async.series(run);
  };

  RemoteSQSAdapter.prototype.finish = function(message) {
    return this["delete"](message);
  };

  RemoteSQSAdapter.prototype.send = function(message, callback) {
    var params;
    if (callback == null) {
      callback = function() {};
    }
    params = {
      MessageBody: isString(message) ? message : JSON.stringify(message),
      QueueUrl: this.settings.publish
    };
    debug('sending ', params);
    return this.sqs.sendMessage(params, function(err) {
      if (err) {
        debug('error sending', err);
      }
      return callback(err);
    });
  };

  RemoteSQSAdapter.prototype["delete"] = function(message, callback) {
    var deleteParams, sqsMessage;
    if (callback == null) {
      callback = function() {};
    }
    sqsMessage = this.messages[message.id];
    delete this.messages[message.id];
    deleteParams = {
      QueueUrl: this.settings.subscribe,
      ReceiptHandle: sqsMessage.ReceiptHandle
    };
    debug('deleting message %s', sqsMessage.MessageId);
    this.sqs.deleteMessage(deleteParams, callback);
  };

  return RemoteSQSAdapter;

})(EventEmitter);

module.exports = RemoteSQSAdapter;
