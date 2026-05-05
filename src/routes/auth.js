const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const userRepository = require('../repositories/userRepository');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwt');
const { authenticateToken } = require('../middleware/auth');

// Rate limiting para login (5 intentos por 15 min)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, error: { code: 'AUTH_002', message: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' } }
});

// POST /auth/register
router.post('/register', async (req, res) => {
    const { username, email, password, displayName } = req.body;

    // Validación básica
    if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: { code: 'VAL_001', message: 'Campos requeridos faltantes' } });
    }

    if (!validator.isEmail(email)) {
        return res.status(400).json({ success: false, error: { code: 'VAL_002', message: 'Email inválido' } });
    }

    // Verificar duplicados
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
        return res.status(409).json({ success: false, error: { code: 'AUTH_001', message: 'Email ya registrado' } });
    }

    const hashedPassword = await hashPassword(password);
    const user = await userRepository.create({
        username,
        email,
        password: hashedPassword,
        displayName: displayName || username
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    userRepository.addRefreshToken(refreshToken);

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ success: true, user: userWithoutPassword, accessToken, refreshToken });
});

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    const user = await userRepository.findByEmail(email);
    if (!user || !(await comparePassword(password, user.password))) {
        return res.status(401).json({ success: false, error: { code: 'AUTH_002', message: 'Credenciales inválidas' } });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    userRepository.addRefreshToken(refreshToken);

    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword, accessToken, refreshToken });
});

// POST /auth/refresh
router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || !userRepository.isValidRefreshToken(refreshToken)) {
        return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'Refresh token inválido' } });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded) {
        return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'Refresh token expirado' } });
    }

    const newAccessToken = generateAccessToken({ id: decoded.id });
    res.json({ success: true, accessToken: newAccessToken });
});

// POST /auth/logout
router.post('/logout', (req, res) => {
    const { refreshToken } = req.body;
    userRepository.removeRefreshToken(refreshToken);
    res.json({ success: true, message: 'Sesión cerrada' });
});

// GET /auth/me
router.get('/me', authenticateToken, (req, res) => {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json({ success: true, user: userWithoutPassword });
});

module.exports = router;
