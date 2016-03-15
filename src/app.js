import cluster from 'cluster'
import http from 'http'
import fs from 'fs'
import path from 'path'
import contentTypes from './utils/content-types'
import sysInfo from './utils/sys-info'
import socket from 'socket.io'
import mongoose from 'mongoose'
import * as VARS from './lib/vars'

const {
  env
} = process

const MONGODB_URL = env.MONGODB_URL || 'mongodb://localhost/'
const CONNECTION_URL = `${MONGODB_URL}mathchatter`

try {
  const db = mongoose.connect( CONNECTION_URL, { db: { nativeParser: true } })
  // db.on( 'error', console.error.bind( console, 'connection error:' ) )
  // db.once( 'open', function() {
  //   console.log(`Application connected to database ${CONNECTION_URL}`)
  // })
  // mongoose.set('db', db)
} catch(e){
  console.log('Unable to connect to the database, did you remember to start it? 😇')
  process.exit(1)
}

// Import our classes
import Chat from './lib/chat'
import ChatRoom from './lib/chatRoom'

// setup our server
let server = http.createServer(function (req, res) {
  let url = req.url
  if (url == '/' || /\/\d+/.test(url) === true) {
    url = '/index.html'
  }

  if (url == '/health') { // for OpenShift health monitoring
    res.writeHead(200)
    res.end()
  } else if (url.indexOf('/info/') == 0) {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    res.end(JSON.stringify(sysInfo[url.slice(6)]()))
  } else {
    fs.readFile('./static' + url, function (err, data) {
      if (err) {
        res.writeHead(404)
        res.end()
      } else {
        let ext = path.extname(url).slice(1)
        res.setHeader('Content-Type', contentTypes[ext])
        if (ext === 'html') {
          res.setHeader('Cache-Control', 'no-cache, no-store')
        }
        res.end(data)
      }
    })
  }
})

// construct the socket
const io = socket(server, { pingTimeout: 25000 })

// connect server to listen to port
server.listen(env.NODE_PORT || 4567, env.NODE_IP || 'localhost', function () {
  console.log(`Application worker ${process.pid} started...`)
})

// connect socket
io.on('connection', function(socket) {

  // instantiate the chat object
  const chat = new Chat(io, socket)

  // bind chat listeners
	socket.on( 'addUser',      ::chat.addUser )
	socket.on( 'joinUser',     ::chat.joinUser )
  socket.on( 'addRoom',      ::chat.addRoom )
  socket.on( 'switchRooms',  ::chat.switchRooms )
  socket.on( 'getRooms',     ::chat.getRooms )
  socket.on( 'getMessages',  ::chat.getMessages )
  socket.on( 'sendMsg',      ::chat.sendMessage )
  socket.on( 'disconnect',   ::chat.disconnectUser )
})
