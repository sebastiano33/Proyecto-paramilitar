const cors = require('cors');
const express = require('express');
const http = require('http'); // <- NUEVO Modulo Nativo
const { Server } = require('socket.io'); // <- NUEVO Modulo WebSocket

const app = express();

// Instanciar Servidor Http y pasarle la App de Express
const server = http.createServer(app);

// Acoplar WebSockets al servidor HTTP permitiendo todas las políticas
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ["websocket", "polling"] // Configuración crítica para el proxy y load balancer de Render
});

// Middleware para entender JSON en el cuerpo de la petición
app.use(express.json());

// Activar CORS a través de la librería oficial de forma global
app.use(cors());

// Healthcheck principal requerido para plataformas de despliegue como Render
app.get('/', (req, res) => {
    res.send('Servidor Backend Híbrido funcionando correctamente.');
});

// --- ESTRUCTURA BASE MULTIPLE BUSES ---
// Objeto principal en memoria para almacenar la data de múltiples buses
const buses = {
    bus1: { ubicaciones: [], latitudPromedio: null, longitudPromedio: null },
    bus2: { ubicaciones: [], latitudPromedio: null, longitudPromedio: null },
    bus3: { ubicaciones: [], latitudPromedio: null, longitudPromedio: null }
};

// Función nativa para recalcular el promedio de los pasajeros de un bus y emitirlo
function calcularYEmitir(busId) {
    const bus = buses[busId];
    if (!bus || bus.ubicaciones.length === 0) return;

    // 1. Centro Geográfico Preliminar
    let sumaLatPreliminar = 0;
    let sumaLonPreliminar = 0;
    for (const ubi of bus.ubicaciones) {
        sumaLatPreliminar += ubi.latitud;
        sumaLonPreliminar += ubi.longitud;
    }
    const promedioLatPreliminar = sumaLatPreliminar / bus.ubicaciones.length;
    const promedioLonPreliminar = sumaLonPreliminar / bus.ubicaciones.length;

    // 2. Filtro Anti-Troll (Eliminar lejanía)
    const UMBRAL_DISTANCIA = 0.01;
    const ubicacionesCercanas = bus.ubicaciones.filter(ubi => {
        const dLat = ubi.latitud - promedioLatPreliminar;
        const dLon = ubi.longitud - promedioLonPreliminar;
        const distancia = Math.sqrt(dLat * dLat + dLon * dLon);
        return distancia <= UMBRAL_DISTANCIA;
    });

    const ubicacionesFinales = ubicacionesCercanas.length > 0 ? ubicacionesCercanas : bus.ubicaciones;

    // 3. Calcular la verdad absoluta final
    let sumaLat = 0;
    let sumaLon = 0;
    for (const ubi of ubicacionesFinales) {
        sumaLat += ubi.latitud;
        sumaLon += ubi.longitud;
    }
    const latitudPromedio = sumaLat / ubicacionesFinales.length;
    const longitudPromedio = sumaLon / ubicacionesFinales.length;

    // Optimización vital: Evitar la saturación del servidor cortando envíos repetidos
    if (bus.latitudPromedio === latitudPromedio && bus.longitudPromedio === longitudPromedio) {
        return; 
    }

    // Guardar el último promedio verídico en memoria para próximos usuarios que se conecten
    buses[busId].latitudPromedio = latitudPromedio;
    buses[busId].longitudPromedio = longitudPromedio;

    // Disparar WebSocket exclusivamente con los datos de este bus
    io.emit('bus-update', {
        busId: busId,
        latitudPromedio,
        longitudPromedio
    });
}

