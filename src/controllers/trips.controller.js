const TripService = require('../services/TripService');

exports.shareTrip = (req, res) => {
    const { destination } = req.body;
    const trip = TripService.createTrip({ destination });
    
    res.json({ 
        success: true,
        shareUrl: `https://proyecto-paramilitar.onrender.com/viaje.html?t=${trip.token}`, 
        token: trip.token 
    });
};

exports.getTripStatus = (req, res) => {
    const { token } = req.params;
    res.json(TripService.getTrip(token));
};

exports.endTrip = (req, res) => {
    const { token } = req.params;
    TripService.deleteTrip(token);
    res.json({ success: true, message: "Viaje finalizado" });
};
