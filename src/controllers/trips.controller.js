exports.shareTrip = (req, res) => {
    const { destination } = req.body;
    console.log(`[Trips] Creando viaje compartido hacia: ${destination}`);
    res.json({ 
        success: true,
        shareUrl: 'https://proyecto-paramilitar.onrender.com/viaje.html', 
        token: 'dummy-token-' + Math.random().toString(36).substr(2, 9)
    });
};

exports.getTripStatus = (req, res) => {
    res.json({ expired: true, message: "Viaje simulado (modo API limpia)" });
};

exports.endTrip = (req, res) => {
    res.json({ success: true, message: "Viaje finalizado" });
};
