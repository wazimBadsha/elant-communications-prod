// repositories/aiChatRepository.js
const AiMessageModel = require('../models/aiChatModel');
const AiMessageContent = require('../models/aiChatContentsModel');
const mongoose = require('mongoose');
const ChatModel = require('../models/chatModels');
const { CHAT_STATUS_SEEN } = require('../constants/constants');

const findUserById = async (userId) => {
  return await AiMessageModel.findOne({ user: userId });
};

const saveNewMessage = async (userId, threadId, userMessage) => {
  const newMessage = new AiMessageModel({
    user: userId,
    threadId,
    message: userMessage,
  });
  return await newMessage.save();
};

const saveNewMessageContent = async (userId, threadId, userMessage, durationInMs, assistantResponse) => {
  const newMessageContent = new AiMessageContent({
    user: new mongoose.Types.ObjectId(userId),
    threadId,
    message: userMessage,
    durationInMs: durationInMs,
    messageReply: assistantResponse,
  });
  return await newMessageContent.save();
}

const isValidObjectId = (id) => new mongoose.Types.ObjectId.isValid(id);

const findChatHistory = async (senderId, receiverId) => {
  if (!isValidObjectId(senderId) || !isValidObjectId(receiverId)) {
    console.log("repositories/aiChatRepository.js-findChatHistory-senderId------", senderId)
    console.log("repositories/aiChatRepository.js-findChatHistory-receiverId------", receiverId)
    throw new Error('Invalid ObjectId');
  }

  return ChatModel.find({
    $or: [
      { sender: new mongoose.Types.ObjectId(senderId), receiver: new mongoose.Types.ObjectId(receiverId) },
      { sender: new mongoose.Types.ObjectId(receiverId), receiver: new mongoose.Types.ObjectId(senderId) }
    ],
    status: { $ne: CHAT_STATUS_SEEN }
  }).sort({ timestamp: -1 }).populate('sender', '_id name avatar');
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
        avatar: "$user.avatar",
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
  findUserById,
  saveNewMessage,
  saveNewMessageContent,
  findChatHistory,
  findChatHeads,
  updateDeliveredStatus
};