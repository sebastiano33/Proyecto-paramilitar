const PredictionService = require('../services/PredictionService');

exports.getRoutePrediction = (req, res) => {
    const { routeId } = req.params;
    const prediction = PredictionService.getPredictionForRoute(routeId);
    res.json(prediction);
};

exports.getInsights = (req, res) => {
    const analysis = PredictionService.analyzeTraffic();
    res.json(analysis);
};
