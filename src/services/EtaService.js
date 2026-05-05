const fs = require('fs');
const path = require('path');
const gpsStore = require('./gpsStore');

class EtaService {
    constructor() {
        this.historyPath = path.join(__dirname, '../data/eta_history.json');
        this.history = [];
        this.routes = require('../data/routes.json');
        this.loadHistory();
    }

    loadHistory() {
        try {
            if (fs.existsSync(this.historyPath)) {
                this.history = JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
            }
        } catch (e) { console.error('[EtaService] Error loading history:', e); }
    }

    async getEta(routeId, stopId) {
        const route = this.routes.find(r => r.id === routeId);
        const stop = route?.stops.find(s => s.id === stopId);
        if (!route || !stop) return null;

        const activeBuses = await gpsStore.getBusesByRoute(routeId);
        
        // Capa 1: GPS Activo (Confidence: High)
        const nearbyBus = activeBuses.find(bus => {
            const busStop = route.stops.find(s => s.order < stop.order); // Bus viene antes
            return busStop; 
        });

        if (nearbyBus) {
            const distance = this.calculateRouteDistance(nearbyBus, stop, route.waypoints);
            const speed = nearbyBus.speed > 5 ? nearbyBus.speed : 25; // 25km/h fallback
            const minutes = Math.round((distance / (speed / 60)));
            return {
                busId: nearbyBus.busId,
                eta_minutes: Math.max(1, minutes),
                eta_display: `${Math.max(1, minutes)} min`,
                confidence: 'high'
            };
        }

        // Capa 3: Estimado (Confidence: Low) - Simplificado
        const now = new Date();
        const hour = now.getHours();
        let factor = 0.85;
        if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) factor = 0.6;
        
        const estMinutes = Math.round(route.frequency_minutes.normal * (1 / factor));
        return {
            eta_minutes: estMinutes,
            eta_display: `${estMinutes} min`,
            confidence: 'low'
        };
    }

    calculateRouteDistance(p1, p2, waypoints) {
        // Haversine simplificada
        const R = 6371;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1.3; // Factor 1.3 para calles
    }
}

module.exports = new EtaService();
