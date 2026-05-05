const { verifyToken } = require('../utils/jwt');
const userRepository = require('../repositories/userRepository');

/**
 * Middleware para requerir autenticación JWT
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const guestUser = { 
        id: 'guest-user', 
        nickname: 'Invitado', 
        role: 'guest', 
        avatar: '👤', 
        reputationScore: 0,
        isGuest: true 
    };

    if (!token) {
        req.user = guestUser;
        return next();
    }

    try {
        const decoded = verifyToken(token);
        if (!decoded) {
            req.user = guestUser;
            return next();
        }

        const user = await userRepository.findById(decoded.id);
        if (!user) {
            req.user = guestUser;
            return next();
        }

        req.user = user;
        next();
    } catch (e) {
        req.user = guestUser;
        next();
    }
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
