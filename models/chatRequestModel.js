const mongoose = require('mongoose');

const chatRequestSchema = new mongoose.Schema({
    sender: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'ignored','blocked'], default: 'pending' },
    timestamp: { type: Date, default: Date.now },
});

const ChatRequestModel = mongoose.model('ChatRequest', chatRequestSchema);

module.exports = ChatRequestModel;