const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend-map')));

// --- CARGAR DATOS DE TRANSPORTE (JSON) ---
const transitData = JSON.parse(fs.readFileSync(path.join(__dirname, 'transit_data.json'), 'utf8'));

// --- ESTADO DEL SISTEMA EN MEMORIA ---
const buses = {}; 
const clienteControl = {}; 
const reportes = {}; 
const reaccionesReportes = {}; 
const usuarios = {}; 
const boarding = {}; 
const notificaciones = {}; 
const chatBuses = {}; 
const anuncios = []; 
const comentarios = []; 
const waitingAtStop = {}; // { stopId: { userId: expiresAt } }
const sharedTrips = {}; // { token: { userId, busId, routeId, destinationStopId, createdAt, expiresAt, isActive } }
const routeViews = []; // { routeId, timestamp }
const crypto = require('crypto');
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "clave_super_secreta";

// Inicializar buses desde el JSON
transitData.routes.forEach(route => {
    route.stops.forEach((stop, index) => {
        const busId = `BUS-${route.id}-${index + 1}`; // Simulación inicial
        if (!buses[busId]) {
            buses[busId] = {
                routeId: route.id,
                latitudPromedio: stop.lat,
                longitudPromedio: stop.lng,
                velocidad: 0,
                ultimoEnvio: Date.now(),
                ubicaciones: []
            };
        }
    });
});

// --- HELPERS ---
function sumarPuntos(userId, socketId, cantidad, nombre = null, lat = null, lon = null) {
    if (!usuarios[userId]) {
        usuarios[userId] = {
            nickname: nombre || `Pasajero #${Math.floor(1000 + Math.random() * 9000)}`,
            total_reports: 0,
            confirmed_reports: 0,
            puntos: 0,
            lat: lat,
            lon: lon
        };
    }
    usuarios[userId].puntos += cantidad;
    if (lat) usuarios[userId].lat = lat;
    if (lon) usuarios[userId].lon = lon;
    
    io.to(socketId).emit('update-recompensas', { puntos: usuarios[userId].puntos });
}

// --- LIMPIEZA AUTOMÁTICA ---
setInterval(() => {
    const ahora = Date.now();
    // Reportes (15 min)
    for (const id in reportes) {
        if (ahora - reportes[id].timestamp > 15 * 60 * 1000) {
            delete reportes[id];
            delete reaccionesReportes[id];
            io.emit('report-expired', { id });
        }
    }
    // Espera en paradas (30 min)
    for (const stopId in waitingAtStop) {
        for (const userId in waitingAtStop[stopId]) {
            if (ahora > waitingAtStop[stopId][userId]) {
                delete waitingAtStop[stopId][userId];
                io.emit('waiting_updated', { stopId, count: Object.keys(waitingAtStop[stopId]).length });
            }
        }
    }
    // Viajes compartidos (2 horas)
    for (const token in sharedTrips) {
        if (ahora > sharedTrips[token].expiresAt) {
            delete sharedTrips[token];
        }
    }
}, 60000);

// --- ENDPOINTS ---
app.get('/routes', (req, res) => res.json(transitData.routes));

app.get('/buses', (req, res) => {
    const list = Object.keys(buses).map(id => ({
        busId: id, routeId: buses[id].routeId,
        lat: buses[id].latitudPromedio, lon: buses[id].longitudPromedio,
        velocidad: Math.round(buses[id].velocidad)
    }));
    res.json(list);
});

app.get('/users/:uuid/stats', (req, res) => {
    const { uuid } = req.params;
    if (!usuarios[uuid]) {
        usuarios[uuid] = { nickname: `Pasajero #${Math.floor(1000 + Math.random() * 9000)}`, total_reports: 0, confirmed_reports: 0, puntos: 0 };
    }
    res.json(usuarios[uuid]);
});

app.get('/users/:uuid/notifications', (req, res) => {
    const { uuid } = req.params;
    const notes = notificaciones[uuid] || [];
    notificaciones[uuid] = [];
    res.json(notes);
});

const userLastReports = {}; // { userId_targetId: timestamp }

