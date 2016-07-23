var RelationDefinition, RemoteRelationMixin, debug, defineRelationProperty, fns;

debug = require('debug')('loopback:connector:internal:relation');

RelationDefinition = require('loopback-datasource-juggler/lib/relation-definition').RelationDefinition;

fns = ['count', 'create', 'deleteById', 'all', 'destroyById', 'exists', 'findById'];

defineRelationProperty = function(modelClass, def) {
  var getter;
  getter = function() {
    var builddFn, scope, that;
    that = this;
    builddFn = function(method) {
      return function() {
        return that['__' + method + '__' + def.name].apply(that, arguments);
      };
    };
    scope = builddFn('get');
    fns.forEach(function(method) {
      return scope[method] = builddFn('method');
    });
    return scope;
  };
  Object.defineProperty(modelClass.prototype, def.name, {
    get: getter
  });
};


/**
 * RemoteRelationMixin class. Wraps all vivified relations to ensure they are
 * proxied through the remote connector.
#
 * @class RemoteRelationMixin
 */

RemoteRelationMixin = function() {};

Object.keys(RelationDefinition).forEach(function(relation) {
  return RemoteRelationMixin[relation] = function(modelTo, params) {
    var def;
    this.dataSource.adapter.resolve(this);
    def = RelationDefinition[relation](this, modelTo, params);
    defineRelationProperty(this, def);
  };
});

module.exports = RemoteRelationMixin;
