require('dotenv').config()
const ChatModel = require('../models/chatModels')
const BlockUser = require('../models/blockedUser')
const mongoose = require('mongoose');
const axios = require('axios');
const { ObjectId } = require('mongoose').Types;
const AWS = require('aws-sdk');
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");
const pubClient = createClient({ url: "redis://redis:6379" });
const subClient = pubClient.duplicate();
const { io } = require('../utils/socketMain')
require('./gptSocket')

pubClient.on('error', (err) => console.error('Redis Pub Client Error', err));
subClient.on('error', (err) => console.error('Redis Sub Client Error', err));

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis adapter has been set up successfully.');
}).catch(err => {
    console.error('Error setting up Redis adapter:', err);
});

//aws 
AWS.config.update({
    accessKeyId: process.env.AWS_SECRET_S3,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_S3
});

const s3 = new AWS.S3({
    params: {
        Bucket: process.env.AWS_S3_BUCKET_NAME
    }
});

const getReceivers = async (senderId) => {
    const key = `senderReceivers:${senderId}`;
    let receviers = await pubClient.sMembers(key)
    if (!receviers) {
        return null;
    }
    return receviers
};

const addReceiver = async (senderId, receiverId) => {
    const key = `senderReceivers:${senderId}`;
    console.log(`Attempting to add receiver ${receiverId} to sender ${senderId}`);
    const isMember = await pubClient.sIsMember(key, receiverId);
    if (isMember) {
        console.log(`Receiver ${receiverId} already exists for sender ${senderId}.`);
        return false;
    } else {
        await pubClient.sAdd(key, receiverId);
        console.log(`Receiver ${receiverId} added to sender ${senderId}.`);
        return true;
    }
};

