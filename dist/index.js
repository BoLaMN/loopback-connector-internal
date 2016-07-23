var InclusionMixin, List, RelationMixin, RemoteAdapter, RemoteConnector, assert, debug, jutil, remoting, utils,
  hasProp = {}.hasOwnProperty,
  slice = [].slice;

debug = require('debug')('loopback:connector:internal:main');

assert = require('assert');

remoting = require('strong-remoting');

utils = require('loopback-datasource-juggler/lib/utils');

jutil = require('loopback-datasource-juggler/lib/jutil');

InclusionMixin = require('loopback-datasource-juggler/lib/include');

List = require('loopback-datasource-juggler/lib/list');

RelationMixin = require('./relation');

RemoteAdapter = require('./adapter');

RemoteConnector = (function() {
  RemoteConnector.adapters = {
    sqs: './adapters/sqs'
  };

  function RemoteConnector(settings) {
    var DAO, key, value;
    this.name = 'internal';
    this.remotes = remoting.create();
    for (key in settings) {
      if (!hasProp.call(settings, key)) continue;
      value = settings[key];
      this[key] = value;
    }
    this.remote = new RemoteAdapter(this.remotes, settings);
    DAO = this.DataAccessObject = function() {};
    this.connect(this.adapter);
    return;
  }

  RemoteConnector.prototype.connect = function(adapter) {
    this.remote.connect(RemoteConnector.adapters[adapter]);
    this.remotes.serverAdapter = this.remote;
  };

  RemoteConnector.initialize = function(dataSource, callback) {
    dataSource.connector = new RemoteConnector(dataSource.settings);
    callback();
  };

  RemoteConnector.prototype.coerceRemoteDataType = function(Model, data) {
    var instance;
    if (!data) {
      return data;
    }
    instance = new Model(data);
    Object.keys(Model.relations).forEach(function(relationName) {
      var relatedValue, relation;
      relation = Model.relations[relationName];
      if (data.hasOwnProperty(relationName)) {
        relatedValue = data[relationName];
        if (Array.isArray(relatedValue) && !(relatedValue instanceof List)) {
          relatedValue = new List(relatedValue, relation.modelTo);
        }
        instance.__cachedRelations[relationName] = relatedValue;
        instance.__data[relationName] = relatedValue;
        instance.setStrict(false);
      }
    });
    return instance;
  };

  RemoteConnector.prototype.createProxyMethod = function(Model, remoteMethod) {
    var original, proxyMethod, scope;
    if (remoteMethod.name === 'Change' || remoteMethod.name === 'Checkpoint') {
      return;
    }
    scope = remoteMethod.isStatic ? Model : Model.prototype;
    original = scope[remoteMethod.name];
    if (original != null ? original.__isProxy : void 0) {
      return;
    }
    proxyMethod = this.remoteMethodProxy(remoteMethod);
    scope[remoteMethod.name] = proxyMethod;
    scope[remoteMethod.name].__isProxy = true;
    remoteMethod.aliases.forEach(function(alias) {
      scope[alias] = proxyMethod;
    });
  };

  RemoteConnector.prototype.registerAdapter = function(name, adapterClass) {
    return RemoteConnector.adapters[name] = adapterClass;
  };

  RemoteConnector.prototype.remoteMethodProxy = function(remoteMethod) {
    var remotes;
    remotes = this.remotes;
    return function() {
      var args, callback, ctorArgs, lastArgIsFunc;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      lastArgIsFunc = typeof args[args.length - 1] === 'function';
      if (lastArgIsFunc) {
        callback = args.pop();
      } else {
        callback = utils.createPromiseCallback();
      }
      ctorArgs = [];
      if (remoteMethod.isStatic) {
        ctorArgs.push(this.id);
      }
      remotes.invoke(remoteMethod.stringName, ctorArgs, args, callback);
      return callback.promise;
    };
  };

  RemoteConnector.prototype.define = function(definition) {
    var Model;
    Model = definition.model;
    assert(Model.sharedClass, 'cannot attach ' + Model.modelName + ' to a remote connector without a Model.sharedClass');
    jutil.mixin(Model, RelationMixin);
    jutil.mixin(Model, InclusionMixin);
    this.remotes.addClass(Model.sharedClass);
    this.resolve(Model);
  };

  RemoteConnector.prototype.resolve = function(Model) {
    Model.sharedClass.methods().forEach((function(_this) {
      return function(remoteMethod) {
        return _this.createProxyMethod(Model, remoteMethod);
      };
    })(this));
    this.remotes.defineType(Model.modelName, this.coerceRemoteDataType.bind(null, Model));
  };

  return RemoteConnector;

})();

module.exports = RemoteConnector;