app.post('/reports', (req, res) => {
    const { type, busId, stopId, userId, routeId } = req.body;
    const targetId = busId || stopId;
    const reportKey = `${userId}_${targetId}`;
    const ahora = Date.now();

    // Spam Protection: 1 reporte por destino cada 5 minutos
    if (userLastReports[reportKey] && (ahora - userLastReports[reportKey]) < 300000) {
        return res.status(429).json({ error: "Ya reportaste esto recientemente. Intenta de nuevo en unos minutos." });
    }
    userLastReports[reportKey] = ahora;

    const id = 'rep-' + Date.now();
    reportes[id] = { id, type, busId, stopId, routeId, userId, timestamp: ahora, confirms: 0, denies: 0 };
    reaccionesReportes[id] = {};
    if (usuarios[userId]) {
        usuarios[userId].total_reports++;
        sumarPuntos(userId, null, 5); // Puntos por reportar
    }
    io.emit('new-report', reportes[id]);
    res.json(reportes[id]);
});

app.post('/reports/:id/react', (req, res) => {
    const { id } = req.params;
    const { userId, reaction } = req.body;
    if (!reportes[id] || reaccionesReportes[id][userId]) return res.status(400).send();
    reaccionesReportes[id][userId] = reaction;
    const creatorId = reportes[id].userId;
    if (reaction === 'confirm') {
        reportes[id].confirms++;
        if (usuarios[creatorId]) usuarios[creatorId].confirmed_reports++;
        if (!notificaciones[creatorId]) notificaciones[creatorId] = [];
        notificaciones[creatorId].push(`✓ ¡Alguien confirmó tu reporte en ${reportes[id].busId || reportes[id].stopId}!`);
    } else {
        reportes[id].denies++;
    }
    io.emit('report-update', { id, confirms: reportes[id].confirms, denies: reportes[id].denies });
    res.json(reportes[id]);
});

app.get('/stops/safety', (req, res) => {
    const ahora = Date.now();
    const safetyData = [];
    const windowMs = 3600000;
    const allStops = {};
    transitData.routes.forEach(r => r.stops.forEach(s => { allStops[s.name] = { name: s.name, lat: s.lat, lng: s.lng }; }));
    Object.values(allStops).forEach(stop => {
        // Solo contar reportes del tipo 'unsafe_stop'
        const relevant = Object.values(reportes).filter(r => 
            r.stopId === stop.name && r.type === 'unsafe_stop' && (ahora - r.timestamp) < windowMs
        );
        
        let score = 0;
        relevant.forEach(r => {
            const ageFactor = 1 - (ahora - r.timestamp) / windowMs;
            const validationFactor = 1 + (r.confirms * 0.5); // Confirmaciones aumentan mucho el impacto
            score += 0.25 * ageFactor * validationFactor;
        });

        // REGLA: Mínimo impacto para visualización (~2-3 reportes o 1 muy confirmado)
        const finalRisk = score < 0.4 ? 0 : Math.min(1, score);
        
        // Detección de zona crítica nocturna
        const hour = new Date().getHours();
        const isNight = (hour >= 20 || hour < 6);
        const critical = isNight && finalRisk >= 0.6 && relevant.length >= 2;

        safetyData.push({ stop_id: stop.name, lat: stop.lat, lng: stop.lng, risk_level: finalRisk, critical });
    });
    res.json(safetyData);
});

app.get('/stops/waiting', (req, res) => {
    const list = Object.keys(waitingAtStop).map(id => ({
        stop_id: id,
        count: Object.keys(waitingAtStop[id]).length
    }));
    res.json(list);
});

app.post('/stops/:id/wait', (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    if (!id || !userId) return res.status(400).json({ error: "Missing data" });

    // Limpiar si el usuario ya estaba en otra parada
    for (const sId in waitingAtStop) {
        if (waitingAtStop[sId][userId]) delete waitingAtStop[sId][userId];
    }

    if (!waitingAtStop[id]) waitingAtStop[id] = {};
    waitingAtStop[id][userId] = Date.now() + 30 * 60 * 1000;

    io.emit('waiting_updated', { stopId: id, count: Object.keys(waitingAtStop[id]).length });
    res.json({ success: true, count: Object.keys(waitingAtStop[id]).length });
});

