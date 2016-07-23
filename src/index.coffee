debug = require('debug') 'loopback:connector:internal:main'

assert = require 'assert'
remoting = require 'strong-remoting'

utils = require 'loopback-datasource-juggler/lib/utils'
jutil = require 'loopback-datasource-juggler/lib/jutil'

InclusionMixin = require 'loopback-datasource-juggler/lib/include'
List = require 'loopback-datasource-juggler/lib/list'

RelationMixin = require './relation'
RemoteAdapter = require './adapter'

class RemoteConnector
  @adapters:
    sqs: './adapters/sqs'

  constructor: (settings) ->
    @name = 'internal'

    @remotes = remoting.create()

    for own key, value of settings
      @[key] = value

    @remote = new RemoteAdapter @remotes, settings

    DAO = @DataAccessObject = ->

    @connect @adapter

    return

  connect: (adapter) ->
    @remote.connect RemoteConnector.adapters[adapter] or adapter
    @remotes.serverAdapter = @remote

    return

  @initialize: (dataSource, callback) ->
    dataSource.connector = new RemoteConnector dataSource.settings

    callback()

    return

  coerceRemoteDataType: (Model, data) ->
    if not data
      return data

    instance = new Model data

    Object.keys(Model.relations).forEach (relationName) ->
      relation = Model.relations[relationName]

      if not data.hasOwnProperty relationName
        return

      relatedValue = data[relationName]

      if Array.isArray(relatedValue) and !(relatedValue instanceof List)
        relatedValue = new List(relatedValue, relation.modelTo)

      instance.__cachedRelations[relationName] = relatedValue
      instance.__data[relationName] = relatedValue
      instance.setStrict false

      return

    instance

  createProxyMethod: (Model, remoteMethod) ->
    if remoteMethod.name is 'Change' or remoteMethod.name is 'Checkpoint'
      return

    scope = if remoteMethod.isStatic then Model else Model.prototype
    original = scope[remoteMethod.name]

    if original?.__isProxy
      return

    proxyMethod = @remoteMethodProxy remoteMethod

    scope[remoteMethod.name] = proxyMethod
    scope[remoteMethod.name].__isProxy = true

    remoteMethod.aliases.forEach (alias) ->
      scope[alias] = proxyMethod
      return

    return

  registerAdapter: (name, adapterClass) ->
    RemoteConnector.adapters[name] = adapterClass

  remoteMethodProxy: (remoteMethod) ->
    remote = @remote

    (args...) ->
      if typeof args[args.length - 1] is 'function'
        callback = args.pop()

      remote.invoke remoteMethod.stringName, [ @id ], args
        .asCallback callback

  define:  (definition) ->
    Model = definition.model

    assert Model.sharedClass, 'cannot attach ' + Model.modelName + ' to a remote connector without a Model.sharedClass'

    jutil.mixin Model, RelationMixin
    jutil.mixin Model, InclusionMixin

    @remotes.addClass Model.sharedClass

    @resolve Model

    return

  resolve: (Model) ->
    Model.sharedClass.methods().forEach (remoteMethod) =>
      @createProxyMethod Model, remoteMethod

    @remotes.defineType Model.modelName, @coerceRemoteDataType.bind(null, Model)

    return

module.exports = RemoteConnector