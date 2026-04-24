const cors = require('cors');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.IO con configuración estable para Render
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"]
});

app.use(express.json());
app.use(cors());

// Healthcheck requerido por Render para verificar que el servidor está vivo
app.get('/', (req, res) => {
    res.send('Servidor SafeRoute funcionando correctamente — Solo WebSockets activos.');
});

// --- SISTEMA DE ALERTAS DE LLEGADA ---
const paradas = [
    { id: 'stop-uni', nombre: 'Parada Universidad', lat: 10.412, lon: -75.532 },
    { id: 'stop-centro', nombre: 'Parada Centro Histórico', lat: 10.423, lon: -75.548 },
    { id: 'stop-terminal', nombre: 'Terminal de Transportes', lat: 10.385, lon: -75.475 }
];

const estadosAlerta = {}; // Guarda { "busId_stopId": "estado" }

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Radio de la tierra en metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // en metros
}

function checkAlertas(busId, lat, lon) {
    paradas.forEach(stop => {
        const dist = calcularDistancia(lat, lon, stop.lat, stop.lon);
        let nuevoEstado = '🟢 Lejos';
        let color = 'green';

        if (dist <= 50) {
            nuevoEstado = '⚫ En parada';
            color = 'black';
        } else if (dist <= 300) {
            nuevoEstado = '🔴 Muy cerca';
            color = 'red';
        } else if (dist <= 1000) {
            nuevoEstado = '🟡 Aproximándose';
            color = 'orange';
        }

        const key = `${busId}_${stop.id}`;
        if (estadosAlerta[key] !== nuevoEstado) {
            estadosAlerta[key] = nuevoEstado;
            
            // Solo emitir si no es "Lejos" (para no saturar al inicio)
            if (nuevoEstado !== '🟢 Lejos') {
                io.emit('alerta-llegada', {
                    busId,
                    stopNombre: stop.nombre,
                    estado: nuevoEstado,
                    distancia: Math.round(dist),
                    color
                });
            }
        }
    });
}

// --- FLOTA MULTI-BUS EN MEMORIA ---
const buses = {
    bus1: { ubicaciones: [], latitudPromedio: null, longitudPromedio: null },
    bus2: { ubicaciones: [], latitudPromedio: null, longitudPromedio: null },
    bus3: { ubicaciones: [], latitudPromedio: null, longitudPromedio: null }
};

// Calcular promedio con filtro anti-outlier y emitir solo si hay cambio real
function calcularYEmitir(busId) {
    const bus = buses[busId];
    if (!bus || bus.ubicaciones.length === 0) return;

    // Paso 1: Centro geográfico preliminar
    let sumaLatPreliminar = 0;
    let sumaLonPreliminar = 0;
    for (const ubi of bus.ubicaciones) {
        sumaLatPreliminar += ubi.latitud;
        sumaLonPreliminar += ubi.longitud;
    }
    const promedioLatPreliminar = sumaLatPreliminar / bus.ubicaciones.length;
    const promedioLonPreliminar = sumaLonPreliminar / bus.ubicaciones.length;

    const UMBRAL_DISTANCIA = 0.01;
    const ubicacionesCercanas = bus.ubicaciones.filter(ubi => {
        const dLat = ubi.latitud - promedioLatPreliminar;
        const dLon = ubi.longitud - promedioLonPreliminar;
        return Math.sqrt(dLat * dLat + dLon * dLon) <= UMBRAL_DISTANCIA;
    });

    const ubicacionesFinales = ubicacionesCercanas.length > 0 ? ubicacionesCercanas : bus.ubicaciones;

    let sumaLat = 0;
    let sumaLon = 0;
    for (const ubi of ubicacionesFinales) {
        sumaLat += ubi.latitud;
        sumaLon += ubi.longitud;
    }
    const latitudPromedio = sumaLat / ubicacionesFinales.length;
    const longitudPromedio = sumaLon / ubicacionesFinales.length;

    if (bus.latitudPromedio === latitudPromedio && bus.longitudPromedio === longitudPromedio) return;

    buses[busId].latitudPromedio = latitudPromedio;
    buses[busId].longitudPromedio = longitudPromedio;

    // CHEQUEO DE ALERTAS
    checkAlertas(busId, latitudPromedio, longitudPromedio);

    io.emit('bus-update', {
        busId,
        latitudPromedio,
        longitudPromedio,
        muestras: ubicacionesFinales.length
    });
}