async function isUserBlocked(senderId, receiverId) {
    const blockExists = await BlockUser.findOne({
        $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
        ]
    });
    return !!blockExists;
}


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
            console.error('Error handling join event:', error);
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


    socket.on('send message', async ({ senderId, receiverId, message, image, parentID }) => {
        try {
            if (!message && !image) {
                throw new Error('routes/socketIO.js- Error: message or image is missing.');
            }

            if (!senderId || !receiverId) {
                throw new Error('routes/socketIO.js- Error: senderId or receiverId is missing.');
            }
            const chat = await sendPrivateMessage(senderId, receiverId, message, image, parentID);

            const blocked = await isUserBlocked(senderId, receiverId);

            if (blocked) {
                console.log('routes/socketIO.js-Message not sent - one of the users has blocked the other.');
                return null
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

            addReceiver(senderId, receiverId)

            const activeUsersKeys = await pubClient.keys('activeUsers:*');

            const onlineUsers = new Set(activeUsersKeys.map(key => key.split(':')[1]));

            let mlastObjSend = {
                _id: chat.receiver._id,
                name: chat?.receiver?.name,
                avatar: chat?.receiver?.avatar,
                online: onlineUsers.has(receiverId.toString()),
                lastMessage: {
                    _id: mychat._id,
                    message: mychat.text,
                    image: mychat.image,
                    timestamp: mychat.createdAt,
                    status: 'sent',
                    sender: {
                        _id: mychat?.user?._id
                    }
                }
            }

            let mlastObjRec = {
                _id: mychat?.user?._id,
                name: mychat?.user?.name,
                avatar: mychat?.user?.avatar,
                online: onlineUsers.has(senderId.toString()),
                lastMessage: {
                    _id: mychat._id,
                    message: mychat.text,
                    image: mychat.image,
                    timestamp: mychat.createdAt,
                    status: 'sent',
                    sender: {
                        _id: mychat?.user?._id
                    }
                }
            }

            io.to(senderId).emit('chat heads', { list: mlastObjSend });

            io.to(receiverId).emit('chat heads', { list: mlastObjRec });

            const receiverActiveSocketsKey = `activeUsers:${receiverId}`;
            const receiverActiveSockets = await pubClient.sMembers(receiverActiveSocketsKey);
            if (!receiverActiveSockets.length) {
                sendPushMessage(receiverId, chat.message, chat?.sender?.name);
            }

        } catch (error) {
            console.error(error.message);
        }
    });

    // socket.on('delivered', async ({ messageIds }) => {
    //     try {
    //         await ChatModel.updateMany(
    //             { _id: { $in: messageIds } }, 
    //             { $set: { status: 'seen' } } 
    //         );
    //         console.log('Messages marked as seen successfully.');
    //     } catch (error) {
    //         console.error('Error updating message status:', error);
    //     }
    // });

    socket.on('typing', ({ senderId, receiverId }) => {
        io.to(receiverId).emit('user typing', { senderId });
    });

    socket.on('stop typing', ({ senderId, receiverId }) => {
        io.to(receiverId).emit('user stop typing', { senderId });
    });

    socket.on('block', ({ senderId, receiverId }) => {
        BlockUser.findOne({ sender: senderId, receiver: receiverId })
            .then(doc => {
                if (doc) {
                    return BlockUser.deleteOne({ _id: doc._id });
                } else {
                    return BlockUser.create({
                        sender: senderId,
                        receiver: receiverId
                    });
                }
            })
            .then(result => {
                if (result.deletedCount) {
                    console.log('routes/socketIO.js-Block removed successfully');
                    io.to([senderId, receiverId]).emit('blockStatusChanged', { success: true, message: 'Unblocked', senderId, receiverId });
                } else {
                    io.to([senderId, receiverId]).emit('blockStatusChanged', { success: true, message: 'blocked', senderId, receiverId });
                }
            })
            .catch(err => {
                console.error('routes/socketIO.js-Error managing block status:', err);
            });

    });

    socket.on('flag', ({ messageId }) => {
        console.log('routes/socketIO.js-message flagged')
    });

    socket.on('get messages', async ({ senderId, receiverId, page = 1 }) => {
        try {
            const pageSize = 10;
            const skip = (page - 1) * pageSize;

            const chatsHistory = await ChatModel.find({
                $or: [
                    { $and: [{ sender: new ObjectId(senderId) }, { receiver: new ObjectId(receiverId) }] },
                    { $and: [{ sender: new ObjectId(receiverId) }, { receiver: new ObjectId(senderId) }] }
                ],
                status: { $ne: 'seen' }
            }).sort({ timestamp: -1 })
                // .skip(skip)
                // .limit(pageSize)
                .populate('sender', '_id name avatar')


            // console.log(chatsHistory)

            const modifiedChatsHistory = chatsHistory.map(chat => ({
                _id: chat._id,
                text: chat.message,
                image: chat.image ?? '',
                createdAt: chat.timestamp,
                repliedTo: chat.repliedTo,
                status: chat.status,
                receiverId,
                senderId,
                user: {
                    _id: chat.sender._id,
                    name: chat.sender.name,
                    avatar: chat.sender.avatar
                }
            }));

            const receiverActiveSocketsKey = `activeUsers:${receiverId}`;
            const receiverActiveSockets = await pubClient.sMembers(receiverActiveSocketsKey);
            const receiverIsOnline = receiverActiveSockets.length > 0;

            io.to(senderId).emit('message history', { list: modifiedChatsHistory, online: receiverIsOnline });
        } catch (error) {
            console.error('routes/socketIO.js-Error retrieving chat history:', error);
        }
    });

    socket.on('get chat heads', async ({ senderId }) => {
        try {

            const chatHeads = await ChatModel.aggregate([
                {
                    $match: {
                        $or: [
                            { sender: new mongoose.Types.ObjectId(senderId) },
                            { receiver: new mongoose.Types.ObjectId(senderId) }
                        ],
                        status: { $ne: 'seen' }
                    }
                },
                {
                    $sort: { timestamp: -1 }
                },
                {
                    $group: {
                        _id: { $cond: [{ $eq: ["$sender", new mongoose.Types.ObjectId(senderId)] }, "$receiver", "$sender"] },
                        lastMessage: { $first: "$$ROOT" }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                {
                    $unwind: "$user"
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "lastMessage.sender",
                        foreignField: "_id",
                        as: "lastMessage.sender"
                    }
                },
                {
                    $unwind: "$lastMessage.sender"
                },
                {
                    $project: {
                        _id: "$user._id",
                        name: "$user.name",
                        avatar: "$user.avatar",
                        lastMessage: {
                            _id: "$lastMessage._id",
                            message: "$lastMessage.message",
                            image: "$lastMessage.image",
                            timestamp: "$lastMessage.timestamp",
                            status: "$lastMessage.status",
                            sender: {
                                _id: "$lastMessage.sender._id",
                            }
                        }
                    }
                }
            ]);

            const activeUsersKeys = await pubClient.keys('activeUsers:*');

            const onlineUsers = new Set(activeUsersKeys.map(key => key.split(':')[1]));

            const [blocksByMe, blocksByThem] = await Promise.all([
                BlockUser.find({ sender: senderId }, 'receiver -_id').lean(),
                BlockUser.find({ receiver: senderId }, 'sender -_id').lean(),
            ]);


            const blockedByMe = new Set(blocksByMe.map(block => block.receiver.toString()));
            const blockedByThem = new Set(blocksByThem.map(block => block.sender.toString()));

            // console.log(chatHeads)

            let myChatHeads = await Promise.all(chatHeads.map(async chat => {
                chat.online = onlineUsers.has(chat._id.toString());
                chat.blockedByYou = blockedByMe.has(chat._id.toString());
                chat.blockedByThem = blockedByThem.has(chat._id.toString());
                return chat;
            }));

            io.to(senderId).emit('chat heads', { list: myChatHeads });
        } catch (error) {
            console.error('routes/socketIO.js-Error retrieving chat heads:', error);
        }
    });

});