app.delete('/stops/:id/wait', (req, res) => {
    const { id } = req.params;
    const { userId } = req.body;
    if (waitingAtStop[id] && waitingAtStop[id][userId]) {
        delete waitingAtStop[id][userId];
        io.emit('waiting_updated', { stopId: id, count: Object.keys(waitingAtStop[id]).length });
    }
    res.json({ success: true });
});

app.get('/anuncios', (req, res) => {
    const { lat, lon } = req.query;
    const ahora = Date.now();
    // Limpieza de destacados expirados
    anuncios.forEach(ad => { if (ad.destacado && ad.expiraEn < ahora) ad.destacado = false; });
    let filtered = anuncios;
    if (lat && lon) {
        const zona = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
        filtered = anuncios.filter(ad => ad.zona === zona);
    }
    res.json([...filtered].sort((a,b) => (b.destacado?1:0) - (a.destacado?1:0)));
});

app.post('/publicar-anuncio', (req, res) => {
    const { titulo, descripcion, latitud, longitud, userId } = req.body;
    const zona = `${Number(latitud).toFixed(2)}_${Number(longitud).toFixed(2)}`;
    const nuevo = { id: `ad-${Date.now()}`, userId, titulo, descripcion, lat: latitud, lon: longitud, zona, destacado: false, timestamp: Date.now(), vistas: 0, clicks: 0 };
    anuncios.push(nuevo);
    sumarPuntos(userId, null, 10);
    io.emit('nuevo-anuncio', nuevo); // Simplificado para la restauración
    res.json(nuevo);
});

app.get('/ranking', (req, res) => {
    const { lat, lon } = req.query;
    let users = Object.values(usuarios);
    if (lat && lon) {
        const zona = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
        // Filtrado por zona si se desea, o global para el top
    }
    const ranking = users.sort((a,b) => b.puntos - a.puntos).slice(0, 10).map(u => ({ nombre: u.nickname, puntos: u.puntos }));
    res.json(ranking);
});

// --- SISTEMA DE FAVORITOS ---
const favoritos = {}; // { userId: [ { id, routeId, name, origin, dest } ] }

app.get('/favoritos/:userId', (req, res) => {
    res.json(favoritos[req.params.userId] || []);
});

app.post('/favoritos', (req, res) => {
    const { userId, routeId, name, origin, dest } = req.body;
    if (!favoritos[userId]) favoritos[userId] = [];
    const nuevo = { id: 'fav-' + Date.now(), routeId, name, origin, dest };
    favoritos[userId].push(nuevo);
    res.json(nuevo);
});

app.delete('/favoritos/:userId/:favId', (req, res) => {
    const { userId, favId } = req.params;
    if (favoritos[userId]) {
        favoritos[userId] = favoritos[userId].filter(f => f.id !== favId);
    }
    res.json({ success: true });
});

// --- TIENDA DE RECOMPENSAS ---
const catalogoRecompensas = [
    { id: 'destacado', nombre: 'Anuncio Destacado', costo: 10, icon: 'star' },
    { id: 'premium', nombre: 'Publicidad Premium', costo: 20, icon: 'shield-check' }
];

app.get('/recompensas', (req, res) => {
    const { userId } = req.query;
    res.json({ puntos: (usuarios[userId] && usuarios[userId].puntos) || 0, catalogo: catalogoRecompensas });
});

app.post('/canjear-recompensa', (req, res) => {
    const { userId, rewardId } = req.body;
    if (!usuarios[userId]) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const recompensa = catalogoRecompensas.find(r => r.id === rewardId);
    if (!recompensa) return res.status(404).json({ error: 'Recompensa no válida' });
    
    if (usuarios[userId].puntos < recompensa.costo) {
        return res.status(400).json({ error: 'Puntos insuficientes' });
    }
    
    usuarios[userId].puntos -= recompensa.costo;
    // Lógica adicional para 'destacado'
    if (rewardId === 'destacado') {
        const lastAd = [...anuncios].reverse().find(a => a.userId === userId);
        if (lastAd) {
            lastAd.destacado = true;
            lastAd.expiraEn = Date.now() + 300000; // 5 min
            io.emit('anuncio-destacado', { id: lastAd.id });
        }
    }
    
    res.json({ success: true, puntos: usuarios[userId].puntos });
});

