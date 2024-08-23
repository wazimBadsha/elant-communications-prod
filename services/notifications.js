const axios = require('axios');

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
    if (!baseUrl || !process.env.ONE_SIGNAL_APP_ID) {
        throw new Error('ONE_SIGNAL_APP_ID or ONE_SIGNAL_URL is not set in env');
    }

    const response = await axios.post(baseUrl, payload, {
        headers: {
            Authorization: process.env.ONE_SIGNAL_SECRET,
            'Content-Type': 'application/json',
        },
    });

    console.log(`Push notification sent successfully to user ${receiverId}`);
};

module.exports = { sendPushMessage };