const fs = require('fs');
const path = require('path');

// Cargar datos de forma síncrona
const transitDataPath = path.join(__dirname, '../data/transit_data.json');
let transitData = {};

try {
    transitData = JSON.parse(fs.readFileSync(transitDataPath, 'utf8'));
} catch (error) {
    console.error('Error cargando transit_data.json:', error);
}

exports.getRoutes = (req, res) => {
    res.json(transitData.routes || transitData);
};

exports.getWaitingStops = (req, res) => {
    res.json([]);
};

exports.registerWaiting = (req, res) => {
    const { stopName } = req.body;
    console.log(`[Core] Registro de espera en: ${stopName}`);
    res.json({ success: true, message: `Espera registrada en ${stopName}` });
};

exports.getSafetyData = (req, res) => {
    res.json([]);
};
