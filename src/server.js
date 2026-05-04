const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const socketHandler = require('./sockets/socketHandler');
const state = require('./store/state');

const server = http.createServer(app);
const io = socketIo(server, { 
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"]
});

// Inicializar Sockets
socketHandler(io);

// Inicialización de buses basado en tránsito
if (state.transitData && state.transitData.routes) {
    state.transitData.routes.forEach(route => {
        route.stops.forEach((stop, index) => {
            const busId = `BUS-${route.id}-${index + 1}`;
            if (!state.buses[busId]) {
                state.buses[busId] = {
                    routeId: route.id,
                    latitudPromedio: stop.lat,
                    longitudPromedio: stop.lng,
                    velocidad: 0,
                    ultimoEnvio: Date.now()
                };
            }
        });
    });
}

const PORT = process.env.PORT || config.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SERVER] SafeRoute corriendo en puerto ${PORT}`);
});
