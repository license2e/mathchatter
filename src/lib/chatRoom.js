import * as VARS from './vars'
import User from '../models/user'
import Room from '../models/room'
import Message from '../models/message'

class ChatRoom {
  constructor(io, socket) {
    this.io = io
    this.socket = socket
    this.socket.wrongAnswerCount = 0
    this.socket.questionCount = 0
    this.socket.gameInProgress = false
    this.socket.endGame = 0
    this.socket.solution = 0
    this.socket.on('updateRoomGame', ::this.updateRoomGame)
  }

  findClients(roomId, namespace) {
    let res = []
    const ns = this.io.of(namespace || '/')

    if (ns) {
      for (const id in ns.connected) {
        if(roomId) {
          if(ns.connected[id].rooms.hasOwnProperty(roomId) === true) {
            res.push(ns.connected[id])
          }
        } else {
          res.push(ns.connected[id])
        }
      }
    }
    return res
  }

  addPublicRoom(cb) {
    return this.addRoom(VARS.PUBLIC_ROOM_NAME, cb)
  }

  addRoom(roomName, cb) {
    const addRoomCb = cb || function(){}
    Room.findOne({ name: roomName }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      if(room === null){
        Room.count((err, roomKey) => {
          room = Room.create({
            key: roomKey,
            name: roomName,
            numberOfClients: 0,
            wrongAnswerCount: 0,
            questionCount: 0,
            gameInProgress: false,
            endGame: 0,
            solution: 0,
            createdAt: (new Date()).toISOString(),
            updatedAt: (new Date()).toISOString(),
          }, (err, raw) => {
            if (err){
              throw new Error('Error: error updating room!')
              return
            }
            this.socket.emit('roomAdded', {
              key: roomKey,
              name: roomName,
            })
            this.socket.room = roomKey
            addRoomCb()
          })
        })
      } else {
        addRoomCb()
      }
    })
  }

  joinRoom() {
    Room.findOne({ key: this.socket.room }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      this.socket.gameInProgress = !!(room.gameInProgress) || false
      this.socket.wrongAnswerCount = room.wrongAnswerCount || 0
      this.socket.questionCount = room.questionCount || 0
      this.socket.endGame = room.endGame || 0
      this.socket.solution = room.solution || 0

  		this.socket.join(this.socket.room)
      User.find({ currentRoom: this.socket.room, connected: true }, 'name',(err, users) => {
        this.socket.emit('roomUsers', users)
      })
      User.update({ name: this.socket.username }, { currentRoom: this.socket.room }, (err, user) => {
        this.socket.emit('setUser', this.socket.username, this.socket.room, room.name)
      })
      this.io.sockets.in(this.socket.room).emit('serverMessage', {
        username: VARS.MCADMIN,
        msg: `@${this.socket.username} joined #${room.name}`,
      })
      this.io.sockets.in(this.socket.room).emit('userConnected', this.socket.username)
      this.updateRoomCounts(this.socket.room)
    })
  }

  leaveRoom(cb) {
    const leaveRoomCb = cb || function(){}
    Room.findOne({ key: this.socket.room }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
	    this.socket.leave(this.socket.room)
      this.io.sockets.in(this.socket.room).emit('serverMessage', {
        username: VARS.MCADMIN,
        msg: `@${this.socket.username} left #${room.name}`,
      })
      this.io.sockets.in(this.socket.room).emit('userDisconnected', this.socket.username)
      this.updateRoomCounts(this.socket.room)
      leaveRoomCb()
    })
  }

  getRooms() {
    Room.find({deleted: false}, 'key name', (err, rooms) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      this.socket.emit('roomList', rooms)
    })
  }

  getMessages() {
    Message.find({
      roomKey: this.socket.room,
    },
    'username msg msgType roomKey createdAt',
    { sort: { createdAt: -1 }, limit: 25 },
    (err, msgs) => {
      if (err){
        throw new Error('Error: error finding messages!')
        return
      }
      this.socket.emit('messageList', msgs)
    })
  }

  sendMessage(username, msg) {
    Message.create({
      roomKey: this.socket.room,
      username: username,
      msg: msg,
      msgType: 'chat',
      createdAt: (new Date()).toISOString(),
      updatedAt: (new Date()).toISOString(),
    }, (err, raw) => {
      if (err){
        throw new Error(`Error: error sending message: ${err}`)
        return
      }
      this.io.sockets.in(this.socket.room).emit('updateChat', {
        username: username,
        msg: msg,
      })
      if(
        username !== VARS.MCGAME
        && username !== VARS.MCADMIN
        && this.socket.gameInProgress && this.socket.gameInProgress === true
      ) {
        const checkAnswer = this.checkAnswer(msg)
        if(checkAnswer === true){
          this.correctAnswer()
          this.sendQuestion()
        } else if(this.socket.wrongAnswerCount && this.socket.wrongAnswerCount >= VARS.NUM_OF_QUESTIONS) {
          this.sendAnswer()
        } else {
          this.sorryWrongAnswer()
        }
      }
    })
  }

  updateRoomCounts(roomKey) {
    if(roomKey !== VARS.PUBLIC_ROOM){
      const numberOfClients = this.findClients(roomKey).length + 1
      this.checkRoomCountsForGame(numberOfClients)
    }
  }

  checkRoomCountsForGame(numberOfClients) {
    if(numberOfClients >= VARS.MIN_PLAYERS_TO_PLAY){
      const timeSinceLastGame = (new Date).getTime()
      if((timeSinceLastGame - this.socket.endGame) > VARS.START_NEW_GAME_DURATION){
        this.startGame()
      }
    } else if(this.socket.gameInProgress === true) {
      this.endGame()
    }
  }

  startGame() {
    Room.findOne({ key: this.socket.room, gameInProgress: false }, (err, room) => {
      if (err){
        throw new Error(`Error: finding room: ${err}`)
        return
      }
      if(room){
        room.update({
          gameInProgress: true,
          wrongAnswerCount: 0,
          questionCount: 0,
          endGame: 0,
        }, (err, raw) => {
          if (err){
            throw new Error(`Error: updating room: ${err}`)
            return
          }
          this.socket.wrongAnswerCount = 0
          this.socket.questionCount = 0
          this.socket.gameInProgress = true
          this.socket.endGame = 0
          this.sendMessage(VARS.MCGAME, `Starting a new math game.`)
          this.notifyOfGameUpdate()
          this.sendQuestion()
        })
      }
    })
  }

  checkAnswer(msg) {
    try {
      return parseFloat(msg) === parseFloat(this.socket.solution)
    } catch(e){}
    return false
  }

  correctAnswer() {
    this.sendMessage(VARS.MCGAME, `Correct @${this.socket.username}!`)
  }

  sorryWrongAnswer() {
    const newWrongAnswerCount = this.socket.wrongAnswerCount + 1
    Room.update({ key: this.socket.room }, {
      newWrongAnswerCount: newWrongAnswerCount,
    }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      this.socket.wrongAnswerCount = newWrongAnswerCount
      this.sendMessage(VARS.MCGAME, `Apologies, that answer was incorrect. ( attempt: ${this.socket.wrongAnswerCount} of ${VARS.NUM_OF_QUESTIONS} )`)
      this.notifyOfGameUpdate()
    })
  }

  sendAnswer() {
    Room.update({ key: this.socket.room }, {
      wrongAnswerCount: 0,
    }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      this.socket.wrongAnswerCount = 0
      this.sendMessage(VARS.MCGAME, `The correct answer was: ${this.socket.solution}`)
      this.notifyOfGameUpdate()
      this.sendQuestion()
    })
  }

  sendQuestion() {
    if(this.socket.questionCount && this.socket.questionCount > VARS.NUM_OF_QUESTIONS){
      return this.endGame()
    }
    const var1 = Math.floor(Math.random() * 1000)
    const var2 = Math.floor(Math.random() * 1000)
    const operatorList = ['+','-','/','*']
    const operator = operatorList[Math.floor(Math.random()*4)]
    let solution = eval(`${var1} ${operator} ${var2}`)
    let note = ''
    if(operator === '/'){
      solution = (solution).toFixed(2)
      note = ' (rounded to two decimal places)'
    }
    const newQuestionCount = this.socket.questionCount + 1

    Room.update({ key: this.socket.room }, {
      questionCount: newQuestionCount,
      solution: solution,
    }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      this.socket.questionCount = newQuestionCount
      this.socket.solution = solution
      this.sendMessage(VARS.MCGAME, `Question ${this.socket.questionCount} of ${VARS.NUM_OF_QUESTIONS}: What is ${var1} ${operator} ${var2} = ?${note}`)
      this.notifyOfGameUpdate()
    })
  }

  notifyOfGameUpdate() {
    this.io.sockets.in(this.socket.room).emit('updateRoomGame')
  }

  updateRoomGame() {
    console.log('here')
    Room.findOne({ key: this.socket.room }, (err, room) => {
      if (err){
        throw new Error('Error: error finding room!')
        return
      }
      this.socket.gameInProgress = !!(room.gameInProgress) || false
      this.socket.wrongAnswerCount = room.wrongAnswerCount || 0
      this.socket.questionCount = room.questionCount || 0
      this.socket.endGame = room.endGame || 0
      this.socket.solution = room.solution || 0
      console.log(room)
    })
  }

  endGame(){
    Room.update({ key: this.socket.room }, {
      gameInProgress: false,
      wrongAnswerCount: 0,
      questionCount: 0,
      endGame: 0,
    }, (err, raw) => {
      if (err){
        throw new Error(`Error: updating room: ${err}`)
        return
      }
      this.socket.wrongAnswerCount = 0
      this.socket.questionCount = 0
      this.socket.gameInProgress = false
      this.socket.endGame = 0
      this.sendMessage(VARS.MCGAME, `Ending the math game.`)
      this.socket.endGame = (new Date).getTime()
    })
  }
}

export default ChatRoom
