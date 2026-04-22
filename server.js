const cors = require('cors');
const express = require('express');
const app = express();
const port = 3000;

// Middleware para entender JSON en el cuerpo de la petición
app.use(express.json());

// Activar CORS a través de la librería oficial de forma global
app.use(cors());

// Arreglo para guardar las ubicaciones en memoria
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

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