// Interceptor puro del Socket.IO (No requiere endpoint REST)
io.on('connection', (socket) => {
    console.log('Nuevo pasajero conectado al Socket:', socket.id);

    // 1. Enviar ESTADO INICIAL de todos los buses a este usuario nada más conectarse
    const estadoInicial = [];
    for (const id in buses) {
        if (buses[id].latitudPromedio !== null && buses[id].longitudPromedio !== null) {
            estadoInicial.push({
                busId: id,
                latitudPromedio: buses[id].latitudPromedio,
                longitudPromedio: buses[id].longitudPromedio
            });
        }
    }
    // Emitir solamente a este usuario (socket.emit en lugar de io.emit)
    socket.emit('estado_inicial', estadoInicial);

    // 2. Escuchar cuando el frontend manda 'ubicacion'
    socket.on('ubicacion', (data) => {
        const { latitud, longitud, busId } = data;

        // Validar que el bus exista en nuestro ecosistema y los datos sean sanos
        if (typeof latitud === 'number' && typeof longitud === 'number' && buses[busId]) {
            // Se inserta la ubicación proveniente del pasajero al array de ese bus
            buses[busId].ubicaciones.push({ latitud, longitud });
            
            // Mantener la memoria limpia limitando el historial de pasajeros
            if (buses[busId].ubicaciones.length > 50) {
                buses[busId].ubicaciones.shift();
            }

            // Calcular y notificar a los mapas en vivo
            calcularYEmitir(busId);
        }
    });
});

// Arreglo para guardar las ubicaciones en memoria de la versión legacy
const ubicaciones = [];

// Historial de las últimas posiciones promedio para calcular dirección y velocidad
const historialPromedios = [];

// Endpoint POST para recibir y guardar la ubicación
app.post('/ubicacion', (req, res) => {
    const { latitud, longitud } = req.body;

    // Validación básica
    if (typeof latitud !== 'number' || typeof longitud !== 'number') {
        return res.status(400).json({ error: 'Latitud y longitud son requeridas y deben ser números' });
    }

    // Guardar en memoria
    ubicaciones.push({ latitud, longitud });
    
    // NOTIFICAR INMEDIATAMENTE POR WEBSOCKET A TODOS LOS CLIENTES (SIN ENVIAR DATA EXTRA, SOLO EL "TIMBRE")
    io.emit('nueva_posicion');
    
    res.status(201).json({ message: 'Ubicación guardada exitosamente' });
});

