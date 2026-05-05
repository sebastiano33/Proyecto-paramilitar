const express = require('express');
const router = express.Router();
const tripsController = require('../controllers/trips.controller');

router.post('/share', tripsController.shareTrip);
router.get('/:token', tripsController.getTripStatus);
router.delete('/:token', tripsController.endTrip);

module.exports = router;