// --- MAPA DE CONTROL ANTI-SPAM POR SOCKET ---
// Guarda el último timestamp de emisión y última posición de cada cliente
const clienteControl = {};

// CAPA 1: Rate limiting — mínimo 2 segundos entre emisiones del mismo socket
const INTERVALO_MINIMO_MS = 2000;

// CAPA 2: Rango geográfico válido — solo acepta coordenadas de Colombia
const GEO_LIMITES = {
    latMin: -4.2,  latMax: 12.5,  // Sur a Norte de Colombia
    lonMin: -82.0, lonMax: -66.8  // Oeste a Este de Colombia
};

// CAPA 3: Desplazamiento mínimo para no procesar datos estáticos repetidos
const DESPLAZAMIENTO_MINIMO = 0.00005; // ~5 metros en grados decimales

function coordenadasValidas(lat, lon) {
    return (
        typeof lat === 'number' && typeof lon === 'number' &&
        isFinite(lat) && isFinite(lon) &&
        lat >= GEO_LIMITES.latMin && lat <= GEO_LIMITES.latMax &&
        lon >= GEO_LIMITES.lonMin && lon <= GEO_LIMITES.lonMax
    );
}

// --- SISTEMA DE PERFILES Y RECOMPENSAS EN MEMORIA ---
const perfiles = {}; // { userId: { nombre, puntos } }

// Función helper para registrar/actualizar usuario y sumar puntos
function sumarPuntos(userId, socketId, cantidad, nombre = null, lat = null, lon = null) {
    if (!perfiles[userId]) {
        perfiles[userId] = { nombre: nombre || 'Viajero Anónimo', puntos: 0, lat: lat, lon: lon };
    } else {
        if (nombre) perfiles[userId].nombre = nombre;
        if (lat) perfiles[userId].lat = lat;
        if (lon) perfiles[userId].lon = lon;
    }
    
    perfiles[userId].puntos += cantidad;
    
    // Notificar al socket específico
    if (socketId) {
        io.to(socketId).emit('update-recompensas', { puntos: perfiles[userId].puntos });
    }
}

// Catálogo de recompensas
const catalogoRecompensas = [
    { id: 'destacado', nombre: 'Anuncio Destacado', costo: 10, icon: 'star' },
    { id: 'premium', nombre: 'Publicidad Premium', costo: 20, icon: 'shield-check' }
];

// Endpoint para obtener puntos y registrar nombre
app.get('/recompensas', (req, res) => {
    const { userId, nombre } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    
    if (!perfiles[userId]) {
        perfiles[userId] = { nombre: nombre || 'Viajero Anónimo', puntos: 0 };
    } else if (nombre) {
        perfiles[userId].nombre = nombre;
    }

    res.json({ puntos: perfiles[userId].puntos, catalogo: catalogoRecompensas });
});

// Endpoint para obtener ranking local
app.get('/ranking', (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Coordenadas requeridas para ranking local' });

    // Definir la zona actual (redondeo a 2 decimales ~1.1km)
    const zonaUser = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;

    const ranking = Object.values(perfiles)
        .filter(p => {
            if (!p.lat || !p.lon) return false;
            const zonaP = `${Number(p.lat).toFixed(2)}_${Number(p.lon).toFixed(2)}`;
            return zonaP === zonaUser;
        })
        .map(p => ({ nombre: p.nombre, puntos: p.puntos }))
        .sort((a, b) => b.puntos - a.puntos)
        .slice(0, 10);

    res.json({ zona: zonaUser, ranking });
});

