const routes = require('../data/routes.json');

class TripPlannerService {
    plan(origin, destination) {
        const options = [];

        routes.forEach(route => {
            const nearOrigin = route.stops.find(s => this.getDistance(origin, s) < 0.6);
            const nearDest = route.stops.find(s => this.getDistance(destination, s) < 0.6);

            if (nearOrigin && nearDest && nearOrigin.order < nearDest.order) {
                // Ruta Directa
                const walkToStop = this.getDistance(origin, nearOrigin);
                const walkFromStop = this.getDistance(destination, nearDest);
                const busTravel = this.getDistance(nearOrigin, nearDest) * 1.3;

                const walkTime = Math.round((walkToStop + walkFromStop) / (4.5 / 60));
                const busTime = Math.round(busTravel / (25 / 60));

                options.push({
                    id: `direct_${route.id}`,
                    totalTime: walkTime + busTime + 5, // +5 min espera
                    totalWalkTime: walkTime,
                    totalBusTime: busTime,
                    transfers: 0,
                    summary: `${route.name} directo · ${walkTime + busTime + 5} min`,
                    steps: [
                        { type: 'walk', from: origin, to: nearOrigin, duration: Math.round(walkToStop / (4.5 / 60)) },
                        { type: 'bus', routeId: route.id, routeName: route.name, from: nearOrigin, to: nearDest, duration: busTime },
                        { type: 'walk', from: nearDest, to: destination, duration: Math.round(walkFromStop / (4.5 / 60)) }
                    ]
                });
            }
        });

        return options.sort((a, b) => a.totalTime - b.totalTime).slice(0, 3);
    }

    getDistance(p1, p2) {
        const R = 6371;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
}

module.exports = new TripPlannerService();
