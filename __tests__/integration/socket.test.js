const io = require('socket.io-client');
const server = require('../../server');
const { setupRedisAdapter, pubClient, subClient } = require('../../services/redis');
const { io: serverIo } = require('../../utils/socketMain');
const chai = require('chai');
const { expect } = chai;



describe('Socket.IO Integration Tests', function () {
    let socket;

    beforeAll((done) => {
        setupRedisAdapter(serverIo).then(() => {
            server.listen(3001, () => {
                socket = io.connect('http://localhost:3001', {
                    'reconnection delay': 0,
                    'reopen delay': 0,
                    'force new connection': true,
                });
                socket.on('connect', () => {
                    done();
                });
            });
        }).catch(done);
    });

    afterAll((done) => {
        if (socket && socket.connected) {
            socket.disconnect();
        }

        pubClient.quit(); // Add this line
        subClient.quit(); // Add this line
        server.close(done);
    });

    it('should establish connection and join user', (done) => {
        socket.emit('join', 'testUser');
        socket.on('user online', (userId) => {
            expect(userId).to.equal('testUser');
            done();
        });
    });

    it('should send and receive a message', (done) => {
        const messageData = {
            senderId: 'user1',
            receiverId: 'user2',
            message: 'Hello',
        };

        socket.emit('send message', messageData);
        socket.on('new message', (data) => {
            expect(data.message.text).to.equal('Hello');
            expect(data.message.senderId).to.equal('user1');
            expect(data.message.receiverId).to.equal('user2');
            done();
        });
    });
});