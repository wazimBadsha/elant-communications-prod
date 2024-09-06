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

function transformChatMsgs(input, isSenderOnline,isReceiverOnline, isBlocked, blockedInfoSender, blockedInfoReceiver, isYouBlocked, isReceiverBlocked) {
    const messagesList = input.map(item => {
        if (item.system) {
            // If it's a system message, only return the essential fields
            return {
                _id: item._id,
                text: item.message,
                createdAt: item.timestamp,
                system: item.system,
                isDeleted: false,
            };
        }

        // For non-system messages, return all fields
        return {
            text: item.message,
            createdAt: item.timestamp,
            image: item.image,
            status: item.status,
            sent: item.status === CHAT_STATUS_SENT || item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
            received: item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
            pending: false,
            isDeleted: item.isDeleted,
            replyMessage: item.replyMessage,
            system: item.system,
            receiver: {
                online : isReceiverOnline,
                _id: item.receiver._id,
                name: item.receiver.name,
                avatar: item.receiver.avatar_id || null
            },
            user: {
                online: isSenderOnline,
                _id: item.sender._id,
                name: item.sender.name,
                avatar: item.sender.avatar_id || null
            },
            _id: item._id,
            localId: item.localId,
        };
    });

    return {
        messages: messagesList,
        isSenderOnline: isSenderOnline,
        isReceiverOnline: isReceiverOnline,
        blocked: isBlocked,
        yourBlockedInfo: blockedInfoSender,
        blockedInfoReceiver,
        isYouBlocked,
        isReceiverBlocked
    };
}

// function transformChatMsgs(input, isSenderOnline, isBlocked, blockedInfoSender,  blockedInfoReceiver ,isYouBlocked, isReceiverBlocked) {
//     const messagesList = input.map(item => ({
//         text: item.message,
//         createdAt: item.timestamp,
//         image: item.image,
//         status: item.status,
//         sent: item.status === CHAT_STATUS_SENT || item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
//         received: item.status === CHAT_STATUS_RECEIVED || item.status === CHAT_STATUS_SEEN,
//         pending: false,
//         replyMessage: item.replyMessage,
//         system: item.system, //todo: here if item.system == true then no need of receiver, user, object. ie, only _id,text,createdAt,system these field are enough. make desired changes 
//         receiver: {
//             _id: item.receiver._id,
//             name: item.receiver.name,
//             avatar: item.receiver.avatar_id || null
//         },
//         user: {
//             online: isSenderOnline,
//             _id: item.sender._id,
//             name: item.sender.name,
//             avatar: item.sender.avatar_id || null  // Assuming avatar_id might be part of user info
//         },
//         _id: item._id
//     }));
//     return {
//         messages: messagesList,
//         online: isSenderOnline,
//         blocked: isBlocked,
//         yourBlockedInfo: blockedInfoSender,
//         blockedInfoReceiver,
//         isYouBlocked, 
//         isReceiverBlocked
//     }
// }

module.exports = { transformMsgInput, transformSingleAiChatRes, transformChatMsgs };
