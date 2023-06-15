const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();

// Create new web server
const server = http.createServer(app);

// Create new socketio instance
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));

// listen to connection event to occur
io.on('connection', (socket) => {
    console.log('New WebSocket Connection!');

    // Listen to join event
    socket.on('join', ({username, room}, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room })

        if (error)
        {
            return callback(error)
        }

        // If the user is already added
        socket.join(user.room);

        // Send a message event to the client
        socket.emit('message', generateMessage('Admin', 'Welcome!'));

        // emit an event to everybody in a specific room
        socket.broadcast.to(user.room).emit('message', generateMessage(`${user.username} has joined!`));
        io.to(user.room).emit('roomDate', {
            room: user.room,
            users: getUsersInRoom(user.room)
        });

        callback();
    });

    // Listen to event from the client
    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();

        // Check if the message is profane
        if (filter.isProfane(message))
        {
            return callback('Profanity is not allowed!');
        }

        // emit the event to every single connection available
        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();
    });

    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps/?q=${coords.latitude},${coords.longitude}`));
        callback();
    })

    // Listen to disconnect event from client
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user)
        {
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`));
            io.to(user.room).emit('roomDate', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
});


server.listen(port, () => {
    console.log(`Server is up on port ${port}!`);
});