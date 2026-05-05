const AdminService = require('../services/AdminService');
const BusService = require('../services/BusService');

exports.getStats = async (req, res) => {
    try {
        const stats = await AdminService.getDashboardStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

exports.getBuses = (req, res) => {
    res.json(BusService.getAllActiveBuses());
};

exports.trackView = (req, res) => {
    const { busId, stopName } = req.body;
    console.log(`[Admin] Analytics: View en ${stopName} para bus ${busId}`);
    res.json({ success: true });
};

exports.exportReport = (req, res) => {
    const { type } = req.params;
    res.status(401).json({ 
        error: 'No autorizado', 
        message: `Exportación de ${type} protegida.` 
    });
};