async function sendPrivateMessage(senderId, receiverId, message, image, parentID) {
    try {
        let imageLink = null;

        if (image) {
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            const imageFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.jpg`;

            const uploadImageParams = {
                Bucket: 'mybucketelance',
                Key: imageFilename,
                Body: imageBuffer,
                ContentType: 'image/jpeg',
            };

            try {
                const imageS3Response = await s3.upload(uploadImageParams).promise();
                imageLink = imageS3Response.Location;
                console.log('routes/socketIO.js-sendPrivateMessage Image uploaded successfully:', imageLink);
            } catch (err) {
                console.error('routes/socketIO.js-sendPrivateMessage Failed to upload image:', err);
                throw err;
            }
        }

        const chat = new ChatModel({
            sender: senderId,
            receiver: receiverId,
            message: message,
            image: imageLink,
            repliedTo: parentID,
            status: 'sent',
        });

        await chat.save();
        await chat.populate([
            { path: 'sender', select: '_id avatar name' },
            { path: 'receiver', select: '_id avatar name' }
        ]);

        return chat;

    } catch (error) {
        console.error('routes/socketIO.js-sendPrivateMessage Error in sendPrivateMessage function:', error);
        throw error;
    }
}

const sendPushMessage = async (receiverId, message, senderName) => {
    const payload = {
        app_id: process.env.ONE_SIGNAL_APP_ID,
        include_external_user_ids: [receiverId],
        contents: {
            en: `You have a message from ${senderName} message:${message}`,
        },
        data: { type: 'chat' }
    };
    const baseUrl = process.env.ONE_SIGNAL_URL;
    if(!baseUrl || !process.env.ONE_SIGNAL_APP_ID){
        throw new Error('ONE_SIGNAL_APP_ID or ONE_SIGNAL_URL is not set in env');
    }

    const response = await axios.post(baseUrl, payload, {
        headers: {
            Authorization: process.env.ONE_SIGNAL_SECRET,
            'Content-Type': 'application/json',
        },
    });

    console.log(`routes/socketIO.js-sendPushMessage Push notification sent successfully to user ${receiverId}:`);
}

module.exports = { io };
