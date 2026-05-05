const fs = require('fs');
const path = require('path');

const COLORS = {
    debug: '\x1b[90m',
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
};

const ERROR_LOG_PATH = path.join(__dirname, '../data/error_log.json');

const writeToErrorLog = (log) => {
    try {
        let logs = [];
        if (fs.existsSync(ERROR_LOG_PATH)) {
            logs = JSON.parse(fs.readFileSync(ERROR_LOG_PATH, 'utf8'));
        }
        logs.push(log);
        if (logs.length > 100) logs.shift();
        fs.writeFileSync(ERROR_LOG_PATH, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error('Error writing to error log:', e);
    }
};

const logger = {
    log(level, service, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logObj = { timestamp, level, service, message, ...meta };

        if (process.env.NODE_ENV === 'production') {
            console.log(JSON.stringify(logObj));
        } else {
            const color = COLORS[level] || COLORS.reset;
            console.log(`[${timestamp.split('T')[1].split('.')[0]}] ${color}${level.toUpperCase()}${COLORS.reset} [${service}] ${message}`);
        }

        if (level === 'error') writeToErrorLog(logObj);
    },

    debug(service, message, meta) { this.log('debug', service, message, meta); },
    info(service, message, meta) { this.log('info', service, message, meta); },
    warn(service, message, meta) { this.log('warn', service, message, meta); },
    error(service, message, meta) { this.log('error', service, message, meta); }
};

module.exports = logger;
