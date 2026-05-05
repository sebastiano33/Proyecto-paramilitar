const express = require('express');
const cors = require('cors');
const { CORS_OPTIONS } = require('./config');

const app = express();

// Middlewares
app.use(cors(CORS_OPTIONS));
app.use(express.json());

// Importar Rutas
const coreRoutes = require('./routes/core.routes');
const tripsRoutes = require('./routes/trips.routes');
const adminRoutes = require('./routes/admin.routes');
const socialRoutes = require('./routes/social.routes');

// Registrar Rutas
app.get('/', (req, res) => res.send('SafeRoute API Uber-Style Realtime funcionando'));
app.use('/', coreRoutes);
app.use('/trips', tripsRoutes);
app.use('/admin', adminRoutes);
app.use('/social', socialRoutes);

// Manejo de 404
app.use((req, res) => {
    res.status(404).json({ 
        error: "Ruta no encontrada", 
        message: `El endpoint ${req.originalUrl} no existe.` 
    });
});

// Manejo de errores 500
app.use((err, req, res, next) => {
    console.error('[Error Global]', err.stack);
    res.status(500).json({ 
        error: "Error interno del servidor", 
        message: "Error inesperado en la API." 
    });
});

module.exports = app;
