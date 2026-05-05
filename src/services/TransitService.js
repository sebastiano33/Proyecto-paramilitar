const fs = require('fs');
const path = require('path');

class TransitService {
    constructor() {
        this.dataPath = path.join(__dirname, '../data/transit_data.json');
        this.transitData = this.loadData();
        this.waitingUsers = new Map(); // stopId -> count
    }

    loadData() {
        try {
            return JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        } catch (error) {
            console.error('[TransitService] Fallo al cargar datos:', error);
            return { routes: [] };
        }
    }

    getAllRoutes() {
        return this.transitData.routes || this.transitData;
    }

    getWaitingStops() {
        // Convertir Map a formato legible para API
        const data = [];
        this.waitingUsers.forEach((count, stopId) => {
            data.push({ stopId, count });
        });
        return data;
    }

    registerWaiting(stopName) {
        const current = this.waitingUsers.get(stopName) || 0;
        this.waitingUsers.set(stopName, current + 1);
        return { stopName, count: current + 1 };
    }

    getSafetyZones() {
        return []; // Futura integración con DB
    }
}

module.exports = new TransitService();
