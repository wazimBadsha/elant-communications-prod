const gptSocketService = require('../services/gptSocketService');

const handleSendMessage = async (socket, data) => {
    try {
        const responseMessage = await gptSocketService.processMessage(data.message);
        socket.emit("receiveMessage", {
            message: `${responseMessage || ''}`,
        });
    } catch (error) {
        console.error("Error processing message:", error);
        socket.emit("receiveMessage", {
            message: "An error occurred while processing your message.",
        });
    }
};

const handleDisconnect = (socket) => {
    // Handle disconnect logic if needed
    console.log('User disconnected');
};

module.exports = {
    handleSendMessage,
    handleDisconnect,
};