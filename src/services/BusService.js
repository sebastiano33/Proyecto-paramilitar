class BusService {
    constructor() {
        this.buses = new Map(); // busId -> { lat, lon, speed, heading, lastUpdate }
    }

    updateLocation(busId, data) {
        const prev = this.buses.get(busId);
        let bearing = 0;
        
        if (prev && data.lat !== prev.lat) {
            // Calcular ángulo de movimiento
            const y = Math.sin(data.lon - prev.lon) * Math.cos(data.lat);
            const x = Math.cos(prev.lat) * Math.sin(data.lat) -
                      Math.sin(prev.lat) * Math.cos(data.lat) * Math.cos(data.lon - prev.lon);
            bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }

        const update = {
            busId,
            ...data,
            bearing: bearing || (prev ? prev.bearing : 0),
            lastUpdate: new Date()
        };
        this.buses.set(busId, update);
        return update;
    }

    getBusLocation(busId) {
        return this.buses.get(busId);
    }

    getAllActiveBuses() {
        return Array.from(this.buses.values());
    }
}

module.exports = new BusService();
