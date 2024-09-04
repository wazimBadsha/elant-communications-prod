const mongoose = require('mongoose');

const aiMessageContentsSchema = new mongoose.Schema({
  threadId: {
    type: String,
    required: true
  },
  user: { type: mongoose.Types.ObjectId, ref: 'User' },
  message: {
    type: String,
    required: true,
  },
  messageReply: {
    type: Object, // Allows you to store any JSON object
    required: true,
  },
  durationInMs: {
    type: Number,
    required: true,
  },
}, { timestamps: true });

const AiMessageContent = mongoose.model('AiMessageContent', aiMessageContentsSchema);

module.exports = AiMessageContent;