// Endpoint para canjear recompensas
app.post('/canjear-recompensa', (req, res) => {
    const { userId, socketId, rewardId, puntosAdicionales } = req.body;
    
    if (!userId || !rewardId) return res.status(400).json({ error: 'Datos incompletos' });

    const recompensa = catalogoRecompensas.find(r => r.id === rewardId);
    if (!recompensa) return res.status(404).json({ error: 'Recompensa no encontrada' });

    // Determinar puntos totales (base + adicionales si los hay)
    const puntosUsar = recompensa.costo + (puntosAdicionales || 0);

    const puntosActuales = (perfiles[userId] && perfiles[userId].puntos) || 0;
    if (puntosActuales < puntosUsar) {
        return res.status(403).json({ 
            error: 'Puntos insuficientes', 
            mensaje: `Te faltan ${puntosUsar - puntosActuales} puntos para esta acción.` 
        });
    }

    // LÓGICA DE CANJE
    if (rewardId === 'destacado') {
        const ultimoAnuncio = [...anuncios].reverse().find(a => a.userId === userId);
        if (!ultimoAnuncio) {
            return res.status(400).json({ error: 'No tienes anuncios para destacar.' });
        }
        
        // 1 punto = 30 segundos
        const duracionMs = puntosUsar * 30 * 1000;
        ultimoAnuncio.destacado = true;
        ultimoAnuncio.expiraEn = Date.now() + duracionMs;
        
        io.emit('anuncio-destacado', { id: ultimoAnuncio.id, expiraEn: ultimoAnuncio.expiraEn });
    }

    // Canje exitoso
    perfiles[userId].puntos -= puntosUsar;
    
    // Notificar actualización de puntos (al socketId actual si se proporcionó)
    if (socketId) {
        io.to(socketId).emit('update-recompensas', { puntos: perfiles[userId].puntos });
    }

    console.log(`[CANJE] ${userId} canjeó ${recompensa.nombre} usando ${puntosUsar} puntos`);
    res.json({ 
        success: true, 
        mensaje: `¡Canje exitoso! Has activado: ${recompensa.nombre}`,
        puntosRestantes: perfiles[userId].puntos
    });
});

// Endpoint para obtener anuncios filtrados por zona
app.get('/anuncios', (req, res) => {
    const { lat, lon } = req.query;
    const ahora = Date.now();
    
    anuncios.forEach(ad => {
        if (ad.destacado && ad.expiraEn && ahora > ad.expiraEn) {
            ad.destacado = false;
        }
    });

    let lista = anuncios;

    // Si se proporcionan coordenadas, filtrar por zona
    if (lat && lon) {
        const zonaUser = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
        lista = anuncios.filter(ad => {
            const zonaAd = `${Number(ad.lat).toFixed(2)}_${Number(ad.lon).toFixed(2)}`;
            return zonaAd === zonaUser;
        });
    }

    const ordenados = [...lista].sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));
    res.json(ordenados);
});

