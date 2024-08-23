const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    sender: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    message: { type: String },
    timestamp: { type: Date, default: Date.now },
    status: { type: String, enum: ['sent', 'received', 'seen'], default: 'sent' },
    repliedTo: { type: mongoose.Types.ObjectId, ref: 'Chat' },
    image: { type: String },
});

const ChatModel = mongoose.model('Chat', chatSchema);

module.exports = ChatModel;
