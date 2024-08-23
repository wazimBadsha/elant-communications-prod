require('dotenv').config();
const { sendPrivateMessage, isUserBlocked } = require('../utils/chatUtils');
const { sendPushMessage } = require('../services/notifications');
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { io } = require('../utils/socketMain');

// Import repository methods
const chatRepository = require('../repositories/chatRepository');
const blockUserRepository = require('../repositories/blockUserRepository');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';


(async () => {
    require('./gptSocket');
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

    io.on('connection', (socket) => {
        // Handle user joining the chat
        socket.on('join', async (senderId) => {
            try {
                const userActiveSocketsKey = `activeUsers:${senderId}`;
                const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
                if (existingSockets.length > 0) {
                    await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
                }
                await pubClient.sAdd(userActiveSocketsKey, socket.id);
                socket.join(senderId);

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

        // Handle user disconnecting from the chat
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

                        if (Array.isArray(receiverIds) && receiverIds.length > 0) {
                            receiverIds.forEach(receiverId => {
                                io.to(receiverId).emit('user offline', senderId);
                            });
                        }
                        break;
                    }
                }
            } catch (error) {
                console.error('routes/socketIO.js-Error handling disconnect event:', error);
            }
        });

        // Handle sending messages
        socket.on('send message', async ({ senderId, receiverId, message, image, parentID }) => {
            try {
                if (!message && !image) {
                    throw new Error('Message or image is missing.');
                }

                if (!senderId || !receiverId) {
                    throw new Error('SenderId or receiverId is missing.');
                }

                const chat = await sendPrivateMessage(senderId, receiverId, message, image, parentID);
                const blocked = await isUserBlocked(senderId, receiverId);

                if (blocked) {
                    console.log('routes/socketIO.js-Message not sent - one of the users has blocked the other.');
                    return null;
                }

                const mychat = {
                    _id: chat._id,
                    text: chat.message,
                    createdAt: chat.timestamp,
                    repliedTo: parentID,
                    status: 'sent',
                    image: chat.image,
                    receiverId: receiverId,
                    senderId: senderId,
                    user: {
                        _id: chat?.sender?._id,
                        name: chat?.sender?.name,
                        avatar: chat?.sender?.avatar
                    }
                };

                io.to([senderId, receiverId]).emit('new message', { message: mychat });
                addReceiver(senderId, receiverId);
                const activeUsersKeys = await pubClient.keys(`activeUsers:${receiverId}`);
                if (activeUsersKeys.length > 0) {
                    await sendPushMessage(receiverId, message, chat?.sender?.name);
                }
            } catch (error) {
                console.error('routes/socketIO.js-Error handling send message event:', error);
            }
        });

        // Handle typing indicator
        socket.on('typing', ({ senderId, receiverId }) => {
            io.to(receiverId).emit('user typing', { senderId });
        });

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
                    console.log('routes/socketIO.js-Block removed successfully');
                    io.to([senderId, receiverId]).emit('blockStatusChanged', { success: true, message: 'Unblocked', senderId, receiverId });
                } else {
                    io.to([senderId, receiverId]).emit('blockStatusChanged', { success: true, message: 'Blocked', senderId, receiverId });
                }
            } catch (err) {
                console.error('routes/socketIO.js-Error managing block status:', err);
            }
        });

        // Handle getting chat history
        socket.on('get messages', async ({ senderId, receiverId }) => {
            try {
                const messages = await chatRepository.findChatHistory(senderId, receiverId);
                io.to(senderId).emit('messages', messages);
            } catch (error) {
                console.error('routes/socketIO.js-Error fetching messages:', error);
            }
        });

        // Handle getting chat heads
        socket.on('get chat heads', async (senderId) => {
            try {
                const chatHeads = await chatRepository.findChatHeads(senderId);
                io.to(senderId).emit('chat heads', chatHeads);
            } catch (error) {
                console.error('routes/socketIO.js-Error fetching chat heads:', error);
            }
        });

        // Handle getting blocked users
        socket.on('get blocked users', async (senderId) => {
            try {
                const blockedUsers = await blockUserRepository.findBlocksBySender(senderId);
                io.to(senderId).emit('blocked users', blockedUsers);
            } catch (error) {
                console.error('routes/socketIO.js-Error fetching blocked users:', error);
            }
        });
        // Handle message delivered status
        socket.on('delivered', async ({ messageIds }) => {
            try {
                const updateStatusRes = await chatRepository.updateDeliveredStatus(messageIds);
                //todo how to inform client about chat delivered or not in realtime ?
                console.log('routes/socketIO.js-Messages marked as seen successfully.');
            } catch (error) {
                console.error('routes/socketIO.js-Error updating message status:', error);
            }
        });
    });

    const getReceivers = async (senderId) => {
        const key = `senderReceivers:${senderId}`;
        let receivers = await pubClient.sMembers(key);
        if (!receivers) {
            return null;
        }
        return receivers;
    };

    const addReceiver = async (senderId, receiverId) => {
        const key = `senderReceivers:${senderId}`;
        console.log(`utils/redisUtils.js-Attempting to add receiver ${receiverId} to sender ${senderId}`);
        const isMember = await pubClient.sIsMember(key, receiverId);
        if (isMember) {
            console.log(`utils/redisUtils.js-Receiver ${receiverId} already exists for sender ${senderId}.`);
            return false;
        } else {
            await pubClient.sAdd(key, receiverId);
            console.log(`utils/redisUtils.js-Receiver ${receiverId} added to sender ${senderId}.`);
            return true;
        }
    };

})();

module.exports = { io };