// --- ANALÍTICA DE ANUNCIOS ---
app.post('/anuncio-visto', (req, res) => {
    const { id } = req.body;
    const ad = anuncios.find(a => a.id === id);
    if (ad) ad.vistas++;
    res.send();
});

app.post('/anuncio-click', (req, res) => {
    const { id } = req.body;
    const ad = anuncios.find(a => a.id === id);
    if (ad) ad.clicks++;
    res.send();
});

// --- MODO VIAJE Y RECOMENDACIÓN ---
app.post('/recomendar-ruta', (req, res) => {
    const { userLat, userLon, destLat, destLon } = req.body;
    const recs = [];
    
    transitData.routes.forEach(route => {
        // Encontrar paradas cercanas al origen y destino (simulado)
        const dOrigin = Math.min(...route.stops.map(s => getDist(userLat, userLon, s.lat, s.lng)));
        const dDest = Math.min(...route.stops.map(s => getDist(destLat, destLon, s.lat, s.lng)));
        
        if (dOrigin < 1000 && dDest < 1000) {
            recs.push({
                rutaId: route.id,
                nombre: route.name,
                paradaSubida: "Parada Cercana",
                paradaBajada: "Parada Destino",
                tiempoTotal: 25, // Mock
                etaBus: 5
            });
        }
    });
    res.json(recs);
});

