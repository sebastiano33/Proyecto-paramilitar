const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');

/**
 * Middleware para requerir autenticación JWT
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: { code: 'AUTH_004', message: 'Token no proporcionado' }
        });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(403).json({
            success: false,
            error: { code: 'AUTH_003', message: 'Token inválido o expirado' }
        });
    }

    const user = await userRepository.findById(decoded.id);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: { code: 'AUTH_004', message: 'Usuario no encontrado' }
        });
    }

    req.user = user;
    next();
};

/**
 * Middleware de autenticación opcional
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = await userRepository.findById(decoded.id);
        }
    }
    next();
};

/**
 * Middleware Factory para requerir roles específicos
 */
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({
                success: false,
                error: { code: 'AUTH_005', message: 'Permisos insuficientes' }
            });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireRole
};
