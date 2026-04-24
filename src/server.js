const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const config = require('./config/env');
const socketHandler = require('./sockets/socketHandler');
const state = require('./store/state');

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Inicializar Sockets
socketHandler(io);

// Inicialización de datos (Mock de buses basado en tránsito)
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

server.listen(config.PORT, () => {
    console.log(`[SERVER] SafeRoute corriendo en puerto ${config.PORT}`);
    console.log(`[INIT] Estado global inicializado con ${state.transitData.routes.length} rutas.`);
});
