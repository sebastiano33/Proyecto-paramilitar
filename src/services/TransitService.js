const fs = require('fs');
const path = require('path');

class TransitService {
    constructor() {
        // Usar path.resolve para asegurar ruta absoluta compatible con Linux/Render
        this.dataPath = path.resolve(__dirname, '../data/transit_data.json');
        this.transitData = this.loadData();
        this.waitingUsers = new Map(); // stopId -> count
    }

    loadData() {
        try {
            console.log(`[TransitService] Intentando cargar datos desde: ${this.dataPath}`);
            
            if (!fs.existsSync(this.dataPath)) {
                console.warn(`[TransitService] ADVERTENCIA: El archivo no existe en ${this.dataPath}`);
                return this.getFallbackData();
            }

            const rawData = fs.readFileSync(this.dataPath, 'utf8');
            const parsedData = JSON.parse(rawData);
            
            console.log(`[TransitService] ✅ Datos cargados exitosamente (${parsedData.routes?.length || 0} rutas)`);
            return parsedData;
        } catch (error) {
            console.error('[TransitService] ❌ Error crítico al cargar datos:', error.message);
            return this.getFallbackData();
        }
    }

    getFallbackData() {
        console.info('[TransitService] ⚠️ Usando fallback profesional (memoria vacía para evitar crash)');
        return { 
            routes: [],
            lastUpdate: new Date().toISOString(),
            status: 'fallback_active'
        };
    }

    getAllRoutes() {
        const data = this.transitData.routes || this.transitData;
        if (!Array.isArray(data)) return [];
        
        return data.map(route => ({
            ...route,
            color: route.color || this.getRouteColor(route.id),
            path: route.path || (route.stops ? route.stops.map(s => [s.lat, s.lng]) : [])
        }));
    }

    getRouteColor(id) {
        const colors = {
            'T100E': '#ef4444', // Rojo Expresa
            'T101': '#3b82f6',  // Azul
            'T102': '#10b981',  // Verde
            'T103': '#f59e0b',  // Ambar
            'X101': '#8b5cf6',  // Violeta
            'X102': '#ec4899',  // Rosa
            'X104': '#06b6d4',  // Cian
            'X105': '#f97316'   // Naranja
        };
        return colors[id] || '#6366f1';
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
