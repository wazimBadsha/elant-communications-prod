// controllers/aiChatController.js
require('dotenv').config();
const { processChat, getAiMentorChatHistory } = require('../services/aiChatService');

const chatWithAiMentor = async (req, res) => {
  try {
    if (!req.body.message) {
      return res.status(400).json({ status: 'error', message: 'message field is required' });
    }

    if (!req.body.userId) {
      return res.status(400).json({ status: 'error', message: 'userId field is required' });
    }

    const response = await processChat(req.body);
    res.json({ response });
  } catch (error) {
    console.error('controllers/chatController.js-Error processing chat:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getHistoryOfAiMentorChat = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'userId field is required as path param' });
    }

    //pagination params
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const payload = { userId, skip, limit, page };

    const response = await getAiMentorChatHistory(payload);
    res.json({ response });
    

  } catch (error) {
    console.error('controllers/chatController.js-getHistoryOfAiMentorChat Error fetching ai mentor chat history:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  chatWithAiMentor,
  getHistoryOfAiMentorChat
};