const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../client/dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createRoom', ({ maxTickets }, callback) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            creatorId: socket.id,
            maxTickets: parseInt(maxTickets),
            assignedTickets: {}, // socketId -> ticketNumber
            availableTickets: Array.from({ length: parseInt(maxTickets) }, (_, i) => i + 1),
            winners: []
        };
        socket.join(roomCode);
        callback({ roomCode });
    });

    socket.on('joinRoom', ({ roomCode }, callback) => {
        const room = rooms[roomCode];
        if (!room) {
            return callback({ error: 'Комната не найдена' });
        }

        let ticketNumber = room.assignedTickets[socket.id];

        if (!ticketNumber) {
            if (room.availableTickets.length === 0) {
                return callback({ error: 'Билеты закончились' });
            }
            const randomIndex = Math.floor(Math.random() * room.availableTickets.length);
            ticketNumber = room.availableTickets.splice(randomIndex, 1)[0];
            room.assignedTickets[socket.id] = ticketNumber;
        }

        socket.join(roomCode);
        callback({ ticketNumber });

        // Notify creator about new participant
        io.to(roomCode).emit('updateParticipants', {
            count: Object.keys(room.assignedTickets).length
        });
    });

    socket.on('spin', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.creatorId !== socket.id) return;

        const allPossible = Array.from({ length: room.maxTickets }, (_, i) => i + 1);
        const remainingPossible = allPossible.filter(num => !room.winners.includes(num));

        if (remainingPossible.length === 0) {
            socket.emit('error', 'Все билеты уже разыграны');
            return;
        }

        const winner = remainingPossible[Math.floor(Math.random() * remainingPossible.length)];
        room.winners.push(winner);

        io.to(roomCode).emit('winnerResult', {
            winner,
            allWinners: room.winners
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Handle SPA routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