// Endpoint para publicar anuncios
app.post('/publicar-anuncio', (req, res) => {
    const { titulo, descripcion, latitud, longitud, userId, socketId } = req.body;

    // Validación básica
    if (!titulo || !descripcion || !latitud || !longitud || !userId || !socketId) {
        return res.status(400).json({ error: 'Faltan datos requeridos (título, descripción, coordenadas, userId, socketId).' });
    }

    // CAPA DE SEGURIDAD: Validar que el usuario ha compartido ubicación recientemente
    const control = clienteControl[socketId];
    const ahora = Date.now();
    const TIEMPO_GRACIA_MS = 60000; // 60 segundos

    if (!control || (ahora - control.ultimoEnvio > TIEMPO_GRACIA_MS)) {
        return res.status(403).json({ 
            error: 'Publicación denegada.', 
            mensaje: 'Debes compartir tu ubicación para publicar gratis.' 
        });
    }

    const zona = `${Number(latitud).toFixed(2)}_${Number(longitud).toFixed(2)}`;

    const nuevoAnuncio = {
        id: `ad-${Date.now()}`,
        userId, // Guardar el ID persistente del usuario
        titulo,
        descripcion,
        lat: latitud,
        lon: longitud,
        zona, // Guardar la zona geográfica
        destacado: false, // Por defecto normal
        timestamp: ahora,
        vistas: 0,
        clicks: 0
    };

    anuncios.push(nuevoAnuncio);
    
    // RECOMPENSA: +5 puntos por publicar (usando userId)
    sumarPuntos(userId, socketId, 5);

    // Limitar anuncios en memoria (ej. últimos 100)
    if (anuncios.length > 100) anuncios.shift();

    // NOTIFICAR SOLO A USUARIOS EN LA MISMA ZONA
    for (const [id, s] of io.sockets.sockets) {
        const ctrl = clienteControl[id];
        if (ctrl) {
            const zonaUser = `${ctrl.ultimaLat.toFixed(2)}_${ctrl.ultimaLon.toFixed(2)}`;
            if (zonaUser === zona) {
                s.emit('nuevo-anuncio', nuevoAnuncio);
            }
        }
    }

    console.log(`[ANUNCIO] Publicado en zona ${zona} por ${userId}: ${titulo}`);
    res.status(201).json({ success: true, anuncio: nuevoAnuncio });
});

// Endpoints de Analítica
app.post('/anuncio-visto', (req, res) => {
    const { id } = req.body;
    const ad = anuncios.find(a => a.id === id);
    if (ad) {
        ad.vistas++;
        res.json({ success: true, vistas: ad.vistas });
    } else {
        res.status(404).json({ error: 'Anuncio no encontrado' });
    }
});

app.post('/anuncio-click', (req, res) => {
    const { id } = req.body;
    const ad = anuncios.find(a => a.id === id);
    if (ad) {
        ad.clicks++;
        res.json({ success: true, clicks: ad.clicks });
    } else {
        res.status(404).json({ error: 'Anuncio no encontrado' });
    }
});

// --- SISTEMA DE COMENTARIOS POR ZONA ---
const comentarios = []; // { userId, nombre, mensaje, lat, lon, zona, timestamp }

app.post('/comentarios', (req, res) => {
    const { userId, nombre, mensaje, lat, lon, parentId } = req.body;
    if (!mensaje || !lat || !lon || !userId || !nombre) {
        return res.status(400).json({ error: 'Faltan datos (mensaje, ubicación, identidad).' });
    }

    const zona = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
    const nuevoComentario = {
        id: `c-${Date.now()}`,
        userId,
        nombre,
        mensaje,
        lat,
        lon,
        zona,
        parentId: parentId || null,
        timestamp: Date.now(),
        likes: 0,
        likedBy: [] // Lista de userId que dieron like
    };

    comentarios.push(nuevoComentario);
    if (comentarios.length > 500) comentarios.shift(); // Limitar memoria

    // Notificar en tiempo real a la zona
    for (const [id, s] of io.sockets.sockets) {
        const ctrl = clienteControl[id];
        if (ctrl) {
            const zonaUser = `${ctrl.ultimaLat.toFixed(2)}_${ctrl.ultimaLon.toFixed(2)}`;
            if (zonaUser === zona) {
                s.emit('nuevo-comentario', nuevoComentario);
            }
        }
    }

    res.status(201).json({ success: true, comentario: nuevoComentario });
});

app.post('/like-comentario', (req, res) => {
    const { comentarioId, userId } = req.body;
    const comentario = comentarios.find(c => c.id === comentarioId);
    
    if (!comentario) return res.status(404).json({ error: 'Comentario no encontrado' });

    const index = comentario.likedBy.indexOf(userId);
    let action = 'like';

    if (index === -1) {
        // Dar like
        comentario.likedBy.push(userId);
        comentario.likes++;
    } else {
        // Quitar like (toggle)
        comentario.likedBy.splice(index, 1);
        comentario.likes--;
        action = 'unlike';
    }

    // Notificar cambio en tiempo real
    io.emit('like-update', { id: comentarioId, likes: comentario.likes });

    res.json({ success: true, likes: comentario.likes, action });
});

