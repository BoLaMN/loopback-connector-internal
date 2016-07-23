debug = require('debug') 'loopback:connector:internal:relation'

{ RelationDefinition } = require 'loopback-datasource-juggler/lib/relation-definition'

fns = [
  'count', 'create', 'deleteById', 'all'
  'destroyById', 'exists', 'findById'
]

defineRelationProperty = (modelClass, def) ->
  getter = ->
    that = this

    builddFn = (method) ->
      -> that['__' + method + '__' + def.name].apply that, arguments

    scope = builddFn 'get'

    fns.forEach (method) ->
      scope[method] = builddFn 'method'

    scope

  Object.defineProperty modelClass.prototype, def.name, get: getter

  return

###*
# RemoteRelationMixin class. Wraps all vivified relations to ensure they are
# proxied through the remote connector.
#
# @class RemoteRelationMixin
###

RemoteRelationMixin = ->

Object.keys(RelationDefinition).forEach (relation) ->
  RemoteRelationMixin[relation] = (modelTo, params) ->
    @dataSource.adapter.resolve this

    def = RelationDefinition[relation](this, modelTo, params)
    defineRelationProperty this, def

    return

module.exports = RemoteRelationMixin