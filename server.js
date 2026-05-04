const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(cookieParser());

app.use('/', require('./routes/api'));

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/baliwasan_queue', {
    serverSelectionTimeoutMS: 5000
}).then(() => {
    console.log("MongoDB Connected");
    require('./sockets/queueHandler')(io, true);
}).catch(err => {
    console.log("MongoDB connection failed. Running in ephemeral memory mode.");
    require('./sockets/queueHandler')(io, false);
});
app.get('/admin', (req, res) => {
    res.redirect('/views/admin-queue.html');
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'views', 'homepage.html'));
});

server.listen(process.env.PORT || 3000, '0.0.0.0');