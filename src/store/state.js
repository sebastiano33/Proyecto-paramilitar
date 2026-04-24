const fs = require('fs');
const path = require('path');

// Cargar datos estáticos de tránsito con fail-safe
let transitData = { routes: [] };
try {
    const dataPath = path.join(__dirname, '../../transit_data.json');
    if (fs.existsSync(dataPath)) {
        transitData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        console.log("[INIT] Transit data cargado correctamente ✓");
    } else {
        console.warn("[WARN] transit_data.json no encontrado, usando datos vacíos.");
    }
} catch (err) {
    console.error("[ERROR] Error cargando transit_data.json:", err.message);
}

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
