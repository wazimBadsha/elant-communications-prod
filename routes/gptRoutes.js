// routes/gptRoutes.js
const express = require('express');
const aiChatController = require('../controllers/aiChatController.js');

const router = express.Router();

router.post('/mentor-chat', aiChatController.chatWithAiMentor);
router.get('/mentor-chat-history/:userId', aiChatController.getHistoryOfAiMentorChat);


module.exports = router;