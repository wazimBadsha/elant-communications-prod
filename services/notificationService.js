// notificationService.js

const mongoose = require("mongoose");
const { Expo } = require('expo-server-sdk');
const userModel = require("../models/userModel");
const NotificationHistory = require("../models/notificationHistoryModel");

// Initialize Expo SDK
const expo = new Expo();


// Send a push notification to a single recipient
async function sendPushNotification(
    pushToken,
    title,
    body,
    recipientUserId,
    typeId,
    notificationType,
    data
) {
    // Check if the push token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        return;
    }

    // Make payload
    const now = new Date();
    const notiData = {
        type_id: typeId,
        type: notificationType,
        data: data,
    };

    // Create a new NotificationHistory document
    const notificationHistory = new NotificationHistory({
        _id: new mongoose.Types.ObjectId(),
        createdAt: now,
        updatedAt: now,
        title: title,
        description: body,
        typeId: typeId,
        type: notificationType,
        payloadData: notiData,
        parentType: "ELANCE", // Replace with your constant
        receiversList: [recipientUserId],
        read: false,
        isCommon: false,
    });

    try {
        // Save notification history
        await notificationHistory.save();

        // Send push notification
        const message = {
            to: pushToken,
            sound: "default",
            title: title,
            body: body,
            data: notiData,
        };

        const ticket = await expo.sendPushNotificationsAsync([message]);
        console.log("Push notification sent successfully:", ticket);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }
}

// Send push notifications to multiple recipients
async function sendBulkPushNotification(
    pushTokens,
    title,
    body,
    recipientUserIds,
    typeId,
    notificationType,
    data
) {
    const now = new Date();
    const notiData = {
        type_id: typeId,
        type: notificationType,
        data: data,
    };

    // Create a new NotificationHistory document
    const notificationHistory = new NotificationHistory({
        _id: new mongoose.Types.ObjectId(),
        createdAt: now,
        updatedAt: now,
        title: title,
        description: body,
        typeId: typeId,
        type: notificationType,
        payloadData: notiData,
        parentType: "ELANCE", // Replace with your constant
        receiversList: recipientUserIds,
        read: false,
        isCommon: false,
    });

    try {
        // Save notification history
        await notificationHistory.save();

        // Prepare messages for each valid push token
        const messages = [];
        for (const pushToken of pushTokens) {
            if (Expo.isExpoPushToken(pushToken)) {
                messages.push({
                    to: pushToken,
                    sound: "default",
                    title: title,
                    body: body,
                    data: notiData,
                });
            }
        }

        if (messages.length > 0) {
            const tickets = await expo.sendPushNotificationsAsync(messages);
            console.log("Bulk push notifications sent successfully:", tickets);
        } else {
            console.error("No valid push tokens provided");
        }
    } catch (error) {
        console.error("Error sending bulk push notifications:", error);
    }
}

async function sendExpoPushMessage(
    receiverId,
    msgContent,
    senderName,
    typeId,
    Type
) {
    // Fetch user info from users collection
    const userInfo = await userModel.findOne(
        { _id: new mongoose.Types.ObjectId(receiverId) },
        { _id: 1, name: 1, avatar_id: 1, notification_id: 1 }
    );
    if (!userInfo) {
        return { status: "error", message: "User not found", data: [] };
    }

    const pushToken = userInfo.notification_id;

    // Check if the push token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
        console.error(`Push token ${pushToken} is not a valid Expo push token`);
        return;
    }

    // Make payload
    const notiData = {
        type_id: typeId,
        type: Type,
        data: data,
    };

    try {
        // Send push notification
        const message = {
            to: pushToken,
            sound: "default",
            title: senderName,
            body: msgContent,
            data: notiData,
        };

        const ticket = await expo.sendPushNotificationsAsync([message]);
        console.log("Push notification sent successfully:", ticket);
    } catch (error) {
        console.error("Error sending push notification:", error);
    }

    console.log(`Push notification sent successfully to user ${receiverId}`);
}

module.exports = {
    sendPushNotification,
    sendBulkPushNotification,
    sendExpoPushMessage,
};
