const express = require('express');
const router = express.Router();
const predictor = require('../services/congestionPredictor');
const heatmap = require('../services/heatmapService');
const catchAsync = require('../utils/catchAsync');

// Congestion Endpoints
router.get('/current', catchAsync(async (req, res) => {
    // Mock de rutas con score
    const routes = [
        { routeId: '2', routeName: 'Ruta 2', score: 0.72, ...predictor.getLabel(0.72) },
        { routeId: '10', routeName: 'Ruta 10', score: 0.35, ...predictor.getLabel(0.35) }
    ];
    res.json({ success: true, routes, modelPhase: 1 });
}));

// Heatmap Endpoints
router.get('/heatmap/:type', catchAsync(async (req, res) => {
    const data = await heatmap.generateHeatmap(req.params.type, req.query.period);
    res.json({ success: true, ...data });
}));

module.exports = router;
