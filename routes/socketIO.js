require('dotenv').config();
const { sendPrivateMessage, isUserBlocked } = require('../utils/chatUtils');
// const { sendPushMessage } = require('../services/notifications');
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const { io } = require('../utils/socketMain');

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
    const key = `senderReceivers:${senderId}`;
    let receivers = await pubClient.sMembers(key);
    if (!receivers) {
        return null;
    }
    return receivers;
};

const addReceiver = async (senderId, receiverId) => {
    const key = `senderReceivers:${senderId}`;
    console.log("senderReceivers-key", key)
    console.log(`routes/socketIO.js-addReceiver Attempting to add receiver ${receiverId} to sender ${senderId}`);
    const isMember = await pubClient.sIsMember(key, receiverId);
    const isSenderOnline = await pubClient.sIsMember(`activeUsers:${senderId}`, senderId);
    if (isSenderOnline) {
        console.log("addReceiver_ONLINE_STATUS_UPDATE")
        io.to(receiverId).emit('user online', senderId);
    }
    if (isMember) {
        console.log(`routes/socketIO.js- addReceiver Receiver ${receiverId} already exists for sender ${senderId}.`);
        return false;
    } else {
        await pubClient.sAdd(key, receiverId);
        console.log(`routes/socketIO.js- addReceiver Receiver ${receiverId} added to sender ${senderId}.`);
        return true;
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
                
                await pubClient.sAdd(userActiveSocketsKey, senderId);
                socket.join(senderId);
        
                // Emit user online event to all receivers
                let receiverIds = await getReceivers(senderId);
                
                console.log(`in join RECEIVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds));
                
                if (receiverIds && receiverIds.length > 0) {
                    for (const receiverId of receiverIds) {
                        const receiversActiveSocketsKey = `activeUsers:${receiverId}`;
                        await pubClient.sAdd(receiversActiveSocketsKey, senderId);
                        console.log(`pushing USER ${senderId} online in join`);
                        io.to(receiverId).emit('user online', senderId);
                    }
                }
            } catch (error) {
                console.error('Error handling join event:', error);
            }
        });

        socket.on('disconnect', async (senderId) => {
            try {
                const userSocketsKeyPattern = 'activeUsers:*';
                const keys = await pubClient.keys(userSocketsKeyPattern);
                console.log('allKeys------',keys)
                for (const key of keys) {
                    console.log('Processing with ------',key)
                    const activeSockets = await pubClient.sMembers(key);
                    console.log(`Active Sockets of  ------${key}`,activeSockets)
                    if (activeSockets.includes(senderId)) {
                        console.log(`Active Sockets of  ------${key}`,activeSockets)
                        await pubClient.sRem(key, senderId);
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

        // socket.on('disconnect', async (senderId) => {
        //     try {
        //         const userSocketsKeyPattern = 'activeUsers:*';
        //         const keys = await pubClient.keys(userSocketsKeyPattern);
        //         console.log('allKeys------',keys)
        //         for (const key of keys) {
        //             console.log('Processing with ------',key)
        //             const activeSockets = await pubClient.sMembers(key);
        //             console.log(`Active Sockets of  ------${key}`,activeSockets)
        //             if (activeSockets.includes(senderId)) {
        //                 console.log(`Active Sockets of  ------${key}`,activeSockets)
        //                 await pubClient.sRem(key, senderId);
        //                 const senderId = key.split(':')[1];
        //                 const receiverIds = await getReceivers(senderId);
        //                 console.log(`in disconnect RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
        //                 // Emit user offline event to all receivers
        //                 if (Array.isArray(receiverIds) && receiverIds.length > 0) {
        //                     for (const receiverId of receiverIds) {
        //                         // const receiversActiveSocketsKey = `activeUsers:${receiverId}`;
                        
        //                         // await pubClient.sAdd(receiversActiveSocketsKey, senderId);
        //                         console.log(`pushing USER ${senderId} online in join`);
        //                         console.log(`pushing USER ${senderId} offline in disconnect`)
        //                         io.to(receiverId).emit('user offline', senderId);
        //                     }
        //                 }
        //                 break;
        //             }
        //         }
        //     } catch (error) {
        //         console.error('routes/socketIO.js- Error handling disconnect event:', error);
        //     }
        // });

        // Handle sending messages
        socket.on('send message', async ({ senderId, receiverId, message, image, replyMessage }) => {
            try {
                if (!message && !image) {
                    throw new Error('Message or image is missing.');
                }

                if (!senderId || !receiverId) {
                    throw new Error('SenderId or receiverId is missing.');
                }

                const chat = await sendPrivateMessage(senderId, receiverId, message, image, replyMessage, false);
                const blocked = await isUserBlocked(senderId, receiverId);

                if (blocked) {
                    console.log('routes/socketIO.js-Message not sent - one of the users has blocked the other.');
                    return null;
                }

                const mychat = {
                    _id: chat._id,
                    text: chat.message,
                    createdAt: chat.timestamp,
                    repliedTo: chat.repliedTo,
                    status: CHAT_STATUS_SENT,
                    image: chat.image,
                    receiverId: receiverId,
                    senderId: senderId,
                    replyMessage: replyMessage,
                    user: {
                        _id: chat?.sender?._id,
                        name: chat?.sender?.name,
                        avatar: chat?.sender?.avatar
                    }
                };

                io.to([senderId, receiverId]).emit('new message', { message: mychat });
                await addReceiver(senderId, receiverId);
                const activeUsersKeys = await pubClient.keys(`activeUsers:${receiverId}`);
                //test code end
                // Add the new receiver to the sender's receiver list


                // Emit online status to the new receiver
                const isSenderOnline = await pubClient.sIsMember(`activeUsers:${senderId}`, senderId);
                if (isSenderOnline) {
                    console.log("SENDMESSAGE_ONLINE_STATUS_UPDATE")
                    io.to(receiverId).emit('user online', senderId);
                }

                //test code end
                //update online status to recievers.
                let receiverIds = await getReceivers(senderId);
                console.log(`in send message RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
                if (Array.isArray(receiverIds) && receiverIds.length > 0) {
                    receiverIds.forEach(receiverId => {
                        console.log(`pushing USER ${senderId} online in send message `)
                        io.to(receiverId).emit('user online', senderId);
                    });
                }

                if (activeUsersKeys.length > 0) {
                    //await sendPushMessage(receiverId, message, chat?.sender?.name);
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

        socket.on('user status up', async (senderId) => {
            const userActiveSocketsKey = `activeUsers:${senderId}`;
            const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
            if (existingSockets.length > 0) {
                await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
            }
            await pubClient.sAdd(userActiveSocketsKey, senderId);
            let receiverIds = await getReceivers(senderId);
            console.log(`in send message RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
            if (Array.isArray(receiverIds) && receiverIds.length > 0) {
                receiverIds.forEach(receiverId => {
                    console.log(`pushing USER ${senderId} online in send message `)
                    io.to(receiverId).emit('user online', senderId);
                });
            }
        });

        socket.on('user status down', async (senderId) => {
            const userActiveSocketsKey = `activeUsers:${senderId}`;
            const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
            if (existingSockets.length > 0) {
                await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
            }
            let receiverIds = await getReceivers(senderId);
            console.log(`in send message RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
            if (Array.isArray(receiverIds) && receiverIds.length > 0) {
                receiverIds.forEach(receiverId => {
                    console.log(`pushing USER ${senderId} online in send message `)
                    io.to(receiverId).emit('user offine', senderId);
                });
            }
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
                const userActiveSocketsKey = `activeUsers:${senderId}`;
                let isSenderOnline = false;
                isSenderOnline = await pubClient.sIsMember(userActiveSocketsKey, senderId);
                if (isSenderOnline) {
                    io.to(receiverId).emit('user online', senderId);

                }
                const transformedMsgs = transformChatMsgs(messages, isSenderOnline)
                io.to(senderId).emit('messages', transformedMsgs);
            } catch (error) {
                console.error('routes/socketIO.js-Error fetching messages:', error);
            }
        });

        // Handle getting chat heads
        socket.on('get chat heads', async (senderId) => {
            try {
                const chatHeads = await chatRepository.findChatHeads(senderId);

                // const userActiveSocketsKey = `activeUsers:${senderId}`;
                // const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
                // if (existingSockets.length > 0) {
                //     await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
                // }
                // await pubClient.sAdd(userActiveSocketsKey, socket.id);
                // socket.join(senderId);
                const userActiveSocketsKey = `activeUsers:${senderId}`;
                const existingSockets = await pubClient.sMembers(userActiveSocketsKey);
                if (existingSockets.length > 0) {
                    await pubClient.sRem(userActiveSocketsKey, ...existingSockets);
                }
                await pubClient.sAdd(userActiveSocketsKey, senderId);
                // Emit user online event to all receivers
                let receiverIds = await getReceivers(senderId);
                console.log(`in getChatHeads RECIEVER_ID_OF SENDER ${senderId} :`, JSON.stringify(receiverIds))
                if (receiverIds && receiverIds.length > 0) {
                    receiverIds.forEach(receiverId => {
                        console.log(`pushing USER ${senderId} online in getChatHeads `)
                        io.to(receiverId).emit('user online', senderId);
                    });
                }
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
        socket.on('delivered', async (messageIds) => {
            try {
                const updateStatusRes = await chatRepository.updateDeliveredStatus(messageIds);
                //todo how to inform client about chat delivered or not in realtime ?
                console.log('routes/socketIO.js-Messages marked as seen successfully.');
            } catch (error) {
                console.error('routes/socketIO.js-Error updating message status:', error);
            }
        });
    });


})();

module.exports = { io, addReceiver, getReceivers, pubClient };