app.get('/comentarios', (req, res) => {
    const { lat, lon, sort } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'Coordenadas requeridas.' });

    const zonaUser = `${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}`;
    const locales = comentarios.filter(c => c.zona === zonaUser);
    
    // Organizar en árbol (2 niveles: principal -> respuestas)
    let principales = locales.filter(c => !c.parentId);

    if (sort === 'popular') {
        principales.sort((a, b) => (b.likes - a.likes) || (b.timestamp - a.timestamp));
    } else {
        principales.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    principales = principales.slice(0, 30);
    
    const arbol = principales.map(p => {
        return {
            ...p,
            respuestas: locales
                .filter(r => r.parentId === p.id)
                .sort((a, b) => b.likes - a.likes)
        };
    });

    res.json(arbol);
});

// --- EVENTOS SOCKET.IO ---
io.on('connection', (socket) => {
    console.log('Pasajero conectado:', socket.id);

    // Inicializar control de calidad para este socket
    clienteControl[socket.id] = { ultimoEnvio: 0, ultimaLat: null, ultimaLon: null };

    // Enviar el estado actual (buses y anuncios) al cliente recién conectado
    const estadoBuses = [];
    for (const id in buses) {
        if (buses[id].latitudPromedio !== null && buses[id].longitudPromedio !== null) {
            estadoBuses.push({
                busId: id,
                latitudPromedio: buses[id].latitudPromedio,
                longitudPromedio: buses[id].longitudPromedio,
                muestras: buses[id].ubicaciones.length
            });
        }
    }
    
    socket.emit('estado_inicial', {
        buses: estadoBuses,
        anuncios: anuncios
    });

    // Recibir ubicación GPS del pasajero con validación estricta
    socket.on('ubicacion', (data) => {
        const { latitud, longitud, busId } = data;
        const control = clienteControl[socket.id];
        const ahora = Date.now();

        // CAPA 1: Throttle — rechazar si llegó demasiado pronto
        if (ahora - control.ultimoEnvio < INTERVALO_MINIMO_MS) return;

        // CAPA 2: Rango geográfico — rechazar coordenadas fuera de Colombia
        if (!coordenadasValidas(latitud, longitud)) {
            console.warn(`[RECHAZADO] Coordenadas fuera de rango desde ${socket.id}: (${latitud}, ${longitud})`);
            return;
        }

        // CAPA 3: Desplazamiento mínimo — rechazar si el usuario no se movió
        if (control.ultimaLat !== null) {
            const dLat = Math.abs(latitud - control.ultimaLat);
            const dLon = Math.abs(longitud - control.ultimaLon);
            if (dLat < DESPLAZAMIENTO_MINIMO && dLon < DESPLAZAMIENTO_MINIMO) return;
        }

        // CAPA 4: Bus válido en el ecosistema
        if (!buses[busId]) {
            console.warn(`[RECHAZADO] busId inválido desde ${socket.id}: ${busId}`);
            return;
        }

        // ✅ Dato aprobado — actualizar control y procesar
        control.ultimoEnvio = ahora;
        control.ultimaLat = latitud;
        control.ultimaLon = longitud;

        buses[busId].ubicaciones.push({ latitud, longitud });
        
        // RECOMPENSA: +1 punto por compartir ubicación (vínculo persistente con userId y actualización de zona)
        if (data.userId) {
            sumarPuntos(data.userId, socket.id, 1, null, latitud, longitud);
        }

        // Limitar historial a 50 entradas para no saturar memoria
        if (buses[busId].ubicaciones.length > 50) {
            buses[busId].ubicaciones.shift();
        }

        calcularYEmitir(busId);
    });

    socket.on('disconnect', () => {
        console.log('Pasajero desconectado:', socket.id);
        // Limpiar memoria del control al desconectarse
        delete clienteControl[socket.id];
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`SafeRoute Backend corriendo en el puerto ${PORT}`);
});
