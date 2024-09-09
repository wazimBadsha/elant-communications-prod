const BlockUser = require('../models/blockedUser');

const findBlockBySenderAndReceiver = async (senderId, receiverId) => {
    return BlockUser.findOne({ sender: senderId, receiver: receiverId });
};

const deleteBlock = async (blockId) => {
    return BlockUser.deleteOne({ _id: blockId });
};

const createBlock = async (senderId, receiverId) => {
    return BlockUser.create({
        sender: senderId,
        receiver: receiverId
    });
};

const findBlocksBySender = async (senderId) => {
    return BlockUser.find({ sender: senderId }, 'receiver -_id').lean();
};

const findBlocksByReceiver = async (receiverId) => {
    return BlockUser.find({ receiver: receiverId }, 'sender -_id').lean();
};


module.exports = {
    findBlockBySenderAndReceiver,
    deleteBlock,
    createBlock,
    findBlocksBySender,
    findBlocksByReceiver
};