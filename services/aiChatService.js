// services/aiChatService.js
require('dotenv').config();
const OpenAI = require('openai');
const aiChatRepository = require('../repositories/aiChatRepository');
const AiMessageContent = require('../models/aiChatContentsModel');
const mongoose = require('mongoose');
const { transformMsgInput, transformSingleAiChatRes } = require('../transforms/msgTransforms');
const userModel = require('../models/userModel');

const openaiInstance = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const processChat = async (body) => {
  try {
    let { userId, message: userMessage } = body;

    let threadId = '';

    const messageThreadInfo = await aiChatRepository.findUserById(userId);

    if (!messageThreadInfo) {
      const threadResponse = await openaiInstance.beta.threads.create();
      threadId = threadResponse.id;
      await aiChatRepository.saveNewMessage(userId, threadId, userMessage);
    } else {
      threadId = messageThreadInfo.threadId;
    }

    const startTime = Date.now();

    await openaiInstance.beta.threads.messages.create(threadId, {
      role: 'user',
      content: userMessage,
    });

    if (!process.env.ASSISTANT_ID) {
      throw new Error('Assistant ID is not set in env');
    }

    const runResponse = await openaiInstance.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    let run = await openaiInstance.beta.threads.runs.retrieve(threadId, runResponse.id);
    while (run.status !== 'completed') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await openaiInstance.beta.threads.runs.retrieve(threadId, runResponse.id);
    }

    const endTime = Date.now();
    const durationInMs = endTime - startTime;

    const messagesResponse = await openaiInstance.beta.threads.messages.list(threadId);
    const assistantResponses = messagesResponse.data.filter(msg => msg.role === 'assistant');

    await aiChatRepository.saveNewMessageContent(userId, threadId, userMessage, durationInMs, assistantResponses[0]);

    //transfrom response 
    const finalRes = transformSingleAiChatRes(assistantResponses[0])
    const result = {
      status: "success",
      message: 'AI Mentor message reply',
      data: finalRes
    };
    return result;
  } catch (error) {
    throw error
  }
};

//todo: if multiple thread is there for a user then we have to handle it 
const getAiMentorChatHistory = async (payload) => {
  try {
    const { userId, skip, limit, page } = payload;

    // Fetch user info from users collection
    const userInfo = await userModel.findOne({ _id: new mongoose.Types.ObjectId(userId) }, { _id: 1, name: 1, avatar_id: 1 });
    if (!userInfo) {
      return { status: "error", message: 'User not found', data: [] };
    }

    const aiMessageContentInfo = await AiMessageContent.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $project: {
          _id: 1,
          message: 1,
          messageReply: 1,
          durationInMs: 1,
          threadId: 1,
          user: 1,
          createdAt: 1,
          updatedAt: 1,
        }
      },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    if (!aiMessageContentInfo.length) {
      return { status: "error", message: 'AI Mentor message history is not found for the given user', data: [] };
    }

    let messageHistory = [];
    if (aiMessageContentInfo && aiMessageContentInfo.length > 0) {
      // Pass userInfo to the transform function
      messageHistory = transformMsgInput(aiMessageContentInfo, userInfo);
    }

    const result = {
      status: "success",
      message: 'AI Mentor message history for given user fetched successfully',
      data: messageHistory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
    return result;
  } catch (error) {
    console.error('services/aiChatService.js-getAiMentorChatHistory Error fetching ai mentor chat history:', error);
    throw error;
  }
};



module.exports = {
  processChat,
  getAiMentorChatHistory
};