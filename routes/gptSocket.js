// const { io } = require('../utils/socketMain');
// const gptSocketController = require('../controllers/gptSocketController');

// io.of('/gpt').on('connection', (socket) => {
//     socket.on("sendMessage", (data) => gptSocketController.handleSendMessage(socket, data));
//     socket.on("disconnect", () => gptSocketController.handleDisconnect(socket));
// });

const {io}  = require('../utils/socketMain')



io.of('/gpt').on('connection', (socket) => {

    socket.on("sendMessage", async (data) => {
      //  let reponseMessage = renderMessage(data.message)
        socket.emit("receiveMessage", {
            message: `${data.message || ''}`,
        });
    });
    
    socket.on("disconnect", () => {
        
    });
});


