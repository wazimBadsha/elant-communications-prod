// repositories/chatRepository.js
const mongoose = require('mongoose');
const ChatModel = require('../models/chatModels');
const UserModel = require('../models/userModel');  // Import the User model
const { CHAT_STATUS_SEEN } = require('../constants/constants');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const findChatHistory = async (senderId, receiverId) => {
  if (!isValidObjectId(senderId) || !isValidObjectId(receiverId)) {
    console.log("repositories/aiChatRepository.js-findChatHistory-senderId------", senderId);
    console.log("repositories/aiChatRepository.js-findChatHistory-receiverId------", receiverId);
    throw new Error('Invalid ObjectId');
  }

  return ChatModel.find({
    $or: [
      { sender: new mongoose.Types.ObjectId(senderId), receiver: new mongoose.Types.ObjectId(receiverId) },
      { sender: new mongoose.Types.ObjectId(receiverId), receiver: new mongoose.Types.ObjectId(senderId) }
    ],
    status: { $ne: CHAT_STATUS_SEEN }
  }).sort({ timestamp: -1 }).populate('sender', '_id name avatar_id').populate('receiver', '_id name avatar_id');
};

const findChatHeads = async (senderId) => {
  return ChatModel.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(senderId) },
          { receiver: new mongoose.Types.ObjectId(senderId) }
        ]
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
        avatar_id: "$user.avatar_id",
        receiver_id: "$lastMessage.receiver._id",
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
};

// const updateDeliveredStatus = async (messageIds = []) => {
//   try {
//     // Convert string IDs to ObjectId
//     if (messageIds && messageIds.length > 0) {
//       console.log("STATUS_CHANGE_TOBE----->",messageIds)
//       const objectIdArray = messageIds.map(id => new mongoose.Types.ObjectId(id));
//       console.log("STATUS_CHANGE_TOBE-objectIdArray----->",objectIdArray)
//       await ChatModel.updateMany(
//         { _id: { $in: objectIdArray } },
//         { $set: { status: CHAT_STATUS_SEEN } }
//       );
//       console.log(`repositories/aiChatRepository.js - Messages marked as seen successfully. messageIds: ${messageIds}`);
//       return;
//     } else {
//       return;
//     }
//   } catch (error) {
//     console.error('repositories/aiChatRepository.js - Error updating message status:', error);
//   }
// };

const updateDeliveredStatus = async (messageIds = []) => {
  try {
    // Convert string IDs to ObjectId
    if (messageIds && messageIds.length > 0) {
      const objectIdArray = messageIds.map(id => new mongoose.Types.ObjectId(id));

      // Update the status of the messages
      await ChatModel.updateMany(
        { _id: { $in: objectIdArray } },
        { $set: { status: CHAT_STATUS_SEEN } }
      );

      // Retrieve and return the updated chat objects
      const updatedMessages = await ChatModel.find({ _id: { $in: objectIdArray } });

      console.log(`repositories/aiChatRepository.js - Messages marked as seen successfully. messageIds: ${messageIds}`);
      return updatedMessages;  // Return the full updated chat objects
    } else {
      return [];
    }
  } catch (error) {
    console.error('repositories/aiChatRepository.js - Error updating message status:', error);
    throw error;  // Optionally, rethrow the error if needed
  }
};

const updateDeleteStatus = async (messageIds = []) => {
  try {
    // Convert string IDs to ObjectId
    if (messageIds && messageIds.length > 0) {
      const objectIdArray = messageIds.map(id => new mongoose.Types.ObjectId(id));

      // Update the status of the messages
      await ChatModel.updateMany(
        { _id: { $in: objectIdArray } },
        { $set: { isDeleted: true } }
      );

      // Retrieve and return the updated chat objects
      const updatedMessages = await ChatModel.find({ _id: { $in: objectIdArray } });

      console.log(`repositories/aiChatRepository.js - Messages marked as deleted successfully. messageIds: ${messageIds}`);
      return updatedMessages;  // Return the full updated chat objects
    } else {
      return [];
    }
  } catch (error) {
    console.error('repositories/aiChatRepository.js - Error deleting message:', error);
    throw error; 
  }
};

module.exports = {
  findChatHistory,
  findChatHeads,
  updateDeliveredStatus,
  updateDeleteStatus
};