// services/studyBuddyChatServices.js
require('dotenv').config();
const mongoose = require('mongoose');
const userModel = require('../models/userModel');
const ChatModel = require('../models/chatModels');
const { CHAT_STATUS_SEEN } = require('../constants/constants');
const { transformChatMsgs } = require('../transforms/msgTransforms');


const getBuddyChatHistory = async (payload,isSenderOnline) => {
  try {
    const { userId, receiverId, skip, limit, page } = payload;

    // Fetch user info from users collection
    const userInfo = await userModel.findOne({ _id: new mongoose.Types.ObjectId(userId) }, { _id: 1, name: 1, avatar_id: 1 });
    if (!userInfo) {
      return { status: "error", message: 'User not found', data: [] };
    }

    const msgHistoryInfo = await ChatModel.find({
      $or: [
        { sender: new mongoose.Types.ObjectId(userId), receiver: new mongoose.Types.ObjectId(receiverId) },
        { sender: new mongoose.Types.ObjectId(receiverId), receiver: new mongoose.Types.ObjectId(userId) }
      ],
      status: { $eq: CHAT_STATUS_SEEN }
    }).skip(skip).limit(parseInt(limit)).sort({ timestamp: -1 }).populate('sender', '_id name avatar_id').populate('receiver', '_id name avatar_id');

    if (msgHistoryInfo.length == 0) {
      return { status: "success", message: 'Study buddy chat history is not found for the given receiver and user ids', data: [] };
    }

    let messageHistory = [];

    if (msgHistoryInfo && msgHistoryInfo.length > 0) {
      // Pass userInfo to the transform function
      messageHistory = transformChatMsgs(msgHistoryInfo, isSenderOnline);
    }

    const result = {
      status: "success",
      message: 'Study buddy chat history for given user reciever fetched successfully',
      data: messageHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    return result;
  } catch (error) {
    console.error('services/studyBuddyChatServices.js- getBuddyChatHistory Error fetching ai mentor chat history:', error);
    throw error;
  }
};

module.exports = {
  getBuddyChatHistory
};