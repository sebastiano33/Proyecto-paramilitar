const gpsStore = require('../services/gpsStore');

const socketHandler = (io) => {
    // Middleware de Auth (Ya implementado anteriormente)

    io.on('connection', (socket) => {
        const status = socket.user ? `Identificado como ${socket.user.username}` : 'Anónimo';
        console.log(`[Socket] Cliente conectado: ${socket.id} (${status})`);

        // Unir a room privado para notificaciones de reputación
        if (socket.user) {
            socket.join(`user:${socket.user.id}`);
        }

        // 1. Suscribirse a una ruta específica
        socket.on('subscribe:route', async ({ routeId }) => {
            const room = `gps:route:${routeId}`;
            socket.join(room);

            // Enviar estado inicial de buses en esa ruta
            const activeBuses = await gpsStore.getBusesByRoute(routeId);
            socket.emit('route:buses', activeBuses);

            console.log(`[Socket] ${socket.id} unido a ${room}`);
        });

        // 2. Desuscribirse de una ruta
        socket.on('unsubscribe:route', ({ routeId }) => {
            const room = `gps:route:${routeId}`;
            socket.leave(room);
            console.log(`[Socket] ${socket.id} salió de ${room}`);
        });

        // 3. Actualización directa desde conductor (Driver role)
        socket.on('bus:update', async (data) => {
            if (!socket.user || socket.user.role !== 'driver') return;

            const updatedBus = await gpsStore.updatePosition(data.busId, {
                ...data,
                driverId: socket.user.id
            });

            // Broadcast a la room de la ruta
            io.to(`gps:route:${data.routeId}`).emit('bus:position', updatedBus);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Desconectado: ${socket.id}`);
        });
    });

    // Función global para emitir desde procesos internos (Simulador/API)
    io.emitBusPosition = (busData) => {
        io.to(`gps:route:${busData.routeId}`).emit('bus:position', busData);
    };
};

module.exports = socketHandler;
