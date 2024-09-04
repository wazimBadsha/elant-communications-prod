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
  updateDeliveredStatus
};