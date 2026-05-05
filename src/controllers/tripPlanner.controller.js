const TripPlannerService = require('../services/TripPlannerService');

exports.planTrip = (req, res) => {
    const { origin, destination } = req.body;
    if (!origin || !destination) {
        return res.status(400).json({ error: 'Origen y destino son requeridos' });
    }

    const options = TripPlannerService.calculateTrip(origin, destination);
    res.json({
        options,
        count: options.length
    });
};
