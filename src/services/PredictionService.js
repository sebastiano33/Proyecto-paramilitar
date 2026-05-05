const BusService = require('./BusService');
const SocialService = require('./SocialService');

class PredictionService {
    constructor() {
        this.congestionLevels = new Map(); // routeId -> 'low' | 'medium' | 'high'
        this.lastAnalysis = null;
    }

    analyzeTraffic() {
        const buses = BusService.getAllActiveBuses();
        const socialPosts = SocialService.getFeed();
        
        const analysis = {
            congestedRoutes: [],
            delays: [],
            recommendations: []
        };

        // 1. Análisis por velocidad de buses
        // Si un bus va a < 10km/h en una zona fluida, marcar congestión
        buses.forEach(bus => {
            // Nota: Aquí usaríamos lógica de velocidad real si tuviéramos historial GPS preciso
            // Por ahora simularemos detección basada en reportes sociales recientes
        });

        // 2. Análisis Social (NLP simple)
        const recentAlerts = socialPosts.filter(p => 
            (new Date() - new Date(p.timestamp)) < 15 * 60 * 1000 && // Últimos 15 min
            ['Accidente', 'Retraso', 'Bus Lleno'].includes(p.type)
        );

        recentAlerts.forEach(alert => {
            if (alert.routeId) {
                this.congestionLevels.set(alert.routeId, 'high');
                analysis.congestedRoutes.push({
                    routeId: alert.routeId,
                    level: 'high',
                    reason: alert.message
                });
            }
        });

        this.lastAnalysis = analysis;
        return analysis;
    }

    getPredictionForRoute(routeId) {
        const level = this.congestionLevels.get(routeId) || 'low';
        return {
            routeId,
            congestion: level,
            estimatedDelay: level === 'high' ? '15-20 min' : (level === 'medium' ? '5-10 min' : '0-2 min'),
            status: level === 'high' ? 'Crítico' : 'Normal'
        };
    }

    getGlobalInsights() {
        return {
            timestamp: new Date(),
            ...this.lastAnalysis
        };
    }
}

module.exports = new PredictionService();
