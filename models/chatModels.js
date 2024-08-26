const mongoose = require('mongoose');
const { CHAT_STATUS_SENT, CHAT_STATUS_RECEIVED, CHAT_STATUS_SEEN } = require('../constants/constants');

const chatSchema = new mongoose.Schema({
    sender: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    message: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: [CHAT_STATUS_SENT, CHAT_STATUS_RECEIVED, CHAT_STATUS_SEEN], default: CHAT_STATUS_SENT },
    repliedTo: { type: mongoose.Types.ObjectId, ref: 'Chat' },
    image: { type: String },
});

const ChatModel = mongoose.model('Chat', chatSchema);

module.exports = ChatModel;
