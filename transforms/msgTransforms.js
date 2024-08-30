const { CHAT_STATUS_SENT, CHAT_STATUS_RECEIVED, CHAT_STATUS_SEEN } = require("../constants/constants");

function transformMsgInput(input, userInfo) {
    const output = [];
    try {
        input.forEach((item) => {
            //First, create the "reply" type object
            item.messageReply.content.forEach((content, i) => {
                const replyObject = {
                    type: "reply",
                    durationInMs: item.durationInMs,
                    replyContentCount: item.messageReply.content.length,
                    _id: item.messageReply.id,
                    messageContentType: content.type,
                    text: content.text.value,
                    createdAt: item.createdAt,
                    //createdAt: formatTimestamp(item.messageReply.created_at),
                    user: {
                        _id: "ai_bot",
                        name: "aiBot",
                        avatar: "aiBotAvatarId",
                    },
                    image: null,
                };

                output.push(replyObject);
            });


            // Then, create the "query" type objects
            const queryObject = {
                durationInMs: item.durationInMs,
                type: "query",
                _id: item._id,
                text: item.message,
                createdAt: item.createdAt,
                user: {
                    _id: userInfo._id,
                    name: userInfo.name,
                    avatar: userInfo.avatar_id,
                },
                image: item.image || null,
            };

            output.push(queryObject);
        });

        // Reverse the order of the array elements
        return output;

    } catch (error) {
        throw error;
    }
}

// Helper function to convert UNIX timestamp to "YYYY-MM-DDTHH:MM:SS.MS2Z" format
function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toISOString();
}

function transformSingleAiChatRes(input) {
    let output = [];
    input.content.forEach((content, i) => {
        const replyObject = {
            replyIndex: i + 1,
            type: "reply",
            replyContentCount: input.content.length,
            _id: input.id,
            messageContentType: content.type,
            text: content.text.value,
            createdAt: formatTimestamp(input.created_at),
            user: {
                _id: "ai_bot",
                name: "aiBot",
                avatar: "aiBotAvatarId",
            },
            image: null,
        };

        output.push(replyObject);
    });
    return output;
}

function transformChatMsgs(input, isSenderOnline, isBlocked, blockedInfo) {
    const messagesList = input.map(item => ({
        text: item.message,
        createdAt: item.timestamp,
        image: item.image,
        status: item.status,
        send: item.status === CHAT_STATUS_SENT || item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
        received: item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
        pending: false,
        replyMessage: item.replyMessage,
        receiver: {
            _id: item.receiver._id,
            name: item.receiver.name,
            avatar: item.receiver.avatar_id || null
        },
        user: {
            online: isSenderOnline,
            _id: item.sender._id,
            name: item.sender.name,
            avatar: item.sender.avatar_id || null  // Assuming avatar_id might be part of user info
        },
        _id: item._id
    }));
    return {
        messages: messagesList,
        online: isSenderOnline,
        blocked: isBlocked,
        blockedInfo: blockedInfo
    }
}

function transformChatMsgsHistory(input, isSenderOnline) {
    const messagesList = input.map(item => ({
        text: item.message,
        createdAt: item.timestamp,
        image: item.image,
        status: item.status,
        send: item.status === CHAT_STATUS_SENT || item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
        received: item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
        pending: false,
        replyMessage: item.replyMessage,
        receiver: {
            _id: item.receiver._id,
            name: item.receiver.name,
            avatar: item.receiver.avatar_id || null
        },
        user: {
            online: isSenderOnline,
            _id: item.sender._id,
            name: item.sender.name,
            avatar: item.sender.avatar_id || null  // Assuming avatar_id might be part of user info
        },
        _id: item._id
    }));
    return {
        messages: messagesList,
        online: isSenderOnline
    }
}

