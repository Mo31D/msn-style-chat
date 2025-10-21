const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e7 }); // allow larger messages for images

app.use(express.static('public'));

// Keep track of connected users: socketId -> userInfo
let users = {};

io.on('connection', (socket) => {
  console.log('connect', socket.id);

  socket.on('join', (user) => {
    // user: { name, age, country, room }
    users[socket.id] = {
      id: socket.id,
      name: user.name || 'Guest',
      age: user.age || '',
      country: user.country || '',
      room: user.room || 'chat1'
    };
    socket.join(users[socket.id].room);
    io.emit('userList', Object.values(users));
    io.to(users[socket.id].room).emit('systemMessage', { text: users[socket.id].name + ' joined ' + users[socket.id].room });
  });

  socket.on('switchRoom', ({ newRoom }) => {
    const u = users[socket.id];
    if (!u) return;
    socket.leave(u.room);
    io.to(u.room).emit('systemMessage', { text: u.name + ' left ' + u.room });
    u.room = newRoom;
    socket.join(u.room);
    io.emit('userList', Object.values(users));
    io.to(u.room).emit('systemMessage', { text: u.name + ' joined ' + u.room });
  });

  socket.on('roomMessage', ({ room, text }) => {
    const u = users[socket.id];
    if (!u) return;
    const payload = { fromId: socket.id, fromName: u.name, text, ts: Date.now() };
    io.to(room).emit('roomMessage', payload);
  });

  socket.on('privateMessage', ({ toId, text, isImage=false }) => {
    const from = users[socket.id];
    if (!from) return;
    const payload = { fromId: socket.id, fromName: from.name, text, isImage, ts: Date.now() };
    // Emit to recipient and sender (so both see it)
    socket.to(toId).emit('privateMessage', payload);
    socket.emit('privateMessage', Object.assign({}, payload, { toId })); // echo back to sender
  });

  socket.on('disconnect', () => {
    const u = users[socket.id];
    if (u) {
      io.to(u.room).emit('systemMessage', { text: u.name + ' disconnected' });
    }
    delete users[socket.id];
    io.emit('userList', Object.values(users));
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server listening on', PORT));
