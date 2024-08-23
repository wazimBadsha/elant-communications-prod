const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User' },
  threadId: {
    type: String,
    required: true
  },
  count:{type:Number}
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;