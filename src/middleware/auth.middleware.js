const jwt = require('jsonwebtoken');

const JWT_SECRET = 'saferoute-super-secret-key-2026'; // Debería estar en .env

exports.protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ error: 'No autorizado', message: 'Debes iniciar sesión para acceder a esta ruta.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, role, nickname }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'No autorizado', message: 'Token inválido o expirado.' });
    }
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Prohibido', message: 'No tienes permisos para realizar esta acción.' });
        }
        next();
    };
};
