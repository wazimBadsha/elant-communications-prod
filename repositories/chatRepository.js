// repositories/chatRepository.js
const mongoose = require('mongoose');
const ChatModel = require('../models/chatModels');
const UserModel = require('../models/userModel');  // Import the User model
const { CHAT_STATUS_SEEN } = require('../constants/constants');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findChatHistory = async (senderId, receiverId) => {
  if (!isValidObjectId(senderId) || !isValidObjectId(receiverId)) {
    console.log("repositories/aiChatRepository.js-findChatHistory-senderId------", senderId);
    console.log("repositories/aiChatRepository.js-findChatHistory-receiverId------", receiverId);
    throw new Error('Invalid ObjectId');
  }

  return ChatModel.find({
    $or: [
      { sender: new mongoose.Types.ObjectId(senderId), receiver: new mongoose.Types.ObjectId(receiverId) },
      { sender: new mongoose.Types.ObjectId(receiverId), receiver: new mongoose.Types.ObjectId(senderId) }
    ],
    status: { $ne: CHAT_STATUS_SEEN }
  }).sort({ timestamp: 1 }).populate('sender', '_id name avatar_id').populate('receiver', '_id name avatar_id');
};

const findChatHeads = async (senderId) => {
  return ChatModel.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(senderId) },
          { receiver: new mongoose.Types.ObjectId(senderId) }
        ],
        status: { $ne: CHAT_STATUS_SEEN }
      }
    },
    {
      $sort: { timestamp: -1 }
    },
    {
      $group: {
        _id: { $cond: [{ $eq: ["$sender", new mongoose.Types.ObjectId(senderId)] }, "$receiver", "$sender"] },
        lastMessage: { $first: "$$ROOT" }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    {
      $unwind: "$user"
    },
    {
      $lookup: {
        from: "users",
        localField: "lastMessage.sender",
        foreignField: "_id",
        as: "lastMessage.sender"
      }
    },
    {
      $unwind: "$lastMessage.sender"
    },
    {
      $project: {
        _id: "$user._id",
        name: "$user.name",
        avatar_id: "$user.avatar_id",
        lastMessage: {
          _id: "$lastMessage._id",
          message: "$lastMessage.message",
          image: "$lastMessage.image",
          timestamp: "$lastMessage.timestamp",
          status: "$lastMessage.status",
          sender: {
            _id: "$lastMessage.sender._id",
          }
        }
      }
    }
  ]);
};

const updateDeliveredStatus = async (messageIds) => {
  try {
    await ChatModel.updateMany(
      { _id: { $in: messageIds } },
      { $set: { status: CHAT_STATUS_SEEN } }
    );
    console.log(`repositories/aiChatRepository.js-Messages marked as seen successfully. messageIds: ${messageIds}`);
  } catch (error) {
    console.error('repositories/aiChatRepository.js-Error updating message status:', error);
  }
};

module.exports = {
  findChatHistory,
  findChatHeads,
  updateDeliveredStatus
};