// Endpoint GET para calcular y devolver el promedio de las posiciones
app.get('/posicion-bus', (req, res) => {

    // Si no hay ubicaciones, devolver valores en cero como fue solicitado (en lugar de 404)
    if (ubicaciones.length === 0) {
        return res.json({
            latitudPromedio: 0,
            longitudPromedio: 0,
            direccion: "Desconocida",
            velocidadKmH: 0
        });
    }

    // 1. Calcular promedio preliminar
    let sumaLatitudPreliminar = 0;
    let sumaLongitudPreliminar = 0;

    for (const ubi of ubicaciones) {
        sumaLatitudPreliminar += ubi.latitud;
        sumaLongitudPreliminar += ubi.longitud;
    }

    const promedioLatPreliminar = sumaLatitudPreliminar / ubicaciones.length;
    const promedioLonPreliminar = sumaLongitudPreliminar / ubicaciones.length;

    // 2. Filtrar ubicaciones que estén a más de 0.01 grados del promedio preliminar
    const UMBRAL_DISTANCIA = 0.01;
    const ubicacionesCercanas = ubicaciones.filter(ubi => {
        const distanciaLat = ubi.latitud - promedioLatPreliminar;
        const distanciaLon = ubi.longitud - promedioLonPreliminar;
        // Distancia euclidiana aproximada en grados
        const distancia = Math.sqrt(distanciaLat * distanciaLat + distanciaLon * distanciaLon);
        return distancia <= UMBRAL_DISTANCIA;
    });

    // Si por ningún motivo quedaron ubicaciones o algo falló, devolvemos a la lista completa
    const ubicacionesFinales = ubicacionesCercanas.length > 0 ? ubicacionesCercanas : ubicaciones;

    // 3. Calcular el promedio final solo con las ubicaciones cercanas (filtradas)
    let sumaLatitudFinal = 0;
    let sumaLongitudFinal = 0;

    for (const ubi of ubicacionesFinales) {
        sumaLatitudFinal += ubi.latitud;
        sumaLongitudFinal += ubi.longitud;
    }

    const promedioLatitud = sumaLatitudFinal / ubicacionesFinales.length;
    const promedioLongitud = sumaLongitudFinal / ubicacionesFinales.length;

    // 4. Calcular la dirección y velocidad del movimiento estableciendo la diferencia con el paso anterior
    let direccion = "Desconocida";
    let velocidadKmH = 0;

    if (historialPromedios.length > 0) {
        const ultimaPos = historialPromedios[historialPromedios.length - 1];

        const difLat = promedioLatitud - ultimaPos.latitud;
        const difLon = promedioLongitud - ultimaPos.longitud;

        // Umbral mínimo para considerar movimiento
        const umbralMovimiento = 0.00001;

        let dirNorteSur = "";
        let dirEsteOeste = "";

        if (difLat > umbralMovimiento) dirNorteSur = "Norte";
        else if (difLat < -umbralMovimiento) dirNorteSur = "Sur";

        if (difLon > umbralMovimiento) dirEsteOeste = "Este";
        else if (difLon < -umbralMovimiento) dirEsteOeste = "Oeste";

        if (dirNorteSur !== "" || dirEsteOeste !== "") {
            if (dirNorteSur === "Norte" && dirEsteOeste === "Este") direccion = "Noreste";
            else if (dirNorteSur === "Norte" && dirEsteOeste === "Oeste") direccion = "Noroeste";
            else if (dirNorteSur === "Sur" && dirEsteOeste === "Este") direccion = "Sureste";
            else if (dirNorteSur === "Sur" && dirEsteOeste === "Oeste") direccion = "Suroeste";
            else direccion = dirNorteSur || dirEsteOeste;
        } else {
            direccion = "Detenido";
        }

        // Calcular la velocidad aproximada
        // (Aproximación donde 1 grado de diferencia equivale más o menos a 111 kilómetros)
        const distanciaKm = Math.sqrt(difLat * difLat + difLon * difLon) * 111;

        // El tiempo transcurrido en horas es milisegundos / 1000 / 3600 => milisegundos / 3600000
        const horasTranscurridas = (Date.now() - ultimaPos.timestamp) / 3600000;

        if (horasTranscurridas > 0) {
            velocidadKmH = distanciaKm / horasTranscurridas;
        }
    }

    // Guardar el promedio actual en el historial incluyendo la estampa de tiempo actual
    historialPromedios.push({
        latitud: promedioLatitud,
        longitud: promedioLongitud,
        timestamp: Date.now()
    });

    // Mantener solo las últimas 5 posiciones
    if (historialPromedios.length > 5) {
        historialPromedios.shift();
    }

    // 5. Calcular tiempo de llegada estimado (ETA) si el usuario mandó sus coordenadas
    let tiempoEstimadoMinutos = null;
    const { userLat, userLon } = req.query;

    if (userLat !== undefined && userLon !== undefined) {
        const uLat = parseFloat(userLat);
        const uLon = parseFloat(userLon);

        if (!isNaN(uLat) && !isNaN(uLon)) {
            const dLat = promedioLatitud - uLat;
            const dLon = promedioLongitud - uLon;

            // Distancia directa aprox en kilómetros
            const distanciaUsuarioKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111;

            // Usar velocidad base de 20 km/h si el bus está detenido o casi detenido
            const velocidadEfectiva = velocidadKmH > 0.5 ? velocidadKmH : 20;

            const tiempoHoras = distanciaUsuarioKm / velocidadEfectiva;
            tiempoEstimadoMinutos = Math.ceil(tiempoHoras * 60);
        }
    }

    res.json({
        latitudPromedio: promedioLatitud,
        longitudPromedio: promedioLongitud,
        direccion: direccion,
        velocidadKmH: Number(velocidadKmH.toFixed(2)),
        tiempoEstimado: tiempoEstimadoMinutos
    });
});

const PORT = process.env.PORT || 3000;

// Reemplazo vital: Usar "server.listen" en vez de "app.listen" para arrancar juntos tanto WebSockets como Express
server.listen(PORT, () => {
    console.log(`Servidor Híbrido HTTP + WebSockets corriendo en el puerto ${PORT}`);
});
