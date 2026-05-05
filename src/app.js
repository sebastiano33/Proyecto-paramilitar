const express = require('express');
const cors = require('cors');

const app = express();

// Configuración de CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Importar Rutas
const coreRoutes = require('./routes/core.routes');
const tripsRoutes = require('./routes/trips.routes');
const adminRoutes = require('./routes/admin.routes');

// Registrar Rutas
app.get('/', (req, res) => res.send('SafeRoute API Profesional funcionando'));
app.use('/', coreRoutes);
app.use('/trips', tripsRoutes);
app.use('/admin', adminRoutes);

// Middleware para capturar rutas no encontradas (404) y devolver JSON
app.use((req, res) => {
    res.status(404).json({ 
        error: "Ruta no encontrada", 
        message: `El endpoint ${req.originalUrl} no existe en esta API.` 
    });
});

// Middleware global para manejo de errores (evita respuestas HTML en errores 500)
app.use((err, req, res, next) => {
    console.error('[Error Global]', err.stack);
    res.status(500).json({ 
        error: "Error interno del servidor", 
        message: "Ocurrió un error inesperado. Por favor, intenta más tarde." 
    });
});

module.exports = app;
