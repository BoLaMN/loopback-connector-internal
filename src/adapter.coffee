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

    @messageQueue = new adapterClass @message, @options

    @messageQueue.connect()

  message: (message, callback) ->
    { methodString, ctorArgs, args, id, result } = message

    if methodString
      method = @remotes.findMethod methodString

      if not method or method.__isProxy
        response =
          err: 'method does not exist'
          id: id
          methodString: methodString

        @messageQueue.sendMessage response, false, callback

        return

      args = @ctx.buildArgs ctorArgs, args, method

      if method.isStatic
        inst = method.ctor
      else
        inst = method.sharedCtor

      @ctx.invoke inst, method, args, (err, result) ->
        response =
          data: result
          id: id
          error: err

        @messageQueue.sendMessage response, false, callback
    else
      @messageQueue.requests[id] result

      callback()

  invoke: (methodString, ctorArgs, args, callback) ->
    method = @remotes.findMethod methodString
    args = @ctx.buildArgs ctorArgs, args, method

    message =
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
      (done) => @messageQueue.sendMessage message, true, done
      (done) => @remotes.execHooks 'after', method, inst, @ctx, done
    ]

    async.series run, callback

    return

module.exports = RemoteAdapter