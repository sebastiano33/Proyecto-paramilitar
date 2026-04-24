const fs = require('fs');
const path = require('path');

// Cargar datos estáticos de tránsito
const transitData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../transit_data.json'), 'utf8'));

module.exports = {
    transitData,
    buses: {},
    clienteControl: {},
    reportes: {},
    reaccionesReportes: {},
    usuarios: {},
    boarding: {},
    notificaciones: {},
    chatBuses: {},
    anuncios: [],
    comentarios: [],
    waitingAtStop: {},
    sharedTrips: {},
    routeViews: []
};
