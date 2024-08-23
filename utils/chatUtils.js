const ChatModel = require('../models/chatModels');
const BlockUser = require('../models/blockedUser');
const mongoose = require('mongoose');
const s3 = require('../services/awsS3');

const sendPrivateMessage = async (senderId, receiverId, message, image, parentID) => {
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
                console.log('Image uploaded successfully:', imageLink);
            } catch (err) {
                console.error('Failed to upload image:', err);
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
        console.error('Error in sendPrivateMessage function:', error);
        throw error;
    }
};

const isUserBlocked = async (senderId, receiverId) => {
    const blockExists = await BlockUser.findOne({
        $or: [
            { sender: senderId, receiver: receiverId },
            { sender: receiverId, receiver: senderId }
        ]
    });
    return !!blockExists;
};

module.exports = { sendPrivateMessage, isUserBlocked };