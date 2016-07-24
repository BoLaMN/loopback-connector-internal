debug = require('debug') 'loopback:connector:internal:websocket'

{ EventEmitter } = require 'events'

class RemoteSocketAdapter extends EventEmitter
  constructor: (@settings) ->
    super()

    @queue = []

    @missedHeartbeats = 0
    @heartbeatPromise = undefined

    @heartbeatMsg = 'pong'
    @heartbeatAck = 'ping'

    @open()

  sendHeartbeat: =>
    @missedHeartbeats++

    if @missedHeartbeats > 3
      @close()
    else if @socket.readyState is @socket.OPEN
      @send @heartbeatMsg

  close: ->
    clearInterval @heartbeatPromise
    @socket.close()

  connect: ->
    @socket = new WebSocket @settings.url

    @socket.onopen = =>
      @flush()

      if not @heartbeatPromise
        @missedHeartbeats = 0
        @heartbeatPromise = setInterval @sendHeartbeat, 5000

    @socket.onmessage = (message) =>
      newMessage = JSON.parse message.data

      if newMessage isnt @heartbeatAck
        @emit newMessage
      else @missedHeartbeats = 0

    this

  send: (message) ->
    if @socket
      if @socket.readyState isnt @socket.OPEN
        @queue.push data

        if @socket.readyState is @socket.CLOSED
          @open()

      else @socket.send if isString message then message else JSON.stringify message
    else @queue.push message

  flush: ->
    while message = @queue.pop()
      @send message

module.exports = RemoteSocketAdapter