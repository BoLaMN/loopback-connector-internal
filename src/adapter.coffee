debug = require('debug')('loopback:connector:internal:adapter')

{ uniqueId } = require 'lodash'
{ RemoteContext } = require './context'
{ EventEmitter } = require 'events'

BaseContext = require 'strong-remoting/lib/context-base'

promise = require 'bluebird'

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
    @requests = {}

    @ctx = new RemoteContext @options

  connect: (adapter) ->
    try
      adapterClass = require adapter
    catch e
      throw e

    @messageQueue = new adapterClass @options

    @messageQueue.connect().on 'message', @message

    this

  request: (ctx) ->
    resolve = undefined
    reject = undefined

    defer = new promise (args...) ->
      [ resolve, reject ] = args

    @requests[ctx.message.id] =
      resolve: resolve
      reject: reject

    @messageQueue.send ctx.message

    defer.then (results) ->
      if not results and ctx.method.isReturningArray()
        results = []

      ctx.results = results
      ctx

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

      promise = @requests[id]

      if err
        promise.reject err
      else
        promise.resolve data

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

  context: (methodString, ctorArgs, args) ->
    method = @remotes.findMethod methodString
    ctx = new BaseContext method

    if method.isStatic
      ctx.inst = method.ctor
    else
      ctx.inst = method.sharedCtor

    ctx.message =
      type: 'request'
      id: uniqueId()
      args: @ctx.buildArgs ctorArgs, args, method
      ctorArgs: ctorArgs
      methodString: methodString

    promise.resolve ctx

  exec: (type, ctx) ->
    new promise (resolve, reject) =>
      @remotes.execHooks type, ctx.method, ctx.inst, ctx, (err) ->
        if err
          return reject err
        resolve ctx

  invoke: (args...) ->
    promise.bind this
      .then ->
        @context args...
      .then (ctx) ->
        @exec 'before', ctx
      .then (ctx) ->
        @request ctx
      .then (ctx) ->
        @exec 'after', ctx
      .then (ctx) ->
        ctx.results

module.exports = RemoteAdapter