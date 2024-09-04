// repositories/chatRequestRepository.js
const ChatRequestModel = require('../models/chatRequestModel');
const mongoose = require('mongoose');
const userModel = require('../models/userModel');

const findChatRequestsByUserId = async (payload) => {
    const { userId, skip, limit, page } = payload;
    return ChatRequestModel.find({ receiver: userId, status: 'pending' })
        .populate('sender', '_id name avatar_id')
        .select('-__v')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .skip(skip);
};

const findChatRequestsByUserIdCount = async (userId) => {
    try {
        return ChatRequestModel.countDocuments({ receiver: userId, status: 'pending' });
    } catch (error) {
        console.error('Error in chatRepository.js-findChatRequestsByUserIdCount:', error);
        throw error;
    }
};

const searchUsers = async (userId, searchString) => {
    const limit = 10;

    return await userModel.aggregate([
        {
            $match: {
                $and: [
                    { _id: { $ne: new mongoose.Types.ObjectId(userId) } },
                    {
                        $or: [
                            { phoneNumber: { $regex: searchString, $options: 'i' } },
                            { name: { $regex: searchString, $options: 'i' } },
                        ]
                    }
                ]
            }
        },
        {
            $lookup: {
                from: 'chatrequests',
                let: { userId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $or: [
                                            { $eq: ['$sender', '$$userId'] },
                                            { $eq: ['$receiver', '$$userId'] }
                                        ]
                                    },
                                    {
                                        $or: [
                                            { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
                                            { $eq: ['$receiver', new mongoose.Types.ObjectId(userId)] }
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    { $project: { status: 1, _id: 0 } },
                    { $limit: 1 }
                ],
                as: 'chatRequestStatus'
            }
        },
        {
            $limit: limit
        },
        {
            $project: {
                _id: 1,
                name: 1,
                avatar_id: 1,
                chatRequestStatus: { $arrayElemAt: ["$chatRequestStatus.status", 0] }
            }
        }
    ]);
};

const createChatRequest = async (senderId, receiverId) => {
    const newRequest = new ChatRequestModel({ sender: senderId, receiver: receiverId });
    return newRequest.save();
};

const findExistingChatRequest = async (senderId, receiverId) => {
    return ChatRequestModel.findOne({ sender: senderId, receiver: receiverId });
};

const acceptChatRequest = async (requestId) => {
    return ChatRequestModel.findByIdAndUpdate(
        requestId,
        { status: 'accepted' },
        { new: true }
    ).populate(['sender', 'receiver']);
};

const deleteChatRequest = async (requestId) => {
    return ChatRequestModel.deleteOne({ _id: requestId });
};

// Function to find chat heads based on userId
const listChatHeads = async (userId) => {
    try {
        const chatHeads = await ChatRequestModel.aggregate([
            {
                $match: {
                    $or: [
                        { sender: new mongoose.Types.ObjectId(userId) },
                        { receiver: new mongoose.Types.ObjectId(userId) }
                    ],
                    status: 'accepted'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: 'senderDetails'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'receiver',
                    foreignField: '_id',
                    as: 'receiverDetails'
                }
            },
            {
                $project: {
                    _id: 1,
                    sender: { $arrayElemAt: ['$senderDetails', 0] },
                    receiver: { $arrayElemAt: ['$receiverDetails', 0] }
                }
            }
        ]);
        return chatHeads;
    } catch (error) {
        console.error('Error in chatRepository.js-findChatHeads:', error);
        throw error;
    }
};


module.exports = {
    findChatRequestsByUserId,
    searchUsers,
    createChatRequest,
    findExistingChatRequest,
    acceptChatRequest,
    deleteChatRequest,
    listChatHeads,
    findChatRequestsByUserIdCount
};