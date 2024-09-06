require('dotenv').config();
const { sendPrivateMessage, isUserBlocked } = require('../utils/chatUtils');
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { io } = require('../utils/socketMain');
const BlockUser = require('../models/blockedUser');

// Import repository methods
const chatRepository = require('../repositories/chatRepository');
const blockUserRepository = require('../repositories/blockUserRepository');
const { transformChatMsgs } = require('../transforms/msgTransforms');
const { CHAT_STATUS_SENT, NOTI_TYPE_CHAT } = require('../constants/constants');
const { sendExpoPushMessage } = require('../services/notificationService');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const pubClient = createClient({ url: `redis://${redisHost}:6379` });
const subClient = pubClient.duplicate();
pubClient.on('error', (err) => console.error('routes/socketIO.js-Redis Pub Client Error', err));
subClient.on('error', (err) => console.error('routes/socketIO.js-Redis Sub Client Error', err));
Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('routes/socketIO.js-Redis adapter has been set up successfully.');
}).catch(err => {
    console.error('routes/socketIO.js-Error setting up Redis adapter:', err);
});

const getReceivers = async (senderId) => {
    try {
        const key = `senderReceivers:${senderId}`;
        let receviers = await pubClient.sMembers(key)
        if (!receviers) {
            return null;
        }
        return receviers
    } catch (error) {
        console.log(`routes/socketIO.js-addReceiver error fetching recievers of sender: ${senderId}`, error);
        throw error;
    }
};

const addReceiver = async (senderId, receiverId) => {
    try {
        const key = `senderReceivers:${senderId}`;
        console.log(`routes/socketIO.js-addReceiver Attempting to add receiver ${receiverId} to sender ${senderId}`);
        const isMember = await pubClient.sIsMember(key, receiverId);
        if (isMember) {
            console.log(`routes/socketIO.js- addReceiver Receiver ${receiverId} already exists for sender ${senderId}.`);
            return false;
        } else {
            await pubClient.sAdd(key, receiverId);
            console.log(`routes/socketIO.js- addReceiver Receiver ${receiverId} added to sender ${senderId}.`);
            return true;
        }
    } catch (error) {
        console.log(`routes/socketIO.js-addReceiver Error Attempting to add receiver ${receiverId} to sender ${senderId} Error is:`, error)
        throw error;
    }
};


