const cron = require('node-cron');
const logger = require('../utils/logger');
const socialService = require('./SocialService');

class Scheduler {
    constructor() {
        this.tasks = new Map();
    }

    init() {
        // 1. Expirar alertas cada minuto
        this.register('expire-alerts', '* * * * *', () => {
            socialService.startExpirationJob();
        }, 'Revisión y expiración de alertas sociales');

        // 2. Limpieza de logs y temporales (Cada 6 horas)
        this.register('cleanup', '0 */6 * * *', () => {
            logger.info('scheduler', 'Iniciando limpieza de datos temporales');
        }, 'Limpieza periódica de archivos temporales');

        logger.info('scheduler', 'Sistema de tareas programadas iniciado');
    }

    register(name, expression, taskFn, description) {
        const task = cron.schedule(expression, async () => {
            const start = Date.now();
            try {
                logger.debug('scheduler', `Ejecutando: ${name}`);
                await taskFn();
                const duration = Date.now() - start;
                this.updateState(name, 'ok', duration);
            } catch (e) {
                logger.error('scheduler', `Error en ${name}: ${e.message}`);
                this.updateState(name, 'error', Date.now() - start, e.message);
            }
        });

        this.tasks.set(name, { name, expression, description, state: {} });
        return task;
    }

    updateState(name, status, duration, error = null) {
        const task = this.tasks.get(name);
        if (task) {
            task.state = { lastRun: new Date(), status, duration, error };
        }
    }
}

module.exports = new Scheduler();
