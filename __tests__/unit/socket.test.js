const io = require('socket.io-client');
const { io: serverIo } = require('../../utils/socketMain');
const { setupRedisAdapter } = require('../../services/redis');

let socket;

beforeAll(async () => {
    await setupRedisAdapter(serverIo);
    serverIo.listen(3001); // Start server on test port
});

afterAll(() => {
    serverIo.close();
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

test('should establish connection', (done) => {
    socket.emit('join', 'testUser');
    socket.on('user online', (userId) => {
        expect(userId).toBe('testUser');
        done();
    });
});

test('should send and receive a message', (done) => {
    const messageData = {
        senderId: 'user1',
        receiverId: 'user2',
        message: 'Hello',
        image: null,
        parentID: null,
    };

    socket.emit('send message', messageData);
    socket.on('new message', (data) => {
        expect(data.message.text).toBe(messageData.message);
        expect(data.message.senderId).toBe(messageData.senderId);
        expect(data.message.receiverId).toBe(messageData.receiverId);
        done();
    });
});