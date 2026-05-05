const TransitService = require('../services/TransitService');

exports.getRoutes = (req, res) => {
    res.json(TransitService.getAllRoutes());
};

exports.getWaitingStops = (req, res) => {
    res.json(TransitService.getWaitingStops());
};

exports.registerWaiting = (req, res) => {
    const { stopName } = req.body;
    const result = TransitService.registerWaiting(stopName);
    res.json({ success: true, data: result });
};

exports.getSafetyData = (req, res) => {
    res.json(TransitService.getSafetyZones());
};
