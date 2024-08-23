const express = require('express');
const aiChatController = require('../controllers/aiChatController.js');
const { listChatRequests, sendRequest, acceptRequest, ignoreRequest, searchUser, listChatHeads } = require('../controllers/chatController.js');

const router = express.Router();

router.get('/healthcheck', async (req, res) => {
    return res.status(200).json({ message: 'healthcheck success' });
});


router.post('/listRequests/:userId', listChatRequests)
router.post('/sendRequest/:userId', sendRequest)
router.post('/acceptRequest/:userId', acceptRequest)
router.post('/ignoreRequest/:userId', ignoreRequest)
router.post('/searchUser/:userId', searchUser)
router.post('/listChatHeads/:userId', listChatHeads)


module.exports = router;
