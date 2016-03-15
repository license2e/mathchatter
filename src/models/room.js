import mongoose from 'mongoose'

const roomSchema = mongoose.Schema({
  key: { type: Number, index: true },
  name: { type: String, index: true },
  numberOfClients: Number,
  gameInProgress: { type: Boolean, default: false },
  wrongAnswerCount: Number,
  questionCount: Number,
  endGame: Number,
  solution: Number,
  deleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: (new Date()).toISOString() },
  updateAt: { type: Date, default: (new Date()).toISOString() },
})

const Room = mongoose.model('Room', roomSchema)

export default Room
