const express = require('express');
const router = express.Router();
const tripPlanner = require('../services/TripPlannerService');
const catchAsync = require('../utils/catchAsync');

router.post('/plan', catchAsync(async (req, res) => {
    const { origin, destination } = req.body;
    
    if (!origin || !destination) {
        return res.status(400).json({ success: false, message: 'Origen y destino requeridos' });
    }

    const options = tripPlanner.plan(origin, destination);
    res.json({ success: true, options, generatedAt: new Date() });
}));

module.exports = router;
