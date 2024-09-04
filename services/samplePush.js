// const TopicProgressModel = require('../models/userCourseModels')
// const axios = require('axios');
// require('dotenv').config();

// async function sendDueTopicsPushNotification() {
//   try {
//       // Find all users with due topics
//       const usersWithDueTopics = await TopicProgressModel.aggregate([
//         {
//             $match: {
//                 'Date': { $lte: new Date() },
//                 'isCompleted': false,
//             },
//         },
//         {
//             $group: {
//                 _id: '$user',
//                 topics: { $push: '$topic' },
//             },
//         },
//     ]);

//       if (usersWithDueTopics.length > 0) {
//           // Iterate over users and send individualized notifications
//           for (const userWithDueTopics of usersWithDueTopics) {
//               const userId = userWithDueTopics._id;
//               const topics = userWithDueTopics.topics;

//               const payload = {
//                   app_id: process.env.ONE_SIGNAL_APP_ID,
//                   include_external_user_ids: [userId],
//                   contents: {
//                       en: `You have ${topics.length} due topic(s) to complete: ${topics.join(', ')}`,
//                   },
//                   data: {type:'study'} 
//               };

//               const response = await axios.post('https://onesignal.com/api/v1/notifications', payload, {
//                   headers: {
//                       Authorization: process.env.ONE_SIGNAL_SECRET,
//                       'Content-Type': 'application/json',
//                   },
//               });

//               console.log(`Push notification sent successfully to user ${userId}:`, response.data);
//           }
//       } else {
//           console.log('No users with due topics found.');
//       }
//   } catch (error) {
//       console.error('Error:', error.message);
//   }
// }

//   module.exports = {
//     sendDueTopicsPushNotification
//   }