(async () => {
    require('./gptSocket');
    io.on('connection', (socket) => {
        socket.on('join', async (senderId) => {
            try {
                const userActiveSocketsKey = `activeUsers:${senderId}`;
                const existingSockets = await pubClient.sMembers(userActiveSocketsKey);

                if (existingSockets.length > 0) {
                    await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
                }

                await pubClient.sAdd(userActiveSocketsKey, socket.id);
                socket.join(senderId);

                // Emit user online event to all receivers
                let receiverIds = await getReceivers(senderId);
                if (Array.isArray(receiverIds) && receiverIds.length > 0) {
                    receiverIds.forEach(receiverId => {
                        io.to(receiverId).emit('user online', senderId);
                    });
                }
            } catch (error) {
                console.error('routes/socketIO.js-Error handling join event:', error);
            }
        });

        socket.on('disconnect', async () => {
            try {
                const userSocketsKeyPattern = 'activeUsers:*';
                const keys = await pubClient.keys(userSocketsKeyPattern);
                for (const key of keys) {
                    const activeSockets = await pubClient.sMembers(key);
                    if (activeSockets.includes(socket.id)) {
                        await pubClient.sRem(key, socket.id);
                        const senderId = key.split(':')[1];
                        const receiverIds = await getReceivers(senderId);
                        // Emit user offline event to all receivers
                        if (Array.isArray(receiverIds) && receiverIds.length > 0) {
                            receiverIds.forEach(receiverId => {
                                io.to(receiverId).emit('user offline', senderId);
                            });
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error('routes/socketIO.js- Error handling disconnect event:', error);
            }
        });

        // Handle sending messages
        socket.on('send message', async ({ senderId, receiverId, message, image, replyMessage, localId }) => {
            try {
                if (!message && !image) {
                    throw new Error('Message or image is missing.');
                }

                if (!senderId || !receiverId) {
                    throw new Error('SenderId or receiverId is missing.');
                }
                localId
                const chat = await sendPrivateMessage(senderId, receiverId, message, image, replyMessage, false, localId);
                const blocked = await isUserBlocked(senderId, receiverId);

                if (blocked) {
                    console.log('routes/socketIO.js-Message not sent - one of the users has blocked the other.');
                    return null;
                }

                const mychat = {
                    _id: chat._id,
                    localId: chat.localId,
                    text: chat.message,
                    createdAt: chat.timestamp,
                    repliedTo: chat.repliedTo,
                    status: CHAT_STATUS_SENT,
                    isDeleted: chat.isDeleted,
                    image: chat.image,
                    receiverId: receiverId,
                    senderId: senderId,
                    replyMessage: replyMessage,
                    user: {
                        _id: chat?.sender?._id,
                        name: chat?.sender?.name,
                        avatar_id: chat?.sender?.avatar_id
                    }
                };

                io.to([senderId, receiverId]).emit('new message', { message: mychat });
                await addReceiver(senderId, receiverId);

                const activeUsersKeys = await pubClient.keys('activeUsers:*');
                const onlineUsers = new Set(activeUsersKeys.map(key => key.split(':')[1]));

                let mlastObjSend = {
                    _id: chat._id,
                    _id: chat.receiver._id,
                    name: chat?.receiver?.name,
                    avatar_id: chat?.receiver?.avatar_id,
                    receiverId: receiverId.toString(),
                    senderId: senderId.toString(),
                    isDeleted: chat.isDeleted,
                    online: onlineUsers.has(receiverId.toString()),
                    lastMessage: {
                        _id: mychat._id,
                        message: mychat.text,
                        image: mychat.image,
                        timestamp: mychat.createdAt,
                        status: CHAT_STATUS_SENT,
                        sender: {
                            _id: mychat?.user?._id,
                            name: mychat?.user?.name,
                            avatar_id: mychat?.user?.avatar_id
                        }
                    }
                }

                let mlastObjRec = {
                    _id: chat._id,
                    _id: mychat?.user?._id,
                    name: mychat?.user?.name,
                    avatar_id: mychat?.user?.avatar_id,
                    receiverId: receiverId.toString(),
                    senderId: senderId.toString(),
                    isDeleted: chat.isDeleted,
                    online: onlineUsers.has(senderId.toString()),
                    lastMessage: {
                        _id: mychat._id,
                        message: mychat.text,
                        image: mychat.image,
                        timestamp: mychat.createdAt,
                        status: CHAT_STATUS_SENT,
                        sender: {
                            _id: mychat?.user?._id,
                            name: mychat?.user?.name,
                            avatar_id: mychat?.user?.avatar_id
                        }
                    }
                }

                io.to(senderId).emit('chat heads', { list: mlastObjSend });

                io.to(receiverId).emit('chat heads', { list: mlastObjRec });

                const receiverActiveSocketsKey = `activeUsers:${receiverId}`;
                const receiverActiveSockets = await pubClient.sMembers(receiverActiveSocketsKey);
                if (!receiverActiveSockets.length) {
                    await sendExpoPushMessage(receiverId.toString(), message, chat?.sender?.name, chat?._id, NOTI_TYPE_CHAT, chat)
                }

            } catch (error) {
                console.error('routes/socketIO.js-Error handling send message event:', error);
            }
        });

        // Handle typing indicator
        socket.on('typing', ({ senderId, receiverId }) => {
            io.to(receiverId).emit('user typing', { senderId });
        });

        // socket.on('user status up', async (senderId) => {
        //     const userActiveSocketsKey = `activeUsers:${senderId}`;
        //     const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
        //     if (existingSockets.length > 0) {
        //         await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
        //     }
        //     await pubClient.sAdd(userActiveSocketsKey, senderId);
        //     let receiverIds = await getReceivers(senderId);
        //     console.log(`in send message RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
        //     if (Array.isArray(receiverIds) && receiverIds.length > 0) {
        //         receiverIds.forEach(receiverId => {
        //             console.log(`pushing USER ${senderId} online in send message `)
        //             io.to(receiverId).emit('user online', senderId);
        //         });
        //     }
        // });

        // socket.on('user status down', async (senderId) => {
        //     const userActiveSocketsKey = `activeUsers:${senderId}`;
        //     const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
        //     if (existingSockets.length > 0) {
        //         await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
        //     }
        //     let receiverIds = await getReceivers(senderId);
        //     console.log(`in send message RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
        //     if (Array.isArray(receiverIds) && receiverIds.length > 0) {
        //         receiverIds.forEach(receiverId => {
        //             console.log(`pushing USER ${senderId} online in send message `)
        //             io.to(receiverId).emit('user offine', senderId);
        //         });
        //     }
        // });

        // Handle stop typing indicator
        socket.on('stop typing', ({ senderId, receiverId }) => {
            io.to(receiverId).emit('user stop typing', { senderId });
        });

        // Handle blocking/unblocking users
        socket.on('block', async ({ senderId, receiverId }) => {
            try {
                const doc = await blockUserRepository.findBlockBySenderAndReceiver(senderId, receiverId);
                let result;
                if (doc) {
                    result = await blockUserRepository.deleteBlock(doc._id);
                } else {
                    result = await blockUserRepository.createBlock(senderId, receiverId);
                }

                if (result.deletedCount) {
                    io.to([senderId, receiverId]).emit('blockStatusChanged', { success: true, message: 'Unblocked', senderId, receiverId });
                } else {
                    io.to([senderId, receiverId]).emit('blockStatusChanged', { success: true, message: 'Blocked', senderId, receiverId });
                }
            } catch (err) {
                console.error('routes/socketIO.js-Error managing block status:', err);
            }
        });

        // Handle getting chat history
        socket.on('get messages', async ({ senderId, receiverId, page = 1 }) => {
            try {
                const pageSize = 10;
                const skip = (page - 1) * pageSize;


                const messages = await chatRepository.findChatHistory(senderId, receiverId);

                const receiverActiveSocketsKey = `activeUsers:${receiverId}`;
                const receiverActiveSockets = await pubClient.sMembers(receiverActiveSocketsKey);
                const receiverIsOnline = receiverActiveSockets.length > 0;

                const senderActiveSocketsKey = `activeUsers:${senderId}`;
                const senderActiveSockets = await pubClient.sMembers(senderActiveSocketsKey);
                const senderIsOnline = senderActiveSockets.length > 0;


                //collect blocked info 
                const blockedInfoSender = await blockUserRepository.findBlockBySenderAndReceiver(senderId, receiverId);

                const blockedInfoReceiver = await blockUserRepository.findBlockBySenderAndReceiver(receiverId, senderId);
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

                const transformedMsgs = transformChatMsgs(messages, senderIsOnline, receiverIsOnline, isBlocked, blockedInfoSender, blockedInfoReceiver, isYouBlocked, isReceiverBlocked)
                io.to(senderId).emit('messages', { list: transformedMsgs, receiverIsOnline: receiverIsOnline, senderIsOnline: senderIsOnline });
            } catch (error) {
                console.error('routes/socketIO.js-Error fetching messages:', error);
            }
        });

        // Handle getting chat heads
        socket.on('get chat heads', async ({ senderId }) => {
            try {
                const chatHeads = await chatRepository.findChatHeads(senderId);
                const activeUsersKeys = await pubClient.keys('activeUsers:*');
                const onlineUsers = new Set(activeUsersKeys.map(key => key.split(':')[1]));

                const [blocksByMe, blocksByThem] = await Promise.all([
                    BlockUser.find({ sender: senderId }, 'receiver -_id').lean(),
                    BlockUser.find({ receiver: senderId }, 'sender -_id').lean(),
                ]);

                const blockedByMe = new Set(blocksByMe.map(block => block.receiver.toString()));
                const blockedByThem = new Set(blocksByThem.map(block => block.sender.toString()));

                let myChatHeads = await Promise.all(chatHeads.map(async chat => {
                    chat.online = onlineUsers.has(chat._id.toString());
                    chat.blockedByYou = blockedByMe.has(chat._id.toString());
                    chat.blockedByThem = blockedByThem.has(chat._id.toString());
                    return chat;
                }));
                io.to(senderId).emit('chat heads', { list: myChatHeads });


            } catch (error) {
                console.error('routes/socketIO.js-Error fetching chat heads:', error);
            }
        });

        // Handle getting blocked users
        socket.on('get blocked users', async ({ senderId }) => {
            try {
                const blockedUsers = await blockUserRepository.findBlocksBySender(senderId);
                io.to(senderId).emit('blocked users', blockedUsers);
            } catch (error) {
                console.error('routes/socketIO.js-Error fetching blocked users:', error);
            }
        });
        // Handle message delivered status
        socket.on('delivered', async ({ senderId, receiverId, messageIds }) => {
            try {
                const updateStatusRes = await chatRepository.updateDeliveredStatus(messageIds);
                if (updateStatusRes && updateStatusRes != null) {
                    io.to(senderId).emit('seen', { messageIds, receiverId, updateStatusRes, senderId });
                }
                console.log('routes/socketIO.js-Messages marked as seen successfully.');
            } catch (error) {
                console.error('routes/socketIO.js-Error updating message status:', error);
            }
        });


        // Handle sending messages
        socket.on('delete message', async ({ senderId, receiverId, messageIds }) => {
            try {
                const updateStatusRes = await chatRepository.updateDeleteStatus(messageIds);
                if (updateStatusRes && updateStatusRes != null) {
                    io.to([senderId, receiverId]).emit('deleted', { messageIds, receiverId, updateStatusRes, senderId });
                }
                console.log('routes/socketIO.js-Messages marked as seen successfully.');
            } catch (error) {
                console.error('routes/socketIO.js-Error handling send message event:', error);
            }
        });
    });

})();

module.exports = { io, addReceiver, getReceivers, pubClient };