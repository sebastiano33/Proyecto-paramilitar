const fs = require('fs');
const path = require('path');

class HeatmapService {
    constructor() {
        this.cache = new Map();
        this.bbox = { lat: [10.35, 10.45], lng: [-75.55, -75.46] };
        this.cellSize = 0.001;
    }

    getCellKey(lat, lng) {
        const cLat = Math.floor(lat / this.cellSize) * this.cellSize;
        const cLng = Math.floor(lng / this.cellSize) * this.cellSize;
        return `${cLat.toFixed(4)},${cLng.toFixed(4)}`;
    }

    async generateHeatmap(type, period = '24h') {
        const cacheKey = `${type}:${period}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const pointsMap = new Map();
        // Simulación de agregación de datos (Demand, Alerts, etc.)
        // En producción aquí se leerían data/posts.json y data/eta_history.json
        
        // Mock de datos para Cartagena
        const mockPoints = [
            [10.4236, -75.5492, 0.8], // Centro
            [10.4042, -75.5581, 0.6], // Bocagrande
            [10.4180, -75.5350, 0.9], // Pie de la Popa
            [10.3750, -75.4620, 0.4]  // Terminal
        ];

        const result = {
            type,
            period,
            generatedAt: new Date(),
            points: mockPoints,
            stats: { totalPoints: mockPoints.length, maxRawValue: 1.0 }
        };

        this.cache.set(cacheKey, result);
        return result;
    }
}

module.exports = new HeatmapService();