// Example usage
// const input = [
//     {
//         "_id": "66c3428c02f769beb8c87f8f",
//         "sender": {
//             "_id": "6692424309e33f7ef062f39c",
//             "name": "Anas"
//         },
//         "receiver": {
//             "_id": "6694c2b84f004062cbd00b5f",
//             "name": "Suhail"
//         },
//         "message": "Hello",
//         "status": "sent",  
//         "image": null,
//         "timestamp": "2024-08-19T13:03:08.648Z",
//         "__v": 0
//     },
//     {
//         "_id": "66c3429102f769beb8c87f9a",
//         "sender": {
//             "_id": "6694c2b84f004062cbd00b5f",
//             "name": "Suhail"
//         },
//         "receiver": {
//             "_id": "6692424309e33f7ef062f39c",
//             "name": "Anas"
//         },
//         "message": "Hi",
//         "status": "sent",
//         "image": null,
//         "timestamp": "2024-08-19T13:03:13.693Z",
//         "__v": 0
//     }
// ];

// console.log(transformChatMsgs(input));

module.exports = { transformMsgInput, transformSingleAiChatRes, transformChatMsgs, transformChatMsgsHistory };

// // Example usage
// const input = [
//     {
//       "_id": "66c5d6554677b6a3b8e9c6b7",
//       "threadId": "thread_QCdhSMmjPzt3CcDlOjeHFpQw",
//       "user": { id: "6692424309e33f7ef062f39c", name: "User", avatarId: "avatar_001" },
//       "message": "Google pay payment integration using stripe step by step guide for node js",
//       "messageReply": {
//         "id": "msg_G9KOJhqwkFvlNOceFZiuWqJe",
//         "object": "thread.message",
//         "created_at": 1724241490,
//         "assistant_id": "asst_0f8YTWzpXus9Rsa2GjtVerd6",
//         "thread_id": "thread_QCdhSMmjPzt3CcDlOjeHFpQw",
//         "run_id": "run_07ELTURUvILIQ63JDIea5btI",
//         "role": "assistant",
//         "content": [
//           {
//             "type": "text",
//             "text": {
//               "value": "I currently don't have access to the specific documents that contain the step-by-step guide for integrating Google Pay payments using Stripe for Node.js. If you need assistance with this integration, I can provide general guidance or help you search for relevant resources online. Let me know how you'd like to proceed.",
//               "annotations": []
//             }
//           },
//           {
//             "type": "text",
//             "text": {
//               "value": "Remaining answer",
//               "annotations": []
//             }
//           }
//         ],
//         "attachments": []
//       },
//       "durationInMs": 4803,
//       "createdAt": "2024-08-21T11:58:13.942Z",
//       "updatedAt": "2024-08-21T11:58:13.942Z"
//     },
//     {
//       "_id": "66c5d65546dasdsd4343435",
//       "threadId": "thread_QCdhSMmjPzt3CcDlOjeHFpQw",
//       "user": { id: "6692424309e33f7ef062f39c", name: "User", avatarId: "avatar_002" },
//       "message": "Google pay payment integration using stripe step by step guide for node js",
//       "messageReply": {
//         "id": "msg_G9KOJhqwkFvlNOceFZiuerer4f",
//         "object": "thread.message",
//         "created_at": 1724241450,
//         "assistant_id": "asst_0f8YTWzpXus9Rsa2GjtVerd6",
//         "thread_id": "thread_QCdhSMmjPzt3CcDlOjeHFpQw",
//         "run_id": "run_07ELTURUvILIQ63JDIea5btI",
//         "role": "assistant",
//         "content": [
//           {
//             "type": "text",
//             "text": {
//               "value": "I currently don't have access to the specific documents that contain the step-by-step guide for integrating Google Pay payments using Stripe for Node.js. If you need assistance with this integration, I can provide general guidance or help you search for relevant resources online. Let me know how you'd like to proceed.",
//               "annotations": []
//             }
//           }
//         ],
//         "attachments": []
//       },
//       "durationInMs": 5303,
//       "createdAt": "2024-08-21T10:44:13.942Z",
//       "updatedAt": "2024-08-21T10:44:13.942Z"
//     }
//   ];

//   console.log(JSON.stringify(transformInput(input), null, 2));
