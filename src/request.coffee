debug = require('debug') 'loopback:connector:internal:context'

JSON_TYPES = [
  'boolean'
  'string'
  'object'
  'number'
]

class exports.RemoteRequest
  constructor: (@options = {}) ->

  setReturnArgByName:  (name, value) ->
    returns = @method.getReturnArgDescByName name

    if not returns
      debug 'warning: cannot set return value for arg' + ' (%s) without description!', name
      return

    if returns.root
      @resultType = if typeof returns.type is 'string' then returns.type.toLowerCase() else returns.type
      return

    true

  invoke: (ctx, callback) ->
    { scope, method, args } = ctx

    @method = method

    @method.invoke scope, args, @options, this, (err, result) ->
      if err
        ctx.error = err

      ctx.results = result

      callback ctx

    return
