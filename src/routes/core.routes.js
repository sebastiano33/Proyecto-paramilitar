const express = require('express');
const router = express.Router();
const coreController = require('../controllers/core.controller');

router.get('/routes', coreController.getRoutes);
router.get('/stops/waiting', coreController.getWaitingStops);
router.post('/stops/waiting', coreController.registerWaiting);
router.get('/stops/safety', coreController.getSafetyData);

module.exports = router;