function getDist(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180, dl = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- BOARDING Y CHAT ---
app.post('/buses/:busId/board', (req, res) => {
    const { busId } = req.params;
    const { userId } = req.body;
    if (!boarding[busId]) boarding[busId] = new Set();
    boarding[busId].add(userId);
    io.emit('boarding-update', { busId, count: boarding[busId].size });
    res.json({ success: true });
});

app.delete('/buses/:busId/board', (req, res) => {
    const { busId } = req.params;
    const { userId } = req.body;
    if (boarding[busId]) {
        boarding[busId].delete(userId);
        io.emit('boarding-update', { busId, count: boarding[busId].size });
    }
    res.json({ success: true });
});

app.post('/buses/:busId/chat', (req, res) => {
    const { busId } = req.params;
    const { userId, message, nickname } = req.body;
    const msg = { userId, nickname, message, timestamp: Date.now() };
    io.emit('bus-chat-msg', { busId, msg });
    res.json({ success: true });
});

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);
    clienteControl[socket.id] = { ultimoEnvio: 0 };

    socket.emit('estado_inicial', {
        buses: Object.keys(buses).map(id => ({ busId: id, lat: buses[id].latitudPromedio, lon: buses[id].longitudPromedio }))
    });

    socket.on('ubicacion', (data) => {
        const { busId, latitud, longitud, userId } = data;
        const ahora = Date.now();
        const control = clienteControl[socket.id];
        if (ahora - control.ultimoEnvio < 2000) return;

        control.ultimoEnvio = ahora;
        if (buses[busId]) {
            buses[busId].latitudPromedio = latitud;
            buses[busId].longitudPromedio = longitud;
            buses[busId].ultimoEnvio = ahora;
            if (userId) sumarPuntos(userId, socket.id, 1, null, latitud, longitud);
            io.emit('bus-update', { busId, lat: latitud, lon: longitud, velocidad: 30 });
        }
    });

    socket.on('disconnect', () => delete clienteControl[socket.id]);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SafeRoute Backend en puerto ${PORT}`));

// --- ADMIN & EXPORT SYSTEM ---
const apiKeyMiddleware = (req, res, next) => {
    const key = req.header('X-API-Key');
    if (!key || key !== ADMIN_API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
};

const jsonToCsv = (data) => {
    if (!data || data.length === 0) return "";
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    data.forEach(row => {
        csvRows.push(headers.map(header => JSON.stringify(row[header] || "")).join(','));
    });
    return csvRows.join('\n');
};

const handleExport = (req, res, data) => {
    const format = req.query.format || 'json';
    if (format === 'csv') {
        res.header('Content-Type', 'text/csv');
        res.attachment('reporte.csv');
        return res.send(jsonToCsv(data));
    }
    res.json(data);
};

app.get('/admin/export', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-map/admin_export.html'));
});

app.get('/admin/export/demand', apiKeyMiddleware, (req, res) => {
    // Agrupar vistas por ruta
    const demand = transitData.routes.map(r => {
        const views = routeViews.filter(v => v.routeId === r.id);
        const hours = {};
        views.forEach(v => {
            const h = new Date(v.timestamp).getHours();
            hours[h] = (hours[h] || 0) + 1;
        });
        const peak = Object.keys(hours).reduce((a, b) => hours[a] > hours[b] ? a : b, "00");
        return {
            route_id: r.id,
            route_name: r.name,
            total_views_today: views.length,
            peak_hour: `${peak}:00`,
            avg_viewers_per_hour: (views.length / 24).toFixed(2)
        };
    }).sort((a, b) => b.total_views_today - a.total_views_today);
    
    handleExport(req, res, demand);
});

app.get('/admin/export/problems', apiKeyMiddleware, (req, res) => {
    const stops = {};
    transitData.routes.forEach(r => r.stops.forEach(s => {
        stops[s.name] = { id: s.name, route_id: r.id };
    }));

    const reportData = Object.keys(stops).map(name => {
        const relevant = Object.values(reportes).filter(r => r.stopId === name);
        const types = {};
        relevant.forEach(r => types[r.type] = (types[r.type] || 0) + 1);
        const mostCommon = Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b, "none");
        
        return {
            stop_id: name,
            stop_name: name,
            route_id: stops[name].route_id,
            total_reports_week: relevant.length,
            most_common_type: mostCommon,
            insecurity_reports_count: relevant.filter(r => r.type === 'unsafe_stop').length
        };
    });

    handleExport(req, res, reportData);
});

app.get('/admin/export/activity', apiKeyMiddleware, (req, res) => {
    const activity = [];
    for (let i = 0; i < 24; i++) {
        const hStr = i.toString().padStart(2, '0');
        const start = hStr + ":00";
        const end = (i+1).toString().padStart(2, '0') + ":00";
        
        // Simular datos de actividad basados en reportes y vistas
        const users = new Set(Object.values(reportes).map(r => r.userId));
        const hourReports = Object.values(reportes).filter(r => new Date(r.timestamp).getHours() === i);

        activity.push({
            hour: `${start}-${end}`,
            active_users: users.size,
            reports_count: hourReports.length,
            busiest_route: "T101" // Mock
        });
    }
    handleExport(req, res, activity);
});

// Endpoint para trackear vistas (llamar desde el frontend)
app.post('/admin/track-view', (req, res) => {
    const { routeId } = req.body;
    if (routeId) routeViews.push({ routeId, timestamp: Date.now() });
    res.send();
});
app.post('/trips/share', (req, res) => {
    const { userId, busId, routeId, destinationStopId } = req.body;
    if (!userId || !busId || !routeId || !destinationStopId) {
        return res.status(400).json({ error: "Faltan datos del viaje" });
    }
    const token = crypto.randomUUID();
    const ahora = Date.now();
    sharedTrips[token] = {
        userId, busId, routeId, destinationStopId,
        createdAt: ahora,
        expiresAt: ahora + (2 * 60 * 60 * 1000), // 2 horas
        isActive: true
    };
    res.json({ token, shareUrl: `${req.protocol}://${req.get('host')}/viaje/${token}` });
});

app.get('/trips/:token', (req, res) => {
    const { token } = req.params;
    const trip = sharedTrips[token];
    if (!trip || !trip.isActive || Date.now() > trip.expiresAt) {
        return res.status(404).json({ expired: true });
    }
    
    // Buscar datos de la parada destino
    let destination = null;
    transitData.routes.forEach(r => {
        if (r.id === trip.routeId) {
            destination = r.stops.find(s => s.name === trip.destinationStopId);
        }
    });

    const user = usuarios[trip.userId] || { nickname: "Viajero" };

    res.json({
        expired: false,
        busId: trip.busId,
        routeId: trip.routeId,
        destination: destination,
        nickname: user.nickname
    });
});

app.delete('/trips/:token', (req, res) => {
    const { token } = req.params;
    if (sharedTrips[token]) {
        sharedTrips[token].isActive = false;
        delete sharedTrips[token];
    }
    res.json({ success: true });
});

app.get('/viaje/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-map/shared_trip.html'));
});
