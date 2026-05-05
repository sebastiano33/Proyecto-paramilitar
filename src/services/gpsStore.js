/**
 * Abstracción de almacenamiento para posiciones GPS
 * Soporta Redis (Producción) o Map en memoria (Desarrollo/Fallback)
 */
class GpsStore {
    constructor() {
        this.isRedis = false;
        this.memoryStore = new Map();
        this.ttl = 45000; // 45 segundos de vida

        if (process.env.REDIS_URL) {
            // Configuración de Redis si existe (Ej: Render Redis)
            // const Redis = require('ioredis');
            // this.redis = new Redis(process.env.REDIS_URL);
            // this.isRedis = true;
        }
    }

    async updatePosition(busId, data) {
        const payload = {
            ...data,
            lastUpdate: Date.now()
        };

        if (this.isRedis) {
            await this.redis.set(`bus:${busId}`, JSON.stringify(payload), 'PX', this.ttl);
        } else {
            this.memoryStore.set(busId, payload);
            // Limpieza manual para el Map en memoria (Simula TTL)
            setTimeout(() => {
                const current = this.memoryStore.get(busId);
                if (current && current.lastUpdate === payload.lastUpdate) {
                    this.memoryStore.delete(busId);
                    console.log(`[GpsStore] Bus ${busId} offline (TTL expired)`);
                }
            }, this.ttl);
        }
        return payload;
    }

    async getBusPosition(busId) {
        if (this.isRedis) {
            const data = await this.redis.get(`bus:${busId}`);
            return data ? JSON.parse(data) : null;
        }
        return this.memoryStore.get(busId) || null;
    }

    async getBusesByRoute(routeId) {
        if (this.isRedis) {
            // Nota: En Redis esto requeriría un Set adicional por ruta o SCAN
            return []; 
        }
        return Array.from(this.memoryStore.values()).filter(b => b.routeId === routeId);
    }

    async getAllActiveBuses() {
        if (this.isRedis) return []; // Simplificado
        return Array.from(this.memoryStore.values());
    }
}

module.exports = new GpsStore();
