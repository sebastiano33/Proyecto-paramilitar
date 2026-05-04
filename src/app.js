const express = require('express');
const cors = require('cors');
const path = require('path');
const state = require('./store/state');
const { getDist, sumarPuntos } = require('./utils/helpers');

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// --- RUTA BASE PARA RENDER ---
app.get('/', (req, res) => {
    res.send('SafeRoute API funcionando ✓');
});

// --- ENDPOINTS API ---

app.get('/routes', (req, res) => res.json(state.transitData.routes));

app.get('/buses', (req, res) => {
    const list = Object.keys(state.buses).map(id => ({
        busId: id, routeId: state.buses[id].routeId,
        lat: state.buses[id].latitudPromedio, lon: state.buses[id].longitudPromedio,
        velocidad: Math.round(state.buses[id].velocidad)
    }));
    res.json(list);
});

app.get('/users/:uuid/stats', (req, res) => {
    const { uuid } = req.params;
    if (!state.usuarios[uuid]) {
        state.usuarios[uuid] = { nickname: `Pasajero #${Math.floor(1000 + Math.random() * 9000)}`, total_reports: 0, confirmed_reports: 0, puntos: 0 };
    }
    res.json(state.usuarios[uuid]);
});

app.get('/users/:uuid/notifications', (req, res) => {
    const { uuid } = req.params;
    const notes = state.notificaciones[uuid] || [];
    state.notificaciones[uuid] = [];
    res.json(notes);
});

const userLastReports = {}; 
app.post('/reports', (req, res) => {
    const { type, busId, stopId, userId, routeId } = req.body;
    const targetId = busId || stopId;
    const reportKey = `${userId}_${targetId}`;
    const ahora = Date.now();

    if (userLastReports[reportKey] && (ahora - userLastReports[reportKey]) < 300000) {
        return res.status(429).json({ error: "Ya reportaste esto recientemente." });
    }
    userLastReports[reportKey] = ahora;

    const id = 'rep-' + Date.now();
    state.reportes[id] = { id, type, busId, stopId, routeId, userId, timestamp: ahora, confirms: 0, denies: 0 };
    state.reaccionesReportes[id] = {};
    if (state.usuarios[userId]) {
        state.usuarios[userId].total_reports++;
        sumarPuntos(userId, null, 5);
    }
    // Nota: El socket emit debe ir en el server.js o pasar io aquí. 
    // Por ahora lo dejamos así para no romper la estructura de app.js
    res.json(state.reportes[id]);
});

app.get('/stops/safety', (req, res) => {
    const ahora = Date.now();
    const safetyData = [];
    const windowMs = 3600000;
    const allStops = {};
    state.transitData.routes.forEach(r => r.stops.forEach(s => { allStops[s.name] = { name: s.name, lat: s.lat, lng: s.lng }; }));
    Object.values(allStops).forEach(stop => {
        const relevant = Object.values(state.reportes).filter(r =>
            r.stopId === stop.name && r.type === 'unsafe_stop' && (ahora - r.timestamp) < windowMs
        );
        let score = 0;
        relevant.forEach(r => {
            const ageFactor = 1 - (ahora - r.timestamp) / windowMs;
            score += 0.25 * ageFactor * (1 + (r.confirms * 0.5));
        });
        const finalRisk = score < 0.4 ? 0 : Math.min(1, score);
        const hour = new Date().getHours();
        const isNight = (hour >= 20 || hour < 6);
        safetyData.push({ stop_id: stop.name, lat: stop.lat, lng: stop.lng, risk_level: finalRisk, critical: isNight && finalRisk >= 0.6 });
    });
    res.json(safetyData);
});

app.get('/stops/waiting', (req, res) => {
    const list = Object.keys(state.waitingAtStop).map(id => ({
        stop_id: id,
        count: Object.keys(state.waitingAtStop[id]).length
    }));
    res.json(list);
});

app.get('/anuncios', (req, res) => {
    const { lat, lon } = req.query;
    const ahora = Date.now();
    state.anuncios.forEach(ad => { if (ad.destacado && ad.expiraEn < ahora) ad.destacado = false; });
    let filtered = state.anuncios;
    if (lat && lon) {
        const zona = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
        filtered = state.anuncios.filter(ad => ad.zona === zona);
    }
    res.json([...filtered].sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0)));
});

// Admin endpoints (API Key required in a real app, simplified here)
const { ADMIN_API_KEY } = require('./config/env');
const apiKeyMiddleware = (req, res, next) => {
    const key = req.header('X-API-Key');
    if (!key || key !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
};

app.get('/admin/export/demand', apiKeyMiddleware, (req, res) => {
    const demand = state.transitData.routes.map(r => ({
        route_id: r.id,
        route_name: r.name,
        total_views_today: state.routeViews.filter(v => v.routeId === r.id).length
    }));
    res.json(demand);
});

app.post('/admin/track-view', (req, res) => {
    const { routeId } = req.body;
    if (routeId) state.routeViews.push({ routeId, timestamp: Date.now() });
    res.send();
});

// --- ESTÁTICOS AL FINAL ---
app.use(express.static(path.join(__dirname, '../../frontend-map')));

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${err.message}`);
    res.status(500).json({ error: "Error interno del servidor" });
});

module.exports = app;
