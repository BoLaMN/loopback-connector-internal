debug = require('debug') 'loopback:connector:internal:sqs'

aws = require 'aws-sdk'
async = require 'async'

{ isString, uniqueId } = require 'lodash'

class RemoteSQSAdapter
  constructor: (handleMessage, @settings) ->
    @stopped = true
    @requests = {}

    @settings.options.signatureVersion = 'v4'
    aws.config.update @settings.options

    sqs = @settings.options or {}

    @receiveParams =
      QueueUrl: @settings.subscribe
      AttributeNames: sqs.attributeNames or []
      MessageAttributeNames: sqs.messageAttributeNames or []
      MaxNumberOfMessages: sqs.batchSize or 10
      WaitTimeSeconds: sqs.waitTimeSeconds or 20
      VisibilityTimeout: sqs.visibilityTimeout

    @sqs = new aws.SQS()

    @handleMessage = handleMessage.bind this

    @handleSqsResponseBound = @handleSqsResponse.bind(this)
    @processMessageBound = @processMessage.bind(this)

  connect: ->
    if @stopped
      @stopped = false
      @poll()

  disconnect: ->
    @stopped = true

  poll: ->
    if not @stopped
      debug 'polling for messages'

      @sqs.receiveMessage @receiveParams, @handleSqsResponseBound

    return

  handleSqsResponse: (err, response = {}) ->
    debug 'received SQS response', response

    if response.Messages?.length > 0
      async.each response.Messages, @processMessageBound, @poll
    else @poll()

    return

  processMessage: (message, callback) ->
    body = JSON.parse message.Body

    run = [
      (done) => @handleMessage body, done
      (done) => @deleteMessage message, done
    ]

    async.series run, callback

    return

  sendMessage: (message, waitForResponse, callback) ->
    params =
      MessageBody: if isString message then message else JSON.stringify message
      QueueUrl: @settings.publish

    debug 'sending ', message

    if waitForResponse
      @requests[message.id] = callback
      callback = ->

    @sqs.sendMessage params, callback

  deleteMessage: (message, callback) ->
    deleteParams =
      QueueUrl: @settings.subscribe
      ReceiptHandle: message.ReceiptHandle

    debug 'deleting message %s', message.MessageId

    @sqs.deleteMessage deleteParams, callback

    return

module.exports = RemoteSQSAdapter