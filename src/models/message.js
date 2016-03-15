import mongoose from 'mongoose'

const messageSchema = mongoose.Schema({
  roomKey: { type: Number, index: true },
  username: { type: String },
  msg: { type: String, index: true },
  msgType: { type: String, index: true },
  createdAt: { type: Date, default: (new Date()).toISOString() },
  updateAt: { type: Date, default: (new Date()).toISOString() },
})

const Message = mongoose.model('Message', messageSchema)

export default Message
