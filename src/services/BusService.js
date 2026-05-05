class BusService {
    constructor() {
        this.buses = new Map(); // busId -> { lat, lon, speed, heading, lastUpdate }
    }

    updateLocation(busId, data) {
        const update = {
            ...data,
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
