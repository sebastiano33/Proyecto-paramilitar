const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { PORT, SOCKET_OPTIONS } = require('./src/config');
const socketHandler = require('./src/sockets/socketHandler');

const server = http.createServer(app);

// Inicializar Socket.io con el manejador profesional
const io = new Server(server, SOCKET_OPTIONS);
socketHandler(io);

server.listen(PORT, () => {
    console.log(`[Server] SafeRoute Uber-Style API corriendo en puerto ${PORT}`);
    console.log(`[Server] Tiempo Real: Activado (Socket.io)`);
});
