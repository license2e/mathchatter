import mongoose from 'mongoose'

const userSchema = mongoose.Schema({
  name: { type: String, index: true },
  connected: { type: Boolean },
  connectedAt: { type: Date, default: (new Date()).toISOString() },
  currentRoom: { type: Number },
  disconnectedAt: { type: Date, default: (new Date()).toISOString() },
  createdAt: { type: Date, default: (new Date()).toISOString() },
  updateAt: { type: Date, default: (new Date()).toISOString() },
})

const User = mongoose.model('User', userSchema)

export default User
