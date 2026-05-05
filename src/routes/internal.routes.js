const express = require('express');
const router = express.Router();
const gpsStore = require('../services/gpsStore');

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'sr_dev_secret_2026';

router.post('/bus-update', async (req, res) => {
    const internalKey = req.headers['x-internal-key'];
    
    if (internalKey !== INTERNAL_SECRET) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    const busData = req.body;
    
    // Calcular heading automáticamente si no viene
    const previous = await gpsStore.getBusPosition(busData.busId);
    if (previous && !busData.heading) {
        busData.heading = calculateHeading(previous.lat, previous.lng, busData.lat, busData.lng);
    }

    const updated = await gpsStore.updatePosition(busData.busId, busData);
    
    // Acceder a la instancia de IO para el broadcast
    if (req.app.get('io')) {
        req.app.get('io').to(`gps:route:${busData.routeId}`).emit('bus:position', updated);
    }

    res.json({ success: true, bus: updated });
});

function calculateHeading(lat1, lon1, lat2, lon2) {
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const brng = Math.atan2(y, x);
    return ((brng * 180 / Math.PI) + 360) % 360;
}

module.exports = router;
