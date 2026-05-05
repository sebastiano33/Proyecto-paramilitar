const { v4: uuidv4 } = require('uuid'); // Nota: requeriría instalación, pero usaré Math.random por ahora para evitar romper dependencias

class TripService {
    constructor() {
        this.activeTrips = new Map(); // token -> tripData
    }

    createTrip(data) {
        const token = Math.random().toString(36).substr(2, 9);
        const trip = {
            token,
            ...data,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 horas
        };
        this.activeTrips.set(token, trip);
        return trip;
    }

    getTrip(token) {
        const trip = this.activeTrips.get(token);
        if (!trip) return { expired: true };
        
        if (new Date() > trip.expiresAt) {
            this.activeTrips.delete(token);
            return { expired: true };
        }
        return trip;
    }

    deleteTrip(token) {
        return this.activeTrips.delete(token);
    }
}

module.exports = new TripService();
