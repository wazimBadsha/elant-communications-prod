
const server = require('http').createServer();

const io = require("socket.io")(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
      },
    cors: {
        origin: "*",
        methods: ["*"],
        allowedHeaders: ["*"],
        credentials: true
    }
});

module.exports = { io };