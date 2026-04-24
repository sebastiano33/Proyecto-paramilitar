const state = require('../store/state');
const { sumarPuntos } = require('../utils/helpers');

module.exports = (io) => {
    io.on('connection', (socket) => {
        try {
            console.log(`[SOCKET] Usuario conectado: ${socket.id}`);
            state.clienteControl[socket.id] = { ultimoEnvio: 0 };

            socket.emit('estado_inicial', {
                buses: Object.keys(state.buses).map(id => ({ 
                    busId: id, 
                    lat: state.buses[id].latitudPromedio, 
                    lon: state.buses[id].longitudPromedio 
                })),
                anuncios: state.anuncios
            });
        } catch (err) {
            console.error('[SOCKET ERROR] Fallo en conexión inicial:', err);
        }

        socket.on('ubicacion', (data) => {
            try {
                const { busId, latitud, longitud, userId } = data;
                const ahora = Date.now();
                const control = state.clienteControl[socket.id];
                if (!control || ahora - control.ultimoEnvio < 2000) return;

                control.ultimoEnvio = ahora;
                if (state.buses[busId]) {
                    state.buses[busId].latitudPromedio = latitud;
                    state.buses[busId].longitudPromedio = longitud;
                    state.buses[busId].ultimoEnvio = ahora;
                    if (userId) sumarPuntos(userId, socket.id, 1, io, latitud, longitud);
                    io.emit('bus-update', { busId, lat: latitud, lon: longitud, velocidad: 30 });
                }
            } catch (e) {
                console.error('[SOCKET ERROR] Error en evento ubicacion:', e);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[SOCKET] Usuario desconectado: ${socket.id}`);
            delete state.clienteControl[socket.id];
        });
    });
};
