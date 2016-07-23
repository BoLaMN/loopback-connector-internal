var RemoteSQSAdapter, async, aws, debug, isString, ref, uniqueId;

debug = require('debug')('loopback:connector:internal:sqs');

aws = require('aws-sdk');

async = require('async');

ref = require('lodash'), isString = ref.isString, uniqueId = ref.uniqueId;

RemoteSQSAdapter = (function() {
  function RemoteSQSAdapter(handleMessage, settings) {
    var sqs;
    this.settings = settings;
    this.stopped = true;
    this.requests = {};
    this.settings.options.signatureVersion = 'v4';
    aws.config.update(this.settings.options);
    sqs = this.settings.options || {};
    this.receiveParams = {
      QueueUrl: this.settings.subscribe,
      AttributeNames: sqs.attributeNames || [],
      MessageAttributeNames: sqs.messageAttributeNames || [],
      MaxNumberOfMessages: sqs.batchSize || 10,
      WaitTimeSeconds: sqs.waitTimeSeconds || 20,
      VisibilityTimeout: sqs.visibilityTimeout
    };
    this.sqs = new aws.SQS();
    this.handleMessage = handleMessage.bind(this);
    this.handleSqsResponseBound = this.handleSqsResponse.bind(this);
    this.processMessageBound = this.processMessage.bind(this);
  }

  RemoteSQSAdapter.prototype.connect = function() {
    if (this.stopped) {
      this.stopped = false;
      return this.poll();
    }
  };

  RemoteSQSAdapter.prototype.disconnect = function() {
    return this.stopped = true;
  };

  RemoteSQSAdapter.prototype.poll = function() {
    if (!this.stopped) {
      debug('polling for messages');
      this.sqs.receiveMessage(this.receiveParams, this.handleSqsResponseBound);
    }
  };

  RemoteSQSAdapter.prototype.handleSqsResponse = function(err, response) {
    var ref1;
    if (response == null) {
      response = {};
    }
    debug('received SQS response', response);
    if (((ref1 = response.Messages) != null ? ref1.length : void 0) > 0) {
      async.each(response.Messages, this.processMessageBound, this.poll);
    } else {
      this.poll();
    }
  };

  RemoteSQSAdapter.prototype.processMessage = function(message, callback) {
    var body, run;
    body = JSON.parse(message.Body);
    run = [
      (function(_this) {
        return function(done) {
          return _this.handleMessage(body, done);
        };
      })(this), (function(_this) {
        return function(done) {
          return _this.deleteMessage(message, done);
        };
      })(this)
    ];
    async.series(run, callback);
  };

  RemoteSQSAdapter.prototype.sendMessage = function(message, waitForResponse, callback) {
    var params;
    params = {
      MessageBody: isString(message) ? message : JSON.stringify(message),
      QueueUrl: this.settings.publish
    };
    debug('sending ', message);
    if (waitForResponse) {
      this.requests[message.id] = callback;
      callback = function() {};
    }
    return this.sqs.sendMessage(params, callback);
  };

  RemoteSQSAdapter.prototype.deleteMessage = function(message, callback) {
    var deleteParams;
    deleteParams = {
      QueueUrl: this.settings.subscribe,
      ReceiptHandle: message.ReceiptHandle
    };
    debug('deleting message %s', message.MessageId);
    this.sqs.deleteMessage(deleteParams, callback);
  };

  return RemoteSQSAdapter;

})();

module.exports = RemoteSQSAdapter;
