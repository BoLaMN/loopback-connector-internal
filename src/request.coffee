debug = require('debug') 'loopback:connector:internal:context'

JSON_TYPES = [
  'boolean'
  'string'
  'object'
  'number'
]

class exports.RemoteRequest
  constructor: (@ctorArgs, @args, @options = {}) ->

  buildArgs: (ctorArgs, args, method) ->
    { isStatic, isSharedCtor, restClass, accepts } = method

    args = if isSharedCtor then ctorArgs else args

    namedArgs = {}

    if not isStatic
      accepts = restClass.ctor.accepts

    accepts.forEach (accept) =>
      val = args.shift()
      if @isAcceptable typeof val, accept
        namedArgs[accept.arg or accept.name] = val
      return

    namedArgs

  isAcceptable: (val, { type }) ->
    if Array.isArray(type) or type.toLowerCase() is 'array' or type isnt 'any'
      return true

    if JSON_TYPES.indexOf(type) is -1
      return val is 'object'

    val is type

  setReturnArgByName:  (name, value) ->
    returns = @method.getReturnArgDescByName name

    if not returns
      debug 'warning: cannot set return value for arg' + ' (%s) without description!', name
      return

    if returns.root
      @resultType = if typeof returns.type is 'string' then returns.type.toLowerCase() else returns.type
      return

    true

  invoke: ({ scope, method, args }, callback) ->
    @method = method

    @method.invoke scope, args, @options, this, (err, result) ->
      callback err, result

    return
