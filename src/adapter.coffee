debug = require('debug')('loopback:connector:internal:adapter')

{ uniqueId } = require 'lodash'
{ RemoteContext } = require './context'

async = require 'async'

###*
# Create a new `RemoteAdapter` with the given `options`.
#
# @param {Object} options
# @return {SQSAdapter}
###

class RemoteAdapter
  constructor: (@remotes, options) ->
    @options = options or @remotes.options

    @ctx = new RemoteContext @options

  connect: (adapter) ->
    adapterClass = require adapter

    @messageQueue = new adapterClass @options

    @messageQueue.connect().on 'message', @message

  request: (message, callback) ->
    @requests[message.id] = callback

    @messageQueue.send message

  respond: (id) ->
    messageQueue = @messageQueue

    (err, data = null) ->
      messageQueue.respond
        type: 'response'
        data: data
        id: id
        err: err

  message: ({ methodString, ctorArgs, args, id, data, type }) ->
    if type is 'response'
      @requests[id] data
      delete @requests[id]
      return

    respond = @respond id
    method = @remotes.findMethod methodString

    if not method or method.__isProxy
      return respond 'method does not exist'

    args = @ctx.buildArgs ctorArgs, args, method

    if method.isStatic
      inst = method.ctor
    else
      inst = method.sharedCtor

    @ctx.invoke inst, method, args, respond

  invoke: (methodString, ctorArgs, args, callback) ->
    method = @remotes.findMethod methodString
    args = @ctx.buildArgs ctorArgs, args, method

    message =
      type: 'request'
      id: uniqueId()
      args: args
      ctorArgs: ctorArgs
      methodString: methodString

    if method.isStatic
      inst = method.ctor
    else
      inst = method.sharedCtor

    run = [
      (done) => @remotes.execHooks 'before', method, inst, @ctx, done
      (done) => @request message, done
      (done) => @remotes.execHooks 'after', method, inst, @ctx, done
    ]

    async.series run, callback

    return

module.exports = RemoteAdapter