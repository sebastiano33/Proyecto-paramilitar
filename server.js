const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { PORT, SOCKET_OPTIONS } = require('./src/config');
const connectDB = require('./src/config/db');
const socketHandler = require('./src/sockets/socketHandler');
const scheduler = require('./src/services/scheduler');

// 1. Database Connection
connectDB();

// 2. HTTP Server
const server = http.createServer(app);

// 3. Realtime Engine (Socket.io)
const io = new Server(server, SOCKET_OPTIONS);
socketHandler(io);

// 4. Initializations
scheduler.init();

// 5. Start Lifecycle
server.listen(PORT, () => {
    console.log(`\n🚀 SafeRoute Professional API`);
    console.log(`📡 Endpoint: http://localhost:${PORT}`);
    console.log(`⚡ Realtime: Active (Socket.io)\n`);
});
