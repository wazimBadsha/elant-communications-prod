// controllers/chatController.js
const chatRequestRepository = require('../repositories/chatRequestRepository');
const userModel = require('../models/userModel');
// const { sendPushMessage } = require('../services/notifications');
const { getBuddyChatHistory } = require('../services/studyBuddyChatServices');
const { CHAT_STATUS_RECEIVED, NOTI_TYPE_CHAT_REQUEST, NOTI_TYPE_CHAT_ACCEPT, CHAT_STATUS_SENT } = require('../constants/constants');
const { sendExpoPushMessage } = require('../services/notificationService');
const { addReceiver, pubClient, io } = require('../routes/socketIO');
const { sendPrivateMessage } = require('../utils/chatUtils');
const { default: mongoose } = require('mongoose');
const ChatRequestModel = require('../models/chatRequestModel');
const { findBlockBySenderAndReceiver } = require('../repositories/blockUserRepository');

const listChatRequests = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ status: 'error', message: 'userId field is required as path param' });
        }
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        const payload = { userId, skip, limit, page };
        const requests = await chatRequestRepository.findChatRequestsByUserId(payload);
        const totalRequests = await chatRequestRepository.findChatRequestsByUserIdCount(userId);
        res.json({ status: "success", "invitations": requests, "totalRequests": totalRequests });
    } catch (error) {
        console.error('Error listing requests:', error);
        res.status(500).json({ status: "error", message: 'Server Error' });
    }
};

// const searchUser = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const { user } = req.body;

//         let users = await chatRequestRepository.searchUsers(userId, user);

//         const requests = await chatRequestRepository.findChatRequestsByUserId(userId);

//         requests.forEach(request => {
//             const userIndex = users.findIndex(user => user._id.equals(request.sender._id));
//             if (userIndex !== -1) {
//                 users[userIndex].chatRequestStatus = CHAT_STATUS_RECEIVED;
//                 requests.forEach(request => {
//                     const userIndex = users.findIndex(user => user._id.equals(request.sender._id));
//                     if (userIndex !== -1) {
//                         users[userIndex].chatRequestStatus = 'received';
//                         users[userIndex].requestId =  requests[userIndex]._id
//                     }
//                 });
//                 users[userIndex].requestId = requests[userIndex]._id;
//             }
//         });
//         console.log("SEARCH_RESULT=====users", users);
//         res.json(users);

//     } catch (error) {
//         console.error('Error searching users:', error);
//         res.status(500).json({ message: 'Server Error' });
//     }
// };

