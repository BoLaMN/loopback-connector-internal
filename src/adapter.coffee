debug = require('debug')('loopback:connector:internal:adapter')

{ uniqueId } = require 'lodash'
{ RemoteContext } = require './context'
{ EventEmitter } = require 'events'

async = require 'async'

###*
# Create a new `RemoteAdapter` with the given `options`.
#
# @param {Object} options
# @return {SQSAdapter}
###

class RemoteAdapter extends EventEmitter
  constructor: (@remotes, options) ->
    super()

    @options = options or @remotes.options

    @ctx = new RemoteContext @options

  connect: (adapter) ->
    try
      adapterClass = require adapter
    catch e
      throw e

    @messageQueue = new adapterClass @options

    @messageQueue.connect().on 'message', @message

    this

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

  message: (message) ->
    { type } = message

    if type is 'response'
      { id, data, err } = message

      @requests[id] err, data
      delete @requests[id]

    else if type is 'response'
      { methodString, ctorArgs, args, id } = message

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
    else
      @emit 'message', message

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