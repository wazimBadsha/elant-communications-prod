// Import the redis module
const redis = require('redis');

// Create a Redis client
const client = redis.createClient();

// Check if there's an error while connecting to Redis
client.on('error', function (err) {
    console.log('Redis error: ' + err);
});

// Set a key-value pair in Redis
client.set('name', 'John Doe', function (err, reply) {
    if (err) {
        console.error('Error setting value:', err);
    } else {
        console.log('Set value:', reply);

        // Get the value for a key from Redis
        client.get('name', function (err, reply) {
            if (err) {
                console.error('Error getting value:', err);
            } else {
                console.log('Get value:', reply);

                // Close the Redis connection when done
                client.quit();
            }
        });
    }
});
