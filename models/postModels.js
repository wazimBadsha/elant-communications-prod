const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: mongoose.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    color: {type: String,required: true },
    likes: [
        {
            user: { type: mongoose.Types.ObjectId, ref: 'User' },
        }
    ],
});

const PostModel = mongoose.model('Post', postSchema);

module.exports = PostModel;