const axios = require('axios');

const API_URL = 'http://localhost:3000/internal/bus-update';
const SECRET = 'sr_dev_secret_2026';

// Waypoints reales de Cartagena
const ROUTES = {
    '2': {
        name: 'Centro - Bocagrande',
        color: '#4f46e5',
        waypoints: [
            [10.4236, -75.5492], // Torre del Reloj
            [10.4136, -75.5539], // Base Naval
            [10.4042, -75.5581], // Plaza Bocagrande
            [10.3952, -75.5632], // Hotel Hilton
            [10.3912, -75.5658]  // El Laguito
        ]
    },
    '10': {
        name: 'Centro - Manga',
        color: '#10b981',
        waypoints: [
            [10.4230, -75.5450], // India Catalina
            [10.4150, -75.5400], // Puente Román
            [10.4100, -75.5350], // Fuerte del Pastelillo
            [10.4050, -75.5300], // DIAN Manga
            [10.4000, -75.5250]  // Sociedad Portuaria
        ]
    }
};

class Bus {
    constructor(id, routeId) {
        this.busId = id;
        this.routeId = routeId;
        this.route = ROUTES[routeId];
        this.currentWaypoint = 0;
        this.pos = [...this.route.waypoints[0]];
    }

    async move() {
        const target = this.route.waypoints[(this.currentWaypoint + 1) % this.route.waypoints.length];
        
        // Simular movimiento paso a paso
        this.pos[0] += (target[0] - this.pos[0]) * 0.1;
        this.pos[1] += (target[1] - this.pos[1]) * 0.1;

        // Si llegó al waypoint, pasar al siguiente
        const dist = Math.sqrt(Math.pow(target[0] - this.pos[0], 2) + Math.pow(target[1] - this.pos[1], 2));
        if (dist < 0.0001) {
            this.currentWaypoint = (this.currentWaypoint + 1) % this.route.waypoints.length;
        }

        try {
            await axios.post(API_URL, {
                busId: this.busId,
                routeId: this.routeId,
                lat: this.pos[0],
                lng: this.pos[1],
                speed: 35 + Math.random() * 10,
                color: this.route.color
            }, {
                headers: { 'X-Internal-Key': SECRET }
            });
            console.log(`[Simulator] Bus ${this.busId} actualizado en ruta ${this.routeId}`);
        } catch (e) {
            console.error(`[Simulator] Error enviando posición de ${this.busId}:`, e.message);
        }
    }
}

const buses = [
    new Bus('BUS-001', '2'),
    new Bus('BUS-002', '10'),
    new Bus('BUS-003', '2')
];

console.log('🚀 SafeRoute Simulator Iniciado (Cartagena Edition)');
setInterval(() => {
    buses.forEach(b => b.move());
}, 2000);
