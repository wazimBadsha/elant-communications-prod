const mongoose = require('mongoose');

const aimessageSchema = new mongoose.Schema({
  user: { type: mongoose.Types.ObjectId, ref: 'User' },
  threadId: {
    type: String,
    required: true
  }
},{ timestamps: true });

const AiMessage = mongoose.model('AiMessage', aimessageSchema);

module.exports = AiMessage;