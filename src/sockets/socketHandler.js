const BusService = require('../services/BusService');
const TransitService = require('../services/TransitService');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] Cliente conectado: ${socket.id}`);

        // Evento: Actualización de ubicación de bus (de conductor o simulador)
        socket.on('bus_location_update', (data) => {
            const { busId, lat, lon } = data;
            const updatedBus = BusService.updateLocation(busId, { lat, lon });
            
            // Emitir a todos los pasajeros interesados
            io.emit('bus_update', updatedBus);
        });

        // Evento: Usuario esperando en parada
        socket.on('user_waiting', (data) => {
            const { stopName } = data;
            const update = TransitService.registerWaiting(stopName);
            
            // Notificar a todos sobre la actualización de la parada
            io.emit('stop_updated', update);
        });

        // Evento: Viaje compartido
        socket.on('trip_shared', (data) => {
            console.log(`[Socket] Viaje compartido: ${data.token}`);
            // Podría usarse para rooms específicos en el futuro
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Cliente desconectado: ${socket.id}`);
        });
    });
};

module.exports = socketHandler;
