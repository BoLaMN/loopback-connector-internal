debug = require('debug') 'loopback:connector:internal:sqs'

aws = require 'aws-sdk'
async = require 'async'

{ EventEmitter } = require 'events'
{ isString, uniqueId } = require 'lodash'

class RemoteSQSAdapter extends EventEmitter
  constructor: (@settings) ->
    super()

    @stopped = true
    @messages = {}

    @settings.options.signatureVersion = 'v4'
    aws.config.update @settings.options

    sqs = @settings.options or {}

    @receiveParams =
      QueueUrl: @settings.subscribe
      AttributeNames: sqs.attributeNames or []
      MessageAttributeNames: sqs.messageAttributeNames or []
      MaxNumberOfMessages: sqs.batchSize or 10
      WaitTimeSeconds: sqs.waitTimeSeconds or 3
      VisibilityTimeout: sqs.visibilityTimeout

    @sqs = new aws.SQS()

    @receiveBound = @receive.bind this
    @processBound = @process.bind this

  connect: ->
    if @stopped
      @stopped = false
      @poll()

    this

  disconnect: ->
    @stopped = true

  poll: ->
    if not @stopped
      debug 'polling for messages'

      @sqs.receiveMessage @receiveParams, @receiveBound

    return

  receive: (err, response = {}) ->
    debug 'received SQS response', response

    poll = @poll.bind this

    if response.Messages?.length > 0
      async.each response.Messages, @processBound, ->
        poll()
    else poll()

    return

  process: (sqsMessage, callback) ->
    message = JSON.parse sqsMessage.Body

    @messages[message.id] = sqsMessage
    @emit 'message', message

    callback()

    return

  respond: (message) ->
    run = [
      (done) => @delete message, done
      (done) => @send message, done
    ]

    async.series run

  finish: (message) ->
    @delete message

  send: (message, callback = ->) ->
    params =
      MessageBody: if isString message then message else JSON.stringify message
      QueueUrl: @settings.publish

    debug 'sending ', params

    @sqs.sendMessage params, (err) ->
      if err
        debug 'error sending', err
      callback err

  delete: (message, callback = ->) ->
    sqsMessage = @messages[message.id]
    delete @messages[message.id]

    deleteParams =
      QueueUrl: @settings.subscribe
      ReceiptHandle: sqsMessage.ReceiptHandle

    debug 'deleting message %s', sqsMessage.MessageId

    @sqs.deleteMessage deleteParams, callback

    return

module.exports = RemoteSQSAdapter