const mongoose = require('mongoose');

const userBlockSchema = new mongoose.Schema({
    sender: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, default:'blocked' },
    timestamp: { type: Date, default: Date.now },
});

const UserBlockModel = mongoose.model('BlockUser', userBlockSchema);

module.exports = UserBlockModel;