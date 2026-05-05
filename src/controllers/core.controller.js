const TransitService = require('../services/TransitService');
const catchAsync = require('../utils/catchAsync');

exports.getRoutes = catchAsync(async (req, res) => {
    const routes = TransitService.getAllRoutes();
    res.status(200).json({
        status: 'success',
        results: routes.length,
        data: routes
    });
});

exports.getWaitingStops = catchAsync(async (req, res) => {
    const stops = TransitService.getWaitingStops();
    res.status(200).json({
        status: 'success',
        data: stops
    });
});

exports.registerWaiting = catchAsync(async (req, res) => {
    const { stopName } = req.body;
    if (!stopName) {
        return res.status(400).json({ status: 'fail', message: 'Nombre de parada requerido' });
    }
    const result = TransitService.registerWaiting(stopName);
    res.status(201).json({
        status: 'success',
        data: result
    });
});

exports.getSafetyData = catchAsync(async (req, res) => {
    const data = TransitService.getSafetyZones();
    res.status(200).json({
        status: 'success',
        data
    });
});
