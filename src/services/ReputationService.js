const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const userRepository = require('../repositories/userRepository');

const REPUTATION_ACTIONS = {
    ALERT_VERIFIED: { points: 15, msg: 'Tu alerta fue verificada' },
    ALERT_INCORRECT: { points: -5, msg: 'Alerta reportada como incorrecta' },
    CONFIRM_ALERT: { points: 3, msg: 'Confirmaste una alerta' },
    FIRST_POST_DAY: { points: 5, msg: 'Primera publicación del día' },
    SHARE_TRIP: { points: 10, msg: 'Viaje compartido' },
    TEN_LIKES: { points: 8, msg: 'Recibiste 10 likes' },
    COMPLETE_PROFILE: { points: 20, msg: 'Registro completado' },
    STREAK_7_DAYS: { points: 25, msg: 'Racha de 7 días activo' },
    ROUTE_CORRECTION: { points: 30, msg: 'Corrección de ruta verificada' }
};

const REPUTATION_LEVELS = [
    { min: 0, name: 'Pasajero Nuevo', icon: '👶', color: '#94a3b8', desc: 'Recién llegado a la red' },
    { min: 100, name: 'Viajero Regular', icon: '🚶', color: '#4f46e5', desc: 'Usuario frecuente' },
    { min: 300, name: 'Conocedor de Rutas', icon: '🧭', color: '#10b981', desc: 'Experto en el transporte local' },
    { min: 700, name: 'Guardián del Barrio', icon: '🛡️', color: '#f59e0b', desc: 'Protector de la comunidad' },
    { min: 1500, name: 'Maestro de la Ciudad', icon: '👑', color: '#ef4444', desc: 'Leyenda del asfalto' },
    { min: 3000, name: 'Leyenda de Cartagena', icon: '🔥', color: '#6366f1', desc: 'Máximo nivel de confianza' }
];

class ReputationService {
    constructor() {
        this.dataPath = path.join(__dirname, '../data/reputation_events.json');
        this.events = [];
        this.loadEvents();
    }

    loadEvents() {
        try {
            if (fs.existsSync(this.dataPath)) {
                this.events = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            }
        } catch (e) {
            console.error('[ReputationService] Error loading events:', e);
        }
    }

    saveEvents() {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.events, null, 2));
    }

    getLevel(score) {
        return [...REPUTATION_LEVELS].reverse().find(l => score >= l.min);
    }

    async addReputation(userId, actionKey, relatedEntityId = null, relatedEntityType = 'system') {
        const action = REPUTATION_ACTIONS[actionKey];
        if (!action) return null;

        const user = await userRepository.findById(userId);
        if (!user) return null;

        // 1. Crear evento
        const event = {
            id: uuidv4(),
            userId,
            action: actionKey,
            points: action.points,
            relatedEntityId,
            relatedEntityType,
            createdAt: new Date()
        };

        this.events.push(event);
        this.saveEvents();

        // 2. Actualizar score del usuario
        const oldScore = user.reputationScore;
        user.reputationScore += action.points;
        const newLevel = this.getLevel(user.reputationScore);
        const oldLevel = this.getLevel(oldScore);

        await userRepository.saveUsers(); // Persistir cambio en usuario

        // 3. Notificación Realtime via Global IO
        const io = require('../app').get('io');
        if (io) {
            io.to(`user:${userId}`).emit('reputation:points', {
                points: action.points,
                total: user.reputationScore,
                message: action.msg,
                newLevel: (newLevel.name !== oldLevel.name) ? newLevel : null
            });
        }

        return { event, levelUp: newLevel.name !== oldLevel.name };
    }

    async getStats(userId) {
        const userEvents = this.events.filter(e => e.userId === userId);
        return {
            alertasPublicadas: userEvents.filter(e => e.action === 'ALERT_VERIFIED').length,
            viajesCompartidos: userEvents.filter(e => e.action === 'SHARE_TRIP').length,
            puntosTotales: userEvents.reduce((acc, e) => acc + e.points, 0)
        };
    }
}

module.exports = new ReputationService();
