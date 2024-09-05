require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const gptRoutes = require('./routes/gptRoutes');
const chatRoutes = require('./routes/chatRoutes');
const upload = require('./routes/upload');
const { io } = require('./routes/socketIO')
// const {gptio} = require('./routes/gptSocket') 
const cors = require('cors');

const app = express();

app.use(cors())

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Allow-Headers');
	next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: process.env.EXPRESS_APP_SECRET, resave: false, saveUninitialized: true }));
app.use(express.json());

app.set('view engine', 'ejs');
mongoose.connect(process.env.MONGO_URI);

console.log("Current Date: ",new Date())

app.get('/', (req, res) => {
	res.send('Hello Elance communication!');
});

app.get('/health', (req, res) => {
	res.send('Hello Elance communication health is good!');
});

app.use('/gpt', gptRoutes)
app.use('/chat', chatRoutes)
app.use('/upload', upload);


// In your server setup (e.g., server.js or app.js)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

//attach socket listners
io.attach(server );

// Export the server
module.exports = server;