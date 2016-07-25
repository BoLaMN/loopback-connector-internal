debug = require('debug')('loopback:connector:internal:adapter')

{ RemoteRequest } = require './request'
{ EventEmitter } = require 'events'
{ BaseContext } = require './base-context'

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

    @req = new RemoteRequest @options

  connect: (adapter) ->
    try
      adapterClass = require adapter
    catch e
      throw e

    @messageQueue = new adapterClass @options

    @messageQueue.connect().on 'message', @message.bind(this)

    this

  getApp: ->
    if not @app
      classes = @remotes._classes
      firstClass = Object.keys(classes)[0]

      @app = classes[firstClass].ctor.app
    @app

  toRPC: ->
    result = {}

    methods = @getApp()._remotes.methods()

    methods.forEach (sharedMethod) ->
      result[sharedMethod.stringName] =
        http: sharedMethod.fn?.http
        accepts: sharedMethod.accepts
        returns: sharedMethod.returns
        errors: sharedMethod.errors
      return

    result

  request: (ctx) ->
    resolve = undefined
    reject = undefined

    defer = new promise (args...) ->
      [ resolve, reject ] = args

    @requests[ctx.id] =
      ctx: ctx
      resolve: resolve
      reject: reject

    @messageQueue.send ctx

    defer.then (results) ->
      if not results and ctx.method.isReturningArray()
        results = []

      ctx.results = results
      ctx

  respond: (ctx) ->
    @messageQueue.respond ctx

  finish: (message) ->
    @messageQueue.finish message

  message: (message) ->
    { type } = message

    if type is 'rpc'
      respond = @respond.bind this

      respond
        results: @toRPC()
        id: message.id

    else if type is 'response'
      { id, results, err } = message

      defer = @requests[id]

      if not defer
        return @finish message

      ctx = defer.ctx

      if err
        defer.reject err
      else
        defer.resolve results

      delete @requests[id]
      @finish message

    else if type is 'request'
      { methodString, ctorArgs, args, id } = message

      respond = @respond.bind this
      ctx = @context methodString, ctorArgs, args, id

      if not ctx.method or ctx.method.__isProxy
        ctx.err = 'method does not exist'
        return respond ctx

      @req.invoke ctx, respond
    else
      @emit 'message', message

  context: (methodString, ctorArgs, args, id) ->
    type = 'request'

    if id
      type = 'response'

    if type is 'request'
      method = @remotes.findMethod methodString
    else if type is 'response'
      method = @getApp()._remotes.findMethod methodString

    new BaseContext id, type, methodString, method, ctorArgs, args

  exec: (type, ctx) ->
    new promise (resolve, reject) =>
      @getApp()._remotes.execHooks type, ctx.method, ctx.scope, ctx, (err) ->
        if err
          return reject err
        resolve ctx

  invoke: (args...) ->
    ctx = @context args...

    promise.bind this
      .then ->
        @exec 'before', ctx
      .then (ctx) ->
        @request ctx
      .then (ctx) ->
        @exec 'after', ctx

module.exports = RemoteAdapter