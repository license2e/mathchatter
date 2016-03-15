import * as VARS from './vars'
import User from '../models/user'
import Room from '../models/room'
import ChatRoom from './chatRoom'
import shortid from 'shortid'

class Chat {
  constructor(io, socket) {
    this.io = io
    this.socket = socket
    this.chatRoom = new ChatRoom(io, socket)
    this.chatRoom.addPublicRoom()
  }

  createUserAndJoinRoom() {
    User.create({
      name: this.socket.username,
      connected: true,
      connectedAt: (new Date()).toISOString(),
      disconnectedAt: null,
      createdAt: (new Date()).toISOString(),
      updatedAt: (new Date()).toISOString(),
    }, (err, user) => {
      if (err){
        throw new Error('Error: error saving user!')
        return
      }
      this.chatRoom.joinRoom()
    })
  }

  addUser() {
		// store the username in the socket session for this client
		this.socket.username = shortid.generate()
		this.socket.room = VARS.PUBLIC_ROOM

		// add the client's username the db and join room
		this.createUserAndJoinRoom()
  }

  joinUser(username, room) {
		// ..?
		let roomName = VARS.PUBLIC_ROOM
    if(room) {
      roomName = room
    }

		// store the username in the socket session for this client
		this.socket.username = username
    this.socket.room = roomName

    User.findOne({ name: this.socket.username }, (err, user) => {
      if (err){
        throw new Error('Error: error finding user!')
        return
      }
      if(user === null){
        this.createUserAndJoinRoom()
      } else {
        user.update({
          connected: true,
          connectedAt: (new Date()).toISOString(),
          updatedAt: (new Date()).toISOString(),
        }, (err, raw) => {
          if (err){
            throw new Error('Error: error saving user!')
            return
          }
          this.chatRoom.joinRoom()
        })

      }
    })

	}

  addRoom(data) {
    const roomData = JSON.parse(data)
    this.chatRoom.addRoom(roomData.name, () => {
      this.chatRoom.joinRoom()
    })
  }

  switchRooms(data) {
    data = JSON.parse(data)
    // ...? if room?

    this.chatRoom.leaveRoom(() => {
      this.socket.room = data.roomKey
      this.chatRoom.joinRoom()
    })
  }

  getRooms() {
    this.chatRoom.getRooms()
  }

  getMessages() {
    this.chatRoom.getMessages()
  }

  sendMessage(username, msg) {
    this.chatRoom.sendMessage(username, msg)
  }

  disconnectUser() {

    User.findOne({ name: this.socket.username }, (err, user) => {
      if (err){
        throw new Error('Error: error finding user!')
        return
      }

      if(user){
        user.update({
          connected: false,
          disconnectedAt: (new Date()).toISOString(),
          updatedAt: (new Date()).toISOString(),
        }, (err, raw) => {
          if (err){
            throw new Error('Error: error saving user!')
            return
          }
          this.chatRoom.leaveRoom()
        })
      } else {
        console.log('Disconnected user: ', this.socket);
      }

    })


  }
}

export default Chat
