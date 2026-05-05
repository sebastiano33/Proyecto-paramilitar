const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { CORS_OPTIONS } = require('./config');
const ErrorHandler = require('./middleware/error.middleware');

const app = express();

// 1. Security Middlewares
app.use(helmet()); // Seguridad de headers
app.use(cors(CORS_OPTIONS));
app.use(express.json({ limit: '10kb' }));

// 2. Route Imports
const authRoutes = require('./routes/auth');
const coreRoutes = require('./routes/core.routes');
const tripsRoutes = require('./routes/trips.routes');
const socialRoutes = require('./routes/social.routes');
const adminRoutes = require('./routes/admin.routes');
const predictionRoutes = require('./routes/prediction.routes');
const userRoutes = require('./routes/user.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const complaintsRoutes = require('./routes/complaints');
const tripPlannerController = require('./controllers/tripPlanner.controller');
const { authenticateToken, requireRole } = require('./middleware/auth');

// 3. API Registration (v1)
const base = '/api/v1';

app.use('/uploads', express.static('uploads'));
app.get('/', (req, res) => res.status(200).json({ status: 'ok', message: 'SafeRoute API funcionando' }));
app.get('/health', (req, res) => res.status(200).json({ status: 'success', message: 'API Online' }));

// Auth & Users
app.use(`${base}/auth`, authRoutes);
app.use(`${base}/users`, authenticateToken, userRoutes);
app.use(`${base}/analytics`, authenticateToken, analyticsRoutes);
app.use(`${base}/complaints`, complaintsRoutes);




// Protected Routes
app.use(`${base}/predictions`, authenticateToken, predictionRoutes);
app.post(`${base}/plan-trip`, authenticateToken, tripPlannerController.planTrip);
app.use(`${base}`, coreRoutes); // Rutas públicas de tránsito
app.use(`${base}/trips`, authenticateToken, tripsRoutes);
app.use(`${base}/admin`, authenticateToken, requireRole('admin'), adminRoutes);
app.use(`${base}/social`, socialRoutes);

// 4. Fallback 404
app.all('*', (req, res, next) => {
    const err = new Error(`Endpoint ${req.originalUrl} no encontrado`);
    err.statusCode = 404;
    next(err);
});

// 5. Global Error Middleware
app.use(ErrorHandler);

module.exports = app;