const searchUser = async (req, res) => {
    try {
        const { user } = req.body;
        const { userId } = req.params;


        let users = await userModel.aggregate([
            {
                $match: {
                    $and: [
                        { _id: { $ne: new mongoose.Types.ObjectId(userId) } },
                        {
                            $or: [
                                { phoneNumber: { $regex: user, $options: 'i' } },
                                { name: { $regex: user, $options: 'i' } },
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
                $project: {
                    _id: 1,
                    name: 1,
                    avatar_id: 1,
                    chatRequestStatus: { $arrayElemAt: ["$chatRequestStatus.status", 0] }
                }
            }
        ]);

        const requests = await ChatRequestModel.find({ receiver: userId, status: 'pending' })
            .populate('sender', '_id name avatar_id')
            .select('-__v');

        requests.forEach(request => {
            const userIndex = users.findIndex(user => user._id.equals(request.sender._id));
            if (userIndex !== -1) {
                users[userIndex].chatRequestStatus = 'received';
                // console.log("REQUEST_ID", requests[userIndex + 1])
                console.log("REQUEST_ID", request)
                users[userIndex].requestId = request._id
            }
        });

        res.json(users);

    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};


const sendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { receiverId } = req.body;

        if (!userId || !receiverId || userId === receiverId) {
            return res.status(400).json({ status: "error", message: 'Invalid sender or receiver ID' });
        }

        const existingRequest = await chatRequestRepository.findExistingChatRequest(userId, receiverId);
        if (existingRequest) {
            return res.status(400).json({ message: 'A request already exists between these users' });
        }

        const chatRequest = await chatRequestRepository.createChatRequest(userId, receiverId);

        let mUser = await userModel.findOne({ _id: userId });
        let message = `You have a study buddy request from ${mUser?.name}.`;
        console.log("CHAT_REQUEST", chatRequest)
        sendExpoPushMessage(receiverId.toString(), message, "Chat request", chatRequest._id, NOTI_TYPE_CHAT_REQUEST, chatRequest)
        //sendPushMessage(receiverId, message);

        res.status(200).json({ status: "success", message: 'Request sent successfully' });
    } catch (error) {
        console.error('Error sending request:', error);
        res.status(500).json({ status: "error", message: 'Server Error' });
    }
};

const acceptRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { requestId } = req.body;

        const acceptedRequest = await chatRequestRepository.acceptChatRequest(requestId);

        if (!acceptedRequest) {
            return res.status(404).json({ status: "error", message: 'Request not found' });
        }

        const message = `Your study buddy chat request is accepted by ${acceptedRequest?.receiver?.name}.`;
        // sendPushMessage(acceptedRequest?.sender?._id.toString(), message);

        console.log("MESSAGE_REQUEST-sender", acceptedRequest.sender._id.toString());
        console.log("MESSAGE_REQUEST-receiver", acceptedRequest.receiver._id.toString());

        await addReceiver(acceptedRequest.sender._id.toString(), acceptedRequest.receiver._id.toString());
        await addReceiver(acceptedRequest.receiver._id.toString(), acceptedRequest.sender._id.toString());

        const chat = await sendPrivateMessage(acceptedRequest.sender._id.toString(), acceptedRequest.receiver._id.toString(), message, null, null, true);

        const mychat = {
            _id: chat._id,
            text: chat.message,
            createdAt: chat.timestamp,
            status: CHAT_STATUS_SENT,
            image: chat.image,
            receiverId: acceptedRequest.receiver._id.toString(),
            senderId: acceptedRequest.sender._id.toString(),
            replyMessage: chat.replyMessage,
            system: chat.system,
            user: {
                _id: chat?.sender?._id,
                name: chat?.sender?.name,
                avatar: chat?.sender?.avatar
            }
        };

        io.to([acceptedRequest.sender._id.toString(), acceptedRequest.receiver._id.toString()]).emit('new message', { message: mychat });
        sendExpoPushMessage(acceptedRequest?.sender?._id.toString(), message, "Chat Request Accepted", acceptedRequest._id, NOTI_TYPE_CHAT_ACCEPT, acceptedRequest)
        res.status(200).json({ status: "success", message: 'Request accepted successfully' });
    } catch (error) {
        console.error('Error accepting request:', error);
        res.status(500).json({ status: "error", message: 'Server Error' });
    }
};

const ignoreRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const { requestId } = req.body;
        const deletedRequest = await chatRequestRepository.deleteChatRequest(requestId);

        if (!deletedRequest.deletedCount) {
            return res.status(404).json({ status: "error", message: 'Request not found' });
        }

        res.status(200).json({ status: "success", message: 'Request deleted successfully' });

        return;
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ message: 'Server Error' });
        return;
    }
};


const listChatHeads = async (req, res) => {
    try {
        const { userId } = req.params;
        const chatHeads = await chatRepository.findChatHeads(userId);
        
      //  const chatHeads = await chatRequestRepository.listChatHeads(userId);
        const totalRequests = await chatRequestRepository.findChatRequestsByUserIdCount(userId);
        res.status(200).json({ status: "success", message: 'Chat heads fetched successfully', data: chatHeads, totalRequests: totalRequests });
    } catch (error) {
        console.error('Error listing chat heads:', error);
        res.status(500).json({ status: "error", message: 'Server Error' });
    }
};

const getHistoryStudyBuddyChat = async (req, res) => {
    try {
        const { userId, receiverId } = req.params;
        if (!userId || !receiverId) {
            return res.status(400).json({ status: 'error', message: 'userId and receiverId field is required as path param' });
        }

        //pagination params
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;
        const payload = { userId, skip, limit, page, receiverId };

        const userActiveSocketsKey = `activeUsers:${userId}`;
        //find out online status
        let isSenderOnline = false;
        isSenderOnline = await pubClient.sIsMember(userActiveSocketsKey, userId);

        //find out blocked status
        const blockedInfoSender = await findBlockBySenderAndReceiver(userId, receiverId);

        const blockedInfoReceiver = await findBlockBySenderAndReceiver(receiverId, userId);
        let isBlocked = false;
        let isYouBlocked = false;
        let isReceiverBlocked = false;
        if (blockedInfoSender) {
            isBlocked = true
            isYouBlocked = true
        }
        if (blockedInfoReceiver) {
            isBlocked = true
            isReceiverBlocked = true
        }
        console.log(`BLOCKED INFO OF ${userId} - ${blockedInfoSender}`)
        console.log(`BLOCKED INFO OF ${receiverId} - ${blockedInfoReceiver}`)
        
        const response = await getBuddyChatHistory(payload, isSenderOnline, isBlocked, blockedInfoSender, blockedInfoReceiver, isYouBlocked, isReceiverBlocked);

        res.json({ response });


    } catch (error) {
        console.error('controllers/chatController.js-getHistoryStudyBuddyChat Error fetching chat history:', error);
        return res.status(500).json({ status: 'error', message: error.message });
    }
};



module.exports = {
    listChatRequests,
    searchUser,
    sendRequest,
    acceptRequest,
    ignoreRequest,
    listChatHeads,
    getHistoryStudyBuddyChat
};