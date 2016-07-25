ContextBase = require 'strong-remoting/lib/context-base'

{ uniqueId } = require 'lodash'

class exports.BaseContext extends ContextBase
  constructor: (@id, @type, @methodString, @method, @ctorArgs, @args) ->
    super @method

    if @method.isStatic
      @scope = @method.ctor
    else
      @scope = @method.sharedCtor

    if @type is 'request'
      @args = @buildArgs()

    @id = @id or uniqueId()

  buildArgs: ->
    { isStatic, isSharedCtor, restClass, accepts } = @method

    args = if isSharedCtor then @ctorArgs else @args

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

  toJSON: ->
    type: @type
    id: @id
    args: @args
    ctorArgs: @ctorArgs
    methodString: @methodString
    error: @error
    results: @results