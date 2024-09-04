const io = require('socket.io-client');
const { setupRedisAdapter } = require('../../services/redis');
const { io: serverIo } = require('../../utils/socketMain');
const server = require('../../server');

describe('Socket.IO E2E Tests', () => {
    let socket;

    beforeAll(async () => {
        await setupRedisAdapter(serverIo);
        server.listen(3001); // Start the server for E2E testing
    });

    afterAll((done) => {
        serverIo.close();
        done();
    });

    beforeEach((done) => {
        socket = io.connect('http://localhost:3001', {
            'reconnection delay': 0,
            'reopen delay': 0,
            'force new connection': true,
        });
        socket.on('connect', () => {
            done();
        });
    });

    afterEach((done) => {
        if (socket.connected) {
            socket.disconnect();
        }
        done();
    });

    test('User should be able to join and emit user online', (done) => {
        socket.emit('join', 'user1');
        socket.on('user online', (userId) => {
            expect(userId).toBe('user1');
            done();
        });
    });

    test('User should be able to send and receive a message', (done) => {
        const message = { senderId: 'user1', receiverId: 'user2', message: 'Hello World' };

        socket.emit('send message', message);
        socket.on('new message', (data) => {
            expect(data.message.text).toBe('Hello World');
            expect(data.message.senderId).toBe('user1');
            expect(data.message.receiverId).toBe('user2');
            done();
        });
    });
});