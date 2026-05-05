const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');

const server = http.createServer(app);

// Configuración de Socket.io
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
    console.log('[Socket] Cliente conectado');
    
    socket.on('disconnect', () => {
        console.log('[Socket] Cliente desconectado');
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`[Server] SafeRoute API Profesional corriendo en puerto ${PORT}`);
    console.log(`[Server] Modo: Modular / Limpio`);
});
