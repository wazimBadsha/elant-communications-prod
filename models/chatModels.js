const mongoose = require('mongoose');
const { CHAT_STATUS_SENT, CHAT_STATUS_RECEIVED, CHAT_STATUS_SEEN } = require('../constants/constants');

const chatSchema = new mongoose.Schema({
    localId: { type: String },
    sender: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    message: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: [CHAT_STATUS_SENT, CHAT_STATUS_RECEIVED, CHAT_STATUS_SEEN], default: CHAT_STATUS_SENT },
    repliedTo: { type: mongoose.Types.ObjectId, ref: 'Chat' },
    replyMessage: { type: Object, required: false },
    image: { type: String },
    system:  { type: Boolean , required: true, default: false},
    isDeleted:  { type: Boolean , required: true, default: false},
});

const ChatModel = mongoose.model('Chat', chatSchema);

module.exports = ChatModel;
