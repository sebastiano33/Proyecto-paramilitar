const express = require('express');
const cors = require('cors');
const path = require('path');
const anunciosRoutes = require('./routes/anuncios.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend-map')));

// Rutas
app.use('/anuncios', anunciosRoutes);

// Otros módulos se irán añadiendo aquí...
// app.use('/reports', reportsRoutes);
// app.use('/trips', tripsRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(`[SERVER ERROR] ${err.message}`);
    res.status(500).json({ error: "Error interno del servidor" });
});

module.exports = app;
