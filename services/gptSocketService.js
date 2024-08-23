
const renderMessage = require('../utils/socketMain');

const processMessage = async (message) => {
    // Business logic to process the message
    const responseMessage = renderMessage(message);
    return responseMessage;
};

module.exports = {
    processMessage,
};