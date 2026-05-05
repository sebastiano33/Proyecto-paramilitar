exports.trackView = (req, res) => {
    const { busId, stopName } = req.body;
    console.log(`[Admin] Tracking interacción: Bus ${busId} - Parada ${stopName}`);
    res.json({ success: true });
};

exports.exportReport = (req, res) => {
    const { type } = req.params;
    res.status(401).json({ 
        error: 'No autorizado', 
        message: `La exportación de ${type} requiere una API Key válida configurada en producción.` 
